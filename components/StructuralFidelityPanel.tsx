import { useEffect, useMemo, useState } from "react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import { createEmptyFidelityCriteria, createFidelityEvaluation, FIDELITY_CRITERIA, fidelityEvaluationToCsv, getAnalysisForVersion, scoreFidelityCriteria, type FidelityCriterion, type FidelityEvaluation, type FidelityRating } from "../lib/fidelity-evaluation";
import type { FloorPlanAnalysis } from "../lib/floor-plan-analysis";
import type { RenderVersion } from "../lib/render-version";

type Props = { projectId: string; projectName: string; sourceImage: string; sourceImageReference: string; analysis?: FloorPlanAnalysis; versions: RenderVersion[]; images: Record<string, string>; selectedVersionId: string | null; evaluations: FidelityEvaluation[]; loadError?: string | null; reviewerIdentifier: string; isOwner: boolean; onSave: (evaluation: FidelityEvaluation, revisionOf?: string) => Promise<FidelityEvaluation>; };
const WARNING = "Architectural fidelity scores are research-oriented visual assessments. They do not establish geometric accuracy, building-code compliance, or engineering suitability.";

export default function StructuralFidelityPanel({ projectId, projectName, sourceImage, sourceImageReference, analysis, versions, images, selectedVersionId, evaluations, loadError, reviewerIdentifier, isOwner, onSave }: Props) {
    const [versionId, setVersionId] = useState(selectedVersionId ?? versions[0]?.id ?? "");
    const [criteria, setCriteria] = useState(createEmptyFidelityCriteria);
    const [draftRatings, setDraftRatings] = useState<Array<FidelityRating | "">>(() => createEmptyFidelityCriteria().map(() => ""));
    const [observations, setObservations] = useState("");
    const [discrepancies, setDiscrepancies] = useState("");
    const [limitations, setLimitations] = useState("");
    const [reviewer, setReviewer] = useState(reviewerIdentifier);
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [openedId, setOpenedId] = useState("");
    const versionKey = versions.map(({ id }) => id).join("|");
    const version = versions.find((item) => item.id === versionId);
    const prior = evaluations.filter((item) => item.renderVersionId === versionId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const referenceAnalysis = version ? getAnalysisForVersion(version, analysis) : undefined;
    const score = useMemo(() => scoreFidelityCriteria(criteria), [criteria]);
    useEffect(() => { setVersionId(selectedVersionId ?? versions[0]?.id ?? ""); }, [selectedVersionId, versionKey]);
    const load = (item: FidelityEvaluation) => { setCriteria(item.criteria); setDraftRatings(item.criteria.map(({ rating }) => rating)); setObservations(item.observations.join("\n")); setDiscrepancies(item.discrepancies.join("\n")); setLimitations(item.limitations.join("\n")); setOpenedId(item.id); setMessage("Saved evaluation loaded. Saving changes will create a documented revision."); };
    const update = (index: number, patch: Partial<FidelityCriterion>) => setCriteria((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
    const save = async () => {
        if (!version || !isOwner) return;
        if (draftRatings.some((rating) => !rating)) { setMessage("Choose an outcome for all six criteria. Use Cannot determine when a feature is obscured."); return; }
        setBusy(true); setMessage("");
        try {
            const evaluation = createFidelityEvaluation({ id: crypto.randomUUID(), projectId, renderVersionId: version.id, sourceImageReference, generationProvenance: { versionNumber: version.versionNumber, generationMode: version.generationMode, modelIdentifier: version.modelIdentifier, promptTemplateVersion: version.promptTemplateVersion, configurationSnapshot: version.configurationSnapshot, renderCreatedAt: version.createdAt }, approvedAnalysisRevision: version.approvedAnalysisRevision, ...(referenceAnalysis ? { approvedAnalysisSnapshot: referenceAnalysis } : {}), reviewerIdentifier: reviewer.trim(), criteria, observations: observations.split("\n").map((x) => x.trim()).filter(Boolean), discrepancies: discrepancies.split("\n").map((x) => x.trim()).filter(Boolean), limitations: [...limitations.split("\n").map((x) => x.trim()).filter(Boolean), ...(!referenceAnalysis ? ["No approved analysis snapshot is available for this render version."] : [])] });
            await onSave(evaluation, openedId || undefined);
            setOpenedId(evaluation.id); setMessage("Evaluation saved.");
        } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save evaluation."); }
        finally { setBusy(false); }
    };
    const exportReport = (item: FidelityEvaluation) => {
        const versionRecord = versions.find((v) => v.id === item.renderVersionId);
        const report = { projectName, projectId, renderVersion: { ...(versionRecord ?? {}), id: item.renderVersionId, ...item.generationProvenance }, evaluation: item, scoreCoverage: `${item.applicableCriteria}/6 applicable criteria`, rubric: FIDELITY_CRITERIA, scoring: "Sum of awarded points / maximum applicable points x 100; CANNOT_DETERMINE excluded.", warning: WARNING };
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `fidelity-${item.renderVersionId}-${item.id}.json`; link.click(); URL.revokeObjectURL(link.href);
        const csv = new Blob([fidelityEvaluationToCsv(item, projectName, versionRecord)], { type: "text/csv;charset=utf-8" });
        const csvLink = document.createElement("a"); csvLink.href = URL.createObjectURL(csv); csvLink.download = `fidelity-${item.renderVersionId}-${item.id}.csv`; csvLink.click(); URL.revokeObjectURL(csvLink.href);
    };
    return <section className="fidelity-panel" aria-labelledby="fidelity-title">
        <header><h2 id="fidelity-title">Structural fidelity evaluation</h2><p>{WARNING}</p></header>
        {loadError && <p role="alert">Saved assessments could not be reloaded: {loadError}</p>}
        {!isOwner ? <p role="status">Private assessments are available to the project owner only.</p> : <>
            <label>Render version<select value={versionId} onChange={(e) => { setVersionId(e.target.value); setOpenedId(""); setCriteria(createEmptyFidelityCriteria()); setDraftRatings(createEmptyFidelityCriteria().map(() => "")); setObservations(""); setDiscrepancies(""); setLimitations(""); }} aria-label="Render version for fidelity evaluation">{versions.map((v) => <option key={v.id} value={v.id}>Version {v.versionNumber} | {v.generationMode}</option>)}</select></label>
            {version && <><p><strong>{version.generationMode === "baseline" ? "Baseline" : "Enhanced"}</strong> · Model: {version.modelIdentifier} · Prompt: {version.promptTemplateVersion}</p>
                <div className="fidelity-images"><figure><figcaption>Original floor plan</figcaption><img src={sourceImage} alt="Original uploaded floor plan" /></figure><figure><figcaption>Selected visualization</figcaption>{images[version.id] ? <img src={images[version.id]} alt={`Generated ${version.generationMode} visualization, version ${version.versionNumber}`} /> : <p>Private render image unavailable.</p>}</figure></div>
                {images[version.id] && <div className="fidelity-compare"><p>Image comparison</p><ReactCompareSlider itemOne={<ReactCompareSliderImage src={sourceImage} alt="Original floor plan" />} itemTwo={<ReactCompareSliderImage src={images[version.id]} alt="Generated visualization" />} aria-label="Compare floor plan and generated visualization" /></div>}
                <details><summary>Approved interpretation (reference information, not ground truth)</summary>{referenceAnalysis ? <><p>{referenceAnalysis.summary}</p><ul>{referenceAnalysis.rooms.map((r) => <li key={r.id}>{r.label}: {r.possibleFunction ?? "function uncertain"}</li>)}</ul><p>Analysis revision: {version.approvedAnalysisRevision ?? "unknown"}</p></> : <p>No approved analysis snapshot is available for this render version. Record this limitation in the assessment.</p>}</details>
                <p>Rubric: {FIDELITY_CRITERIA.length} equally weighted criteria. {draftRatings.some((rating) => !rating) ? "Complete all six ratings to calculate the score." : `Score: ${score.overallScore === null ? "INSUFFICIENT EVIDENCE" : `${score.overallScore}%`} | Coverage ${score.applicableCriteria}/6 applicable | ${score.unassessableCriteria} unassessable.`}</p>
                <div className="fidelity-criteria">{criteria.map((criterion, i) => <fieldset key={criterion.criterionId}><legend>{i + 1}. {criterion.label}</legend><label>Rating<select required aria-label={`${criterion.label} rating`} value={draftRatings[i]} onChange={(e) => { const rating = e.target.value as FidelityRating; setDraftRatings((current) => current.map((item, index) => index === i ? rating : item)); update(i, { rating }); }}><option value="" disabled>Choose an outcome</option><option value="CANNOT_DETERMINE">Cannot determine</option><option value="PRESERVED">Preserved (2)</option><option value="PARTIALLY_PRESERVED">Partially preserved (1)</option><option value="NOT_PRESERVED">Not preserved (0)</option></select></label><label>Reviewer notes<textarea maxLength={2000} value={criterion.reviewerNotes} onChange={(e) => update(i, { reviewerNotes: e.target.value })} /></label><label>Supporting evidence<textarea maxLength={1000} value={criterion.supportingEvidence.join("\n")} onChange={(e) => update(i, { supportingEvidence: e.target.value.split("\n").slice(0, 20) })} /></label><label>Visibility / uncertainty notes<textarea maxLength={1000} value={criterion.confidenceOrVisibilityNotes} onChange={(e) => update(i, { confidenceOrVisibilityNotes: e.target.value })} /></label></fieldset>)}</div>
                <label>Reviewer identifier (use a study code for blinded review)<input maxLength={200} value={reviewer} onChange={(e) => setReviewer(e.target.value)} /></label><label>Overall observations<textarea maxLength={5000} value={observations} onChange={(e) => setObservations(e.target.value)} /></label><label>Identified discrepancies<textarea maxLength={5000} value={discrepancies} onChange={(e) => setDiscrepancies(e.target.value)} /></label><label>Uncertainties and limitations<textarea maxLength={5000} value={limitations} onChange={(e) => setLimitations(e.target.value)} /></label>
                <button type="button" disabled={busy || !version || draftRatings.some((rating) => !rating)} onClick={() => void save()}>{busy ? "Saving…" : "Save evaluation"}</button>{message && <p role="status">{message}</p>}
                <h3>Prior assessments for this version</h3>{prior.length ? <ul>{prior.map((item) => <li key={item.id}><button type="button" onClick={() => load(item)}>Open {new Date(item.updatedAt).toLocaleString()} · {item.overallScore === null ? "Insufficient evidence" : `${item.overallScore}%`} ({item.reviewerIdentifier})</button> <button type="button" onClick={() => exportReport(item)}>Export JSON and CSV</button></li>)}</ul> : <p>No assessments saved for this render version.</p>}
                {openedId && prior.find((item) => item.id === openedId) && <p>Loaded record {openedId}. Saving creates a new linked revision; the existing record is retained.</p>}
            </>}
        </>}
    </section>;
}
