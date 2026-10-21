import { useEffect, useState } from "react";
import Button from "./ui/button";
import type { RenderVersion } from "../lib/render-version";

type RenderHistoryPanelProps = {
    versions: RenderVersion[];
    versionImages: Record<string, string>;
    activeVersionId: string | null;
    selectedVersionId: string | null;
    isOwner: boolean;
    isLoading: boolean;
    isGenerating: boolean;
    isSaving: boolean;
    statusMessage: string;
    statusIsError: boolean;
    onSelect: (versionId: string) => void;
    onSetActive: (versionId: string) => void;
    onSaveDetails: (versionId: string, name: string, notes: string) => Promise<void>;
    onExport: () => void;
    onGenerate: () => void;
};

const RenderHistoryPanel = ({
    versions,
    versionImages,
    activeVersionId,
    selectedVersionId,
    isOwner,
    isLoading,
    isGenerating,
    isSaving,
    statusMessage,
    statusIsError,
    onSelect,
    onSetActive,
    onSaveDetails,
    onExport,
    onGenerate,
}: RenderHistoryPanelProps) => {
    const selectedVersion = versions.find(({ id }) => id === selectedVersionId) ?? null;
    const [name, setName] = useState("");
    const [notes, setNotes] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setName(selectedVersion?.name ?? "");
        setNotes(selectedVersion?.notes ?? "");
        setError(null);
    }, [selectedVersion?.id, selectedVersion?.name, selectedVersion?.notes]);

    const saveDetails = async () => {
        if (!selectedVersion) return;
        try {
            setError(null);
            await onSaveDetails(selectedVersion.id, name, notes);
        } catch (cause) {
            setError(cause instanceof Error
                ? cause.message
                : "Unable to save render version details.");
        }
    };

    return (
        <section className="render-history" aria-labelledby="render-history-title">
            <header className="render-history-header">
                <div>
                    <p className="render-history-eyebrow">Project versions</p>
                    <h2 id="render-history-title">Render history</h2>
                    <p>Each retained render records the inputs and generation conditions used.</p>
                </div>
                {isOwner && (
                    <Button
                        size="sm"
                        onClick={onGenerate}
                        disabled={isGenerating}
                    >
                        {isGenerating ? "Generating..." : "Generate new version"}
                    </Button>
                )}
            </header>

            {statusMessage && (
                <p
                    className={`render-history-status${statusIsError ? " is-error" : ""}`}
                    role={statusIsError ? "alert" : "status"}
                >
                    {statusMessage}
                </p>
            )}
            {isLoading ? (
                <div className="render-history-empty" role="status" aria-busy="true">
                    Loading render history...
                </div>
            ) : versions.length === 0 ? (
                <div className="render-history-empty" role="status">
                    No render versions yet. Select a generation mode and start the first render.
                </div>
            ) : (
                <div className="render-history-layout">
                    <div className="render-version-list" aria-label="Retained render versions">
                        {versions.map((version) => {
                            const image = versionImages[version.id];
                            return (
                                <button
                                    className={`render-version-card${selectedVersion?.id === version.id ? " is-selected" : ""}`}
                                    type="button"
                                    key={version.id}
                                    onClick={() => onSelect(version.id)}
                                    aria-pressed={selectedVersion?.id === version.id}
                                >
                                    {image
                                        ? <img src={image} alt={`Version ${version.versionNumber} thumbnail`} />
                                        : <span className="render-version-thumbnail-empty">Image unavailable</span>}
                                    <span className="render-version-card-copy">
                                        <strong>{version.name?.trim() || `Version ${version.versionNumber}`}</strong>
                                        <span>Version {version.versionNumber} · {version.generationMode}</span>
                                        <span>{new Date(version.createdAt).toLocaleString()}</span>
                                        <span className={`render-version-status is-${version.generationStatus}`}>
                                            {version.generationStatus}
                                        </span>
                                        {version.id === activeVersionId && <span>Active render</span>}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {selectedVersion && (
                        <div className="render-version-details">
                            <div className="render-version-detail-header">
                                <h3>Version {selectedVersion.versionNumber} metadata</h3>
                                <span>{selectedVersion.generationMode === "enhanced" ? "Enhanced" : "Baseline"}</span>
                            </div>
                            <dl>
                                <div><dt>Architectural style</dt><dd>{selectedVersion.configurationSnapshot?.architecturalStyle ?? "Not recorded"}</dd></div>
                                <div><dt>AI model</dt><dd>{selectedVersion.modelIdentifier}</dd></div>
                                <div><dt>Prompt template</dt><dd>{selectedVersion.promptTemplateVersion}</dd></div>
                                <div><dt>Approved analysis revision</dt><dd>{selectedVersion.approvedAnalysisRevision ?? "Not recorded"}</dd></div>
                                <div><dt>Created</dt><dd>{new Date(selectedVersion.createdAt).toLocaleString()}</dd></div>
                                <div><dt>Generation duration</dt><dd>{selectedVersion.generationLatencyMs === undefined ? "Not measured" : `${selectedVersion.generationLatencyMs} ms`}</dd></div>
                                {selectedVersion.generationMode === "baseline" && selectedVersion.configurationSnapshot && (
                                    <div><dt>Style use</dt><dd>Recorded for traceability; baseline prompting does not apply design settings.</dd></div>
                                )}
                            </dl>

                            {isOwner && (
                                <div className="render-version-edit">
                                    <label>
                                        Version name
                                        <input
                                            value={name}
                                            maxLength={80}
                                            onChange={(event) => setName(event.currentTarget.value)}
                                        />
                                    </label>
                                    <label>
                                        Notes
                                        <textarea
                                            value={notes}
                                            maxLength={2000}
                                            rows={3}
                                            onChange={(event) => setNotes(event.currentTarget.value)}
                                        />
                                    </label>
                                    {error && <p role="alert">{error}</p>}
                                    <div className="render-version-actions">
                                        <Button size="sm" onClick={() => void saveDetails()} disabled={isSaving}>
                                            {isSaving ? "Saving..." : "Save name and notes"}
                                        </Button>
                                        {selectedVersion.id !== activeVersionId && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                onClick={() => onSetActive(selectedVersion.id)}
                                                disabled={isSaving}
                                            >
                                                Make active render
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <Button
                                size="sm"
                                variant="outline"
                                onClick={onExport}
                                disabled={!versionImages[selectedVersion.id]}
                            >
                                Export selected render
                            </Button>
                        </div>
                    )}
                </div>
            )}
            {!isLoading && versions.some(({ id }) => !versionImages[id]) && (
                <p className="render-history-status is-error" role="alert">
                    One or more private render images could not be loaded. Other retained versions remain available.
                </p>
            )}
        </section>
    );
};

export default RenderHistoryPanel;
