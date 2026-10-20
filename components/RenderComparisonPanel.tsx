import { useEffect, useState } from "react";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import type { RenderVersion } from "../lib/render-version";

type RenderComparisonPanelProps = {
    sourceImage: string;
    versions: RenderVersion[];
    versionImages: Record<string, string>;
    selectedVersionId: string | null;
};

const RenderComparisonPanel = ({
    sourceImage,
    versions,
    versionImages,
    selectedVersionId,
}: RenderComparisonPanelProps) => {
    const [mode, setMode] = useState<"source-render" | "render-render">("source-render");
    const [versionAId, setVersionAId] = useState(selectedVersionId ?? "");
    const [versionBId, setVersionBId] = useState("");
    const versionA = versions.find(({ id }) => id === versionAId) ??
        versions.find(({ id }) => id === selectedVersionId) ??
        versions[0];
    const versionB = versions.find(({ id }) => id === versionBId) ??
        versions.find(({ id }) => id !== versionA?.id);

    useEffect(() => {
        if (!versions.some(({ id }) => id === versionAId)) {
            setVersionAId(selectedVersionId ?? versions[0]?.id ?? "");
        }
        if (!versions.some(({ id }) => id === versionBId && id !== versionA?.id)) {
            setVersionBId(versions.find(({ id }) => id !== versionA?.id)?.id ?? "");
        }
        if (versions.length < 2) setMode("source-render");
    }, [versions, selectedVersionId, versionAId, versionBId, versionA?.id]);

    const imageOne = mode === "source-render"
        ? sourceImage
        : versionA ? versionImages[versionA.id] : undefined;
    const imageTwo = versionA ? versionImages[versionA.id] : undefined;
    const comparisonReady = mode === "source-render"
        ? Boolean(sourceImage && imageTwo)
        : Boolean(imageOne && versionB && versionImages[versionB.id]);

    return (
        <section className="panel compare" aria-labelledby="render-comparison-title">
            <div className="panel-header">
                <div className="panel-meta">
                    <p>Comparison</p>
                    <h3 id="render-comparison-title">
                        {mode === "source-render"
                            ? "Source floor plan versus render"
                            : "Render versus render"}
                    </h3>
                </div>
                <div className="hint">Drag to compare</div>
            </div>

            <div className="comparison-controls">
                <label>
                    Comparison mode
                    <select
                        value={mode}
                        onChange={(event) => setMode(
                            event.currentTarget.value as "source-render" | "render-render",
                        )}
                    >
                        <option value="source-render">Source floor plan vs render</option>
                        <option value="render-render" disabled={versions.length < 2}>
                            Render vs render
                        </option>
                    </select>
                </label>
                {mode === "source-render" ? (
                    <label>
                        Render version
                        <select
                            value={versionA?.id ?? ""}
                            onChange={(event) => setVersionAId(event.currentTarget.value)}
                            disabled={!versions.length}
                        >
                            {versions.map((version) => (
                                <option value={version.id} key={version.id}>
                                    Version {version.versionNumber} · {version.name || version.generationMode}
                                </option>
                            ))}
                        </select>
                    </label>
                ) : (
                    <>
                        <label>
                            Version A
                            <select
                                value={versionA?.id ?? ""}
                                onChange={(event) => setVersionAId(event.currentTarget.value)}
                            >
                                {versions.map((version) => (
                                    <option value={version.id} key={version.id}>
                                        Version {version.versionNumber} · {version.name || version.generationMode}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            Version B
                            <select
                                value={versionB?.id ?? ""}
                                onChange={(event) => setVersionBId(event.currentTarget.value)}
                            >
                                {versions.map((version) => (
                                    <option value={version.id} key={version.id}>
                                        Version {version.versionNumber} · {version.name || version.generationMode}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </>
                )}
            </div>

            <div className="compare-stage">
                {comparisonReady && imageOne && imageTwo && (
                    <ReactCompareSlider
                        defaultValue={50}
                        style={{ width: "100%", height: "auto" }}
                        itemOne={
                            <ReactCompareSliderImage
                                src={imageOne}
                                alt={mode === "source-render"
                                    ? "Original 2D floor plan"
                                    : `Version ${versionA?.versionNumber}`}
                                className="compare-img"
                            />
                        }
                        itemTwo={
                            <ReactCompareSliderImage
                                src={mode === "source-render"
                                    ? imageTwo
                                    : versionB ? versionImages[versionB.id] : ""}
                                alt={mode === "source-render"
                                    ? `Render version ${versionA?.versionNumber}`
                                    : `Version ${versionB?.versionNumber}`}
                                className="compare-img"
                            />
                        }
                    />
                )}
                {!comparisonReady && (
                    <div className="compare-fallback">
                        {mode === "source-render" && sourceImage && (
                            <img
                                src={sourceImage}
                                alt="Original 2D floor plan"
                                className="compare-img"
                            />
                        )}
                        <p role="status">
                            {versions.length === 0
                                ? "Generate a render version to start a comparison."
                                : "The selected comparison images are unavailable."}
                        </p>
                    </div>
                )}
            </div>

            <div className="comparison-metadata">
                {mode === "source-render" ? (
                    <span>Source floor plan compared with Version {versionA?.versionNumber ?? "—"}.</span>
                ) : (
                    <>
                        <span>
                            {versionA?.name || `Version ${versionA?.versionNumber ?? "—"}`} ·
                            {" "}{versionA?.generationMode} ·
                            {" "}{versionA?.configurationSnapshot?.architecturalStyle ?? "style not recorded"} ·
                            {" "}{versionA?.modelIdentifier} ·
                            {" "}analysis revision {versionA?.approvedAnalysisRevision ?? "not recorded"}
                        </span>
                        <span>
                            {versionB?.name || `Version ${versionB?.versionNumber ?? "—"}`} ·
                            {" "}{versionB?.generationMode} ·
                            {" "}{versionB?.configurationSnapshot?.architecturalStyle ?? "style not recorded"} ·
                            {" "}{versionB?.modelIdentifier} ·
                            {" "}{versionB?.approvedAnalysisRevision ?? "no analysis revision"}
                        </span>
                    </>
                )}
                <p>
                    Differences in generation mode, model, prompt, configuration, or approved analysis are recorded metadata—not evidence of structural fidelity.
                </p>
            </div>
        </section>
    );
};

export default RenderComparisonPanel;
