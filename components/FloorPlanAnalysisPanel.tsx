import { useEffect, useState } from "react";
import { Check, LoaderCircle, Plus, ScanSearch, Trash2 } from "lucide-react";
import Button from "./ui/button";
import type {
    FloorPlanAnalysis,
    FloorPlanFinding,
    FloorPlanRelationship,
    FloorPlanRoom,
} from "../lib/floor-plan-analysis";

type FloorPlanAnalysisPanelProps = {
    approvedAnalysis?: FloorPlanAnalysis;
    isOwner: boolean;
    onAnalyze: () => Promise<FloorPlanAnalysis>;
    onApprove: (analysis: FloorPlanAnalysis) => Promise<void>;
};

const copyAnalysis = (analysis: FloorPlanAnalysis): FloorPlanAnalysis => ({
    ...analysis,
    rooms: analysis.rooms.map((room) => ({ ...room })),
    doors: analysis.doors.map((finding) => ({ ...finding })),
    windows: analysis.windows.map((finding) => ({ ...finding })),
    walls: analysis.walls.map((finding) => ({ ...finding })),
    relationships: analysis.relationships.map((relationship) => ({ ...relationship })),
    uncertainties: [...analysis.uncertainties],
});

const confidencePercent = (confidence: number) => `${Math.round(confidence * 100)}%`;

const ConfidenceEditor = ({
    value,
    onChange,
    disabled = false,
}: {
    value: number;
    onChange: (value: number) => void;
    disabled?: boolean;
}) => (
    <label className="analysis-confidence">
        Confidence
        <input
            aria-label="Confidence"
            type="number"
            min="0"
            max="1"
            step="0.05"
            value={value}
            disabled={disabled}
            onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) onChange(Math.min(1, Math.max(0, next)));
            }}
        />
        <span>{confidencePercent(value)}</span>
    </label>
);

const FloorPlanAnalysisPanel = ({
    approvedAnalysis,
    isOwner,
    onAnalyze,
    onApprove,
}: FloorPlanAnalysisPanelProps) => {
    const [draft, setDraft] = useState<FloorPlanAnalysis | null>(
        approvedAnalysis ? copyAnalysis(approvedAnalysis) : null,
    );
    const [hasUnapprovedChanges, setHasUnapprovedChanges] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setDraft(approvedAnalysis ? copyAnalysis(approvedAnalysis) : null);
        setHasUnapprovedChanges(false);
    }, [approvedAnalysis]);

    const updateDraft = (update: (current: FloorPlanAnalysis) => FloorPlanAnalysis) => {
        setDraft((current) => current ? update(current) : current);
        setHasUnapprovedChanges(true);
        setError(null);
    };

    const updateRoom = (index: number, update: (room: FloorPlanRoom) => FloorPlanRoom) => {
        updateDraft((current) => ({
            ...current,
            rooms: current.rooms.map((room, roomIndex) => roomIndex === index ? update(room) : room),
        }));
    };

    const updateFinding = (
        category: "doors" | "windows" | "walls",
        index: number,
        update: (finding: FloorPlanFinding) => FloorPlanFinding,
    ) => {
        updateDraft((current) => ({
            ...current,
            [category]: current[category].map((finding, findingIndex) =>
                findingIndex === index ? update(finding) : finding),
        }));
    };

    const updateRelationship = (
        index: number,
        update: (relationship: FloorPlanRelationship) => FloorPlanRelationship,
    ) => {
        updateDraft((current) => ({
            ...current,
            relationships: current.relationships.map((relationship, relationshipIndex) =>
                relationshipIndex === index ? update(relationship) : relationship),
        }));
    };

    const analyze = async () => {
        setIsAnalyzing(true);
        setError(null);
        try {
            setDraft(await onAnalyze());
            setHasUnapprovedChanges(true);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to analyze this floor plan.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const approve = async () => {
        if (!draft) return;
        setIsSaving(true);
        setError(null);
        try {
            await onApprove(draft);
            setHasUnapprovedChanges(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save the approved analysis.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <section className="analysis-panel" aria-labelledby="floor-plan-analysis-title">
            <div className="analysis-header">
                <div>
                    <p className="analysis-eyebrow">AI-assisted interpretation</p>
                    <h2 id="floor-plan-analysis-title">Floor-plan analysis</h2>
                    <p>On request, this image is sent to Puter AI (Gemini 2.5 Flash). Review findings before saving.</p>
                </div>
                {isOwner && (
                    <div className="analysis-actions">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void analyze()}
                            disabled={isAnalyzing || isSaving || hasUnapprovedChanges}
                        >
                            {isAnalyzing
                                ? <LoaderCircle className="analysis-icon spinning" aria-hidden="true" />
                                : <ScanSearch className="analysis-icon" aria-hidden="true" />}
                            {isAnalyzing ? "Analyzing..." : draft ? "Analyze again" : "Analyze floor plan"}
                        </Button>
                        {draft && (
                            <Button
                                size="sm"
                                onClick={() => void approve()}
                                disabled={!hasUnapprovedChanges || isAnalyzing || isSaving}
                            >
                                {isSaving
                                    ? <LoaderCircle className="analysis-icon spinning" aria-hidden="true" />
                                    : <Check className="analysis-icon" aria-hidden="true" />}
                                {isSaving ? "Saving..." : "Approve and save"}
                            </Button>
                        )}
                    </div>
                )}
            </div>

            {!isOwner && (
                <p className="analysis-notice" role="status">
                    Only the project owner can analyze or approve this floor plan.
                </p>
            )}
            {error && <p className="analysis-error" role="alert">{error}</p>}
            {draft ? (
                <div className="analysis-content">
                    <p className="analysis-status" role="status">
                        {hasUnapprovedChanges
                            ? "Review the draft and approve it to save changes."
                            : `Approved analysis · ${new Date(draft.analyzedAt).toLocaleString()} · ${draft.model}`}
                    </p>
                    <label className="analysis-field">
                        Summary
                        <textarea
                            value={draft.summary}
                            maxLength={2000}
                            disabled={!isOwner || isAnalyzing || isSaving}
                            onChange={(event) => updateDraft((current) => ({
                                ...current,
                                summary: event.target.value,
                            }))}
                        />
                    </label>

                    <AnalysisSection title="Rooms" count={draft.rooms.length}>
                        {draft.rooms.map((room, index) => (
                            <article className="analysis-item" key={room.id}>
                                <h3>{room.label}</h3>
                                <div className="analysis-fields">
                                    <TextEditor
                                        label="Room label"
                                        value={room.label}
                                        disabled={!isOwner || isAnalyzing || isSaving}
                                        onChange={(value) => updateRoom(index, (item) => ({ ...item, label: value }))}
                                    />
                                    <TextEditor
                                        label="Possible function (blank if unknown)"
                                        value={room.possibleFunction ?? ""}
                                        disabled={!isOwner || isAnalyzing || isSaving}
                                        onChange={(value) => updateRoom(index, (item) => ({
                                            ...item,
                                            possibleFunction: value.trim() ? value : null,
                                        }))}
                                    />
                                    <TextEditor
                                        label="Visual evidence"
                                        value={room.evidence}
                                        disabled={!isOwner || isAnalyzing || isSaving}
                                        onChange={(value) => updateRoom(index, (item) => ({ ...item, evidence: value }))}
                                        multiline
                                    />
                                    <ConfidenceEditor
                                        value={room.confidence}
                                        disabled={!isOwner || isAnalyzing || isSaving}
                                        onChange={(value) => updateRoom(index, (item) => ({ ...item, confidence: value }))}
                                    />
                                </div>
                            </article>
                        ))}
                    </AnalysisSection>

                    <AnalysisSection title="Doors" count={draft.doors.length}>
                        <FindingEditors
                            category="doors"
                            findings={draft.doors}
                            disabled={!isOwner || isAnalyzing || isSaving}
                            onChange={updateFinding}
                        />
                    </AnalysisSection>
                    <AnalysisSection title="Windows" count={draft.windows.length}>
                        <FindingEditors
                            category="windows"
                            findings={draft.windows}
                            disabled={!isOwner || isAnalyzing || isSaving}
                            onChange={updateFinding}
                        />
                    </AnalysisSection>
                    <AnalysisSection title="Walls" count={draft.walls.length}>
                        <FindingEditors
                            category="walls"
                            findings={draft.walls}
                            disabled={!isOwner || isAnalyzing || isSaving}
                            onChange={updateFinding}
                        />
                    </AnalysisSection>

                    <AnalysisSection title="Spatial relationships" count={draft.relationships.length}>
                        {draft.relationships.map((relationship, index) => (
                            <article className="analysis-item" key={relationship.id}>
                                <p>{roomLabel(draft, relationship.fromRoomId)} ↔ {roomLabel(draft, relationship.toRoomId)}</p>
                                <TextEditor
                                    label="Relationship"
                                    value={relationship.relationship}
                                    disabled={!isOwner || isAnalyzing || isSaving}
                                    onChange={(value) => updateRelationship(index, (item) => ({
                                        ...item,
                                        relationship: value,
                                    }))}
                                />
                                <ConfidenceEditor
                                    value={relationship.confidence}
                                    disabled={!isOwner || isAnalyzing || isSaving}
                                    onChange={(value) => updateRelationship(index, (item) => ({
                                        ...item,
                                        confidence: value,
                                    }))}
                                />
                            </article>
                        ))}
                    </AnalysisSection>

                    <AnalysisSection title="Uncertain or unidentifiable" count={draft.uncertainties.length}>
                        {draft.uncertainties.map((uncertainty, index) => (
                            <div className="analysis-uncertainty" key={`uncertainty-${index}`}>
                                <TextEditor
                                    label={`Uncertainty ${index + 1}`}
                                    value={uncertainty}
                                    disabled={!isOwner || isAnalyzing || isSaving}
                                    onChange={(value) => updateDraft((current) => ({
                                        ...current,
                                        uncertainties: current.uncertainties.map((item, itemIndex) =>
                                            itemIndex === index ? value : item),
                                    }))}
                                />
                                {isOwner && (
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        aria-label={`Remove uncertainty ${index + 1}`}
                                        disabled={isAnalyzing || isSaving}
                                        onClick={() => updateDraft((current) => ({
                                            ...current,
                                            uncertainties: current.uncertainties.filter((_, itemIndex) => itemIndex !== index),
                                        }))}
                                    >
                                        <Trash2 className="analysis-icon" aria-hidden="true" />
                                    </Button>
                                )}
                            </div>
                        ))}
                        {isOwner && (
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={isAnalyzing || isSaving}
                                onClick={() => updateDraft((current) => ({
                                    ...current,
                                    uncertainties: [...current.uncertainties, "Describe an uncertain element"],
                                }))}
                            >
                                <Plus className="analysis-icon" aria-hidden="true" /> Add uncertainty
                            </Button>
                        )}
                    </AnalysisSection>
                    <p className="analysis-disclaimer">
                        AI interpretation may be uncertain and is not verified CAD or BIM geometry.
                    </p>
                </div>
            ) : (
                <p className="analysis-empty">
                    No approved interpretation yet. Analyze this uploaded plan when you are ready.
                </p>
            )}
        </section>
    );
};

const roomLabel = (analysis: FloorPlanAnalysis, id: string) =>
    analysis.rooms.find((room) => room.id === id)?.label ?? id;

const AnalysisSection = ({
    title,
    count,
    children,
}: {
    title: string;
    count: number;
    children: React.ReactNode;
}) => (
    <section className="analysis-group" aria-label={title}>
        <h3>{title} <span>({count})</span></h3>
        {count ? children : <p className="analysis-empty">No visible findings identified.</p>}
    </section>
);

const TextEditor = ({
    label,
    value,
    disabled,
    onChange,
    multiline = false,
}: {
    label: string;
    value: string;
    disabled: boolean;
    onChange: (value: string) => void;
    multiline?: boolean;
}) => (
    <label className="analysis-field">
        {label}
        {multiline ? (
            <textarea
                value={value}
                maxLength={1000}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
            />
        ) : (
            <input
                value={value}
                maxLength={1000}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
            />
        )}
    </label>
);

const FindingEditors = ({
    category,
    findings,
    disabled,
    onChange,
}: {
    category: "doors" | "windows" | "walls";
    findings: FloorPlanFinding[];
    disabled: boolean;
    onChange: (
        category: "doors" | "windows" | "walls",
        index: number,
        update: (finding: FloorPlanFinding) => FloorPlanFinding,
    ) => void;
}) => findings.map((finding, index) => (
    <article className="analysis-item" key={finding.id}>
        <div className="analysis-fields">
            <TextEditor
                label={`${category.slice(0, -1)} description`}
                value={finding.description}
                disabled={disabled}
                onChange={(value) => onChange(category, index, (item) => ({ ...item, description: value }))}
            />
            <TextEditor
                label="Relative location"
                value={finding.location}
                disabled={disabled}
                onChange={(value) => onChange(category, index, (item) => ({ ...item, location: value }))}
            />
            <TextEditor
                label="Visual evidence"
                value={finding.evidence}
                disabled={disabled}
                onChange={(value) => onChange(category, index, (item) => ({ ...item, evidence: value }))}
                multiline
            />
            <ConfidenceEditor
                value={finding.confidence}
                disabled={disabled}
                onChange={(value) => onChange(category, index, (item) => ({ ...item, confidence: value }))}
            />
        </div>
    </article>
));

export default FloorPlanAnalysisPanel;
