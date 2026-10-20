import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router"
import {
    analyzeFloorPlan,
    generate3DView,
    GENERATION_MODEL_IDENTIFIER,
} from "../../lib/ai.action";
import { Box, Copy, Download, RefreshCcw, Share2, X } from "lucide-react";
import Button from "../../components/ui/button";
import {
    authorizeFloorPlanAnalysis,
    authorizeProjectGeneration,
    commitRenderVersion,
    deleteUncommittedRenderVersionAsset,
    getProjectById,
    markProjectGenerationFailed,
    saveFloorPlanAnalysis,
    saveRenderConfiguration,
    shareProject,
    setActiveRenderVersion,
    updateRenderVersionDetails,
    uploadRenderVersionAsset,
    unshareProject,
} from "../../lib/puter.action";
import FloorPlanAnalysisPanel from "../../components/FloorPlanAnalysisPanel";
import type { FloorPlanAnalysis } from "../../lib/floor-plan-analysis";
import ArchitecturalDesignSettingsPanel from "../../components/ArchitecturalDesignSettingsPanel";
import GenerationModeSelector from "../../components/GenerationModeSelector";
import RenderComparisonPanel from "../../components/RenderComparisonPanel";
import RenderHistoryPanel from "../../components/RenderHistoryPanel";
import type { RenderConfiguration } from "../../lib/render-configuration";
import { isRenderConfiguration } from "../../lib/render-configuration";
import {
    getEnhancedGenerationReadiness,
    isGenerationInProgress,
    shouldAutomaticallyGenerate,
} from "../../lib/generation-workflow";
import type { GenerationMetadata, GenerationMode } from "../../lib/generation-types";
import { ENHANCED_PROMPT_TEMPLATE_VERSION } from "../../lib/generation-prompt";
import { getRenderVersions } from "../../lib/render-version";

const VisualizerId = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = useOutletContext<AuthContext>()
   

    const hasInitialGenerated = useRef(false);
    const generationRequestInFlight = useRef(false);

    const [project, setProject] = useState<DesignItem | null>(null);
    const [isProjectLoading, setIsProjectLoading] = useState(true);

    const [isProcessing, setIsProcessing] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const [isSharing, setIsSharing] = useState(false);
    const [sharingMessage, setSharingMessage] = useState("");
    const [shareUrl, setShareUrl] = useState("");
    const [currentImage, setCurrentImage] = useState<string | null>(null);
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
    const [selectedGenerationMode, setSelectedGenerationMode] =
        useState<GenerationMode>("baseline");
    const [isVersionSaving, setIsVersionSaving] = useState(false);
    const [versionMessage, setVersionMessage] = useState("");
    const [isVersionMessageError, setIsVersionMessageError] = useState(false);
    const canGenerateProject = Boolean(
        project?.ownerId && userId && project.ownerId === userId,
    );
    const canUnshareProject = project?.isPublic && project.ownerId === userId;
    const renderVersions = project ? getRenderVersions(project) : [];
    const selectedVersion = renderVersions.find(
        ({ id: versionId }) => versionId === selectedVersionId,
    ) ?? null;
    const activeRenderImage = project
        ? project.renderVersionImages?.[project.activeRenderVersionId ?? ""] ??
            project.renderedImage ??
            null
        : null;

    const handleBack = () =>navigate('/');

    const handleAnalyzeFloorPlan = async (): Promise<FloorPlanAnalysis> => {
        if (!id || !project?.sourceImage) {
            throw new Error("The project source image is unavailable.");
        }
        if (!canGenerateProject) {
            throw new Error("Only the project owner can analyze this floor plan.");
        }
        await authorizeFloorPlanAnalysis(id);
        return analyzeFloorPlan(project.sourceImage);
    };

    const handleApproveAnalysis = async (analysis: FloorPlanAnalysis) => {
        if (!id || !project || !canGenerateProject) {
            throw new Error("Only the project owner can save this floor-plan analysis.");
        }
        const saved = await saveFloorPlanAnalysis(id, analysis);
        setProject((current) => current
            ? {
                ...current,
                floorPlanAnalysis: saved.analysis,
                approvedAnalysisRevision: saved.approvedAnalysisRevision,
            }
            : current);
    };

    const handleSaveRenderConfiguration = async (
        configuration: RenderConfiguration,
    ): Promise<RenderConfiguration> => {
        if (!id || !project || !canGenerateProject) {
            throw new Error("Only the project owner can save design settings.");
        }
        const savedConfiguration = await saveRenderConfiguration(id, configuration);
        setProject((current) => current
            ? { ...current, renderConfiguration: savedConfiguration }
            : current);
        return savedConfiguration;
    };

    const handleExport = async (
        imageSource = currentImage,
        versionNumber?: number,
    ) => {
        if (!imageSource) return;

        let downloadUrl: string | null = null;

        try {
            const response = await fetch(imageSource);
            if (!response.ok) {
                throw new Error(`Image download failed: ${response.status} ${response.statusText}`);
            }

            const image = await response.blob();
            const extension = image.type === 'image/jpeg'
                ? 'jpg'
                : image.type === 'image/webp'
                    ? 'webp'
                    : 'png';
            const projectName = project?.name || `Residence ${id || 'render'}`;
            const safeName = projectName.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_').trim();
            const link = document.createElement('a');

            downloadUrl = URL.createObjectURL(image);
            link.href = downloadUrl;
            const versionSuffix = versionNumber ? `-version-${versionNumber}` : "";
            link.download = `${safeName || 'ArchVision'}-render${versionSuffix}.${extension}`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            const objectUrl = downloadUrl;
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
            downloadUrl = null;
        } catch (error) {
            console.error('Failed to export rendered image:', error);
            window.alert('Unable to download the rendered image. Please try again.');
        } finally {
            if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        }
    };

    const handleToggleShare = async () => {
        if (!id || !project || isSharing) return;

        setIsSharing(true);
        setSharingMessage("");

        try {
            const updatedProject = project.isPublic
                ? await unshareProject(id)
                : await shareProject(id);
            setProject(updatedProject);
            setShareUrl(updatedProject.isPublic
                ? new URL(`/visualizer/${encodeURIComponent(id)}`, window.location.origin).toString()
                : "");
            setSharingMessage(updatedProject.isPublic
                ? "Project is now public."
                : "Project is now private.");
        } catch (error) {
            console.error("Failed to update project sharing:", error);
            setSharingMessage(error instanceof Error
                ? error.message
                : "Unable to update project sharing.");
        } finally {
            setIsSharing(false);
        }
    };

    const handleCopyShareLink = async () => {
        if (!shareUrl) return;

        try {
            await navigator.clipboard.writeText(shareUrl);
            setSharingMessage("Share link copied to clipboard.");
        } catch (error) {
            console.error("Failed to copy project share link:", error);
            setSharingMessage("Unable to copy the share link. Please copy it from the address bar.");
        }
    };

    const runGeneration = async (
        item: DesignItem,
        requestedMode: GenerationMode = selectedGenerationMode,
    ) => {
        if (generationRequestInFlight.current) return;
        if (!id || !item.sourceImage) {
            setGenerationError("The project source image is unavailable.");
            return;
        }
        if (isGenerationInProgress(item.generationMetadata)) {
            setGenerationError("A generation request is already in progress for this project.");
            return;
        }
        if (!userId || item.ownerId !== userId) {
            setGenerationError("Only the project owner can generate a render.");
            return;
        }
        const generationMode = requestedMode;
        if (generationMode === "enhanced") {
            const readiness = getEnhancedGenerationReadiness(
                item.floorPlanAnalysis,
                item.renderConfiguration,
                true,
            );
            if (!readiness.ready) {
                setGenerationError(readiness.missingPrerequisites.join(" "));
                return;
            }
        }

        generationRequestInFlight.current = true;
        let authorizedTimestamp: string | null = null;
        let authorizedVersionId: string | null = null;
        let activeMetadata: GenerationMetadata | null = null;
        try {
            setIsProcessing(true);
            setGenerationError(null);
            
            const authorization = await authorizeProjectGeneration(id, generationMode);
            authorizedTimestamp = authorization.generationTimestamp;
            authorizedVersionId = authorization.versionId;
            const startingMetadata: GenerationMetadata = {
                generationMode: authorization.generationMode,
                modelIdentifier: GENERATION_MODEL_IDENTIFIER,
                promptTemplateVersion: authorization.generationMode === "baseline"
                    ? "archvision-baseline-v1"
                    : ENHANCED_PROMPT_TEMPLATE_VERSION,
                configurationSnapshot: authorization.configuration ?? null,
                approvedAnalysisRevision: authorization.approvedAnalysisRevision,
                generationTimestamp: authorization.generationTimestamp,
                generationStatus: "generating",
                versionId: authorization.versionId,
                versionNumber: authorization.versionNumber,
            };
            activeMetadata = startingMetadata;
            setProject((current) => current
                ? { ...current, generationMetadata: startingMetadata }
                : current);

            const aiStartTime = performance.now();
            let aiStatus = "FAILED";
            let result: Awaited<ReturnType<typeof generate3DView>>;

            try {
                result = await generate3DView({
                    sourceImage: item.sourceImage,
                    generationMode: authorization.generationMode,
                    analysis: authorization.analysis,
                    configuration: authorization.configuration,
                    approvedAnalysisRevision: authorization.approvedAnalysisRevision,
                    generationTimestamp: authorization.generationTimestamp,
                });

                if (!result.renderedImage) {
                    throw new Error("The AI service returned no render. Please try again.");
                }

                aiStatus = "SUCCESS";
            } finally {
                const aiDurationMs = performance.now() - aiStartTime;
                console.info(
                    `[ARCHVISION_METRIC] AI generation: ${aiDurationMs.toFixed(2)} ms | Status: ${aiStatus}`,
                );
            }

            const imageAssetReference = await uploadRenderVersionAsset({
                id,
                versionId: authorization.versionId,
                generationTimestamp: authorization.generationTimestamp,
                image: result.renderedImage,
            });
            const generationLatencyMs = result.generationMetadata.generationLatencyMs ??
                Math.max(0, Math.round(performance.now() - aiStartTime));
            try {
                const saved = await commitRenderVersion({
                    id,
                    versionId: authorization.versionId,
                    generationTimestamp: authorization.generationTimestamp,
                    imageAssetReference,
                    generationLatencyMs,
                });
                setProject(saved.project);
                setSelectedVersionId(saved.version.id);
                setCurrentImage(
                    saved.project.renderVersionImages?.[saved.version.id] ??
                    result.renderedImage,
                );
                setVersionMessage(`Version ${saved.version.versionNumber} was saved.`);
                setIsVersionMessageError(false);
            } catch (commitError) {
                const refreshedProject = await getProjectById({ id });
                const committedVersion = refreshedProject?.renderVersions?.find(
                    ({ id: versionId }) => versionId === authorization.versionId,
                );
                if (refreshedProject && committedVersion) {
                    setProject(refreshedProject);
                    setSelectedVersionId(committedVersion.id);
                    setCurrentImage(
                        refreshedProject.renderVersionImages?.[committedVersion.id] ??
                        result.renderedImage,
                    );
                    setVersionMessage(`Version ${committedVersion.versionNumber} was saved.`);
                    setIsVersionMessageError(false);
                    return;
                }
                try {
                    await deleteUncommittedRenderVersionAsset({
                        id,
                        versionId: authorization.versionId,
                        generationTimestamp: authorization.generationTimestamp,
                        imageAssetReference,
                    });
                } catch (cleanupError) {
                    console.error("Failed to clean up the uncommitted render image:", cleanupError);
                }
                throw commitError;
            }
        } catch (error) {
            if (authorizedTimestamp) {
                try {
                    await markProjectGenerationFailed(id, authorizedTimestamp);
                    setProject((current) => current
                        ? {
                            ...current,
                            generationMetadata: activeMetadata
                                ? { ...activeMetadata, generationStatus: "failed" }
                                : current.generationMetadata,
                        }
                        : current);
                } catch (persistenceError) {
                    console.error("Failed to record generation failure:", persistenceError);
                }
            }
            console.error("AI generation failed:", error);
            setGenerationError(
                error instanceof Error
                    ? error.message
                    : "AI generation failed. Please try again.",
            );
        } finally {
            generationRequestInFlight.current = false;
            setIsProcessing(false);
        }
    }

    const handleSelectVersion = (versionId: string) => {
        setGenerationError(null);
        setSelectedVersionId(versionId);
        const image = project?.renderVersionImages?.[versionId];
        if (!image) {
            setGenerationError("This private render image is unavailable.");
            return;
        }
        setCurrentImage(image);
    };

    const handleSetActiveVersion = async (versionId: string) => {
        if (!id || !canGenerateProject || isVersionSaving) return;
        setIsVersionSaving(true);
        setVersionMessage("");
        setIsVersionMessageError(false);
        try {
            const updated = await setActiveRenderVersion(id, versionId);
            setProject(updated);
            setSelectedVersionId(versionId);
            setCurrentImage(
                updated.renderVersionImages?.[versionId] ??
                    updated.renderedImage ??
                    null,
            );
            setVersionMessage("Active render updated. No AI generation was started.");
            setIsVersionMessageError(false);
        } catch (error) {
            console.error("Failed to activate render version:", error);
            setVersionMessage(error instanceof Error
                ? error.message
                : "Unable to update the active render.");
            setIsVersionMessageError(true);
        } finally {
            setIsVersionSaving(false);
        }
    };

    const handleSaveVersionDetails = async (
        versionId: string,
        name: string,
        notes: string,
    ) => {
        if (!id || !canGenerateProject || isVersionSaving) {
            throw new Error("Only the project owner can edit render version details.");
        }
        setIsVersionSaving(true);
        setVersionMessage("");
        setIsVersionMessageError(false);
        try {
            const updated = await updateRenderVersionDetails(id, versionId, { name, notes });
            setProject(updated);
            setVersionMessage("Render version details saved.");
            setIsVersionMessageError(false);
        } catch (error) {
            console.error("Failed to update render version details:", error);
            setIsVersionMessageError(true);
            throw error;
        } finally {
            setIsVersionSaving(false);
        }
    };

    const handleGenerateSelectedMode = () => {
        if (project) void runGeneration(project, selectedGenerationMode);
    };

    const handleExportSelectedVersion = () => {
        if (!selectedVersion) return;
        const selectedImage = project?.renderVersionImages?.[selectedVersion.id] ??
            (selectedVersion.id === project?.activeRenderVersionId
                ? project.renderedImage
                : null);
        void handleExport(selectedImage, selectedVersion.versionNumber);
    };

   useEffect(() => {
    let isMounted = true;

    const loadProject = async () => {
      if (!id) {
        setIsProjectLoading(false);
        return;
      }

      setIsProjectLoading(true);

      const fetchedProject = await getProjectById({ id });

      if (!isMounted) return;

      const versions = fetchedProject ? getRenderVersions(fetchedProject) : [];
      const selectedId = fetchedProject?.activeRenderVersionId ??
        versions[versions.length - 1]?.id ??
        null;
      setProject(fetchedProject);
      setSelectedVersionId(selectedId);
      setSelectedGenerationMode(
        versions.find(({ id: versionId }) => versionId === selectedId)?.generationMode ??
            fetchedProject?.generationMode ??
            "baseline",
      );
      setCurrentImage(
        (selectedId && fetchedProject?.renderVersionImages?.[selectedId]) ||
            fetchedProject?.renderedImage ||
            null,
      );
      setVersionMessage("");
      setIsVersionMessageError(false);
      setGenerationError(null);
      setShareUrl(fetchedProject?.isPublic
        ? new URL(`/visualizer/${encodeURIComponent(id)}`, window.location.origin).toString()
        : "");
      setIsProjectLoading(false);
      hasInitialGenerated.current = false;
    };

    loadProject();

    return () => {
      isMounted = false;
    };
  }, [id]);

  useEffect(() => {
    if (
      isProjectLoading ||
      hasInitialGenerated.current ||
      !project?.sourceImage ||
      !canGenerateProject
    )
      return;

    if (project.renderedImage) {
      const activeVersionId = project.activeRenderVersionId ?? selectedVersionId;
      setCurrentImage(
        (activeVersionId && project.renderVersionImages?.[activeVersionId]) ||
            project.renderedImage,
      );
      hasInitialGenerated.current = true;
      return;
    }

    hasInitialGenerated.current = true;
    if (shouldAutomaticallyGenerate(project)) {
        void runGeneration(project);
    }
  }, [project, isProjectLoading, canGenerateProject]);
    return (
                    
        <div className="visualizer">
            <nav className="topbar">
                <div className="brand">
                    <Box className="logo" />
                    <span className="name">ArchVision</span>
                </div>
                <Button variant = "ghost" size = "sm" onClick={handleBack}
                 className="exit">
                    <X className="icon" /> Exit Editor

                </Button>

            </nav>

            <section className="content">
                {!project && !isProjectLoading && (
                    <p role="alert" className="note">
                        The project could not be loaded. It may not exist or may be private to another owner.
                    </p>
                )}
                <div className="panel">

                    <div className="panel-header">
                        <div className="panel-meta">
                            <p>Project</p>
                            <h2>{project?.name || `Residence ${id}`}</h2>
                            <p className="note">
                                {project?.isPublic
                                    ? `Shared by ${project.sharedBy || "Unknown user"}`
                                    : "Created by You"}
                            </p>

                        </div>

                        <div className="panel-actions">
                            <Button
                                size="sm"
                                onClick={() => void handleExport()}
                                className="export"
                                disabled={!currentImage}
                            >
                                <Download className="w-4 h-4 mr-2" /> Export
                            </Button>

                            <Button
                                size="sm"
                                onClick={handleToggleShare}
                                className="share"
                                disabled={
                                    !project ||
                                    !activeRenderImage ||
                                    isProjectLoading ||
                                    isProcessing ||
                                    isSharing ||
                                    (project.isPublic && !canUnshareProject)
                                }
                            >
                                <Share2 className="w-4 h-4 mr-2" />
                                {isSharing
                                    ? "Updating..."
                                    : project?.isPublic
                                        ? canUnshareProject ? "Unshare" : "Shared"
                                        : "Share active render"}

                            </Button>

                        </div>
                        {sharingMessage && (
                            <p role="status" className="note">{sharingMessage}</p>
                        )}
                        {project?.isPublic && canUnshareProject && shareUrl && (
                            <Button size="sm" variant="outline" onClick={handleCopyShareLink}>
                                <Copy className="w-4 h-4 mr-2" /> Copy share link
                            </Button>
                        )}
                    </div>

                    <div className={`render-area ${isProcessing ? 'is-processing' : 
                     ''}`}>
                        {currentImage ? (
                            <img src={currentImage} alt="AI Render" className="render-img" />
                        ) : (
                            <div className="render-placeholder">
                                {project?.sourceImage && (
                                    <img src={project?.sourceImage} alt="Original"
                                    className="render-fallback" />
                                )}
                            </div>
                        )}

                        {isProcessing && (
                            <div className="render-overlay">
                                <div className="rendering-card">
                                    <RefreshCcw className="spinner" />
                                    <span className="title">Rendering...</span>
                                    <span className="subtitle">Generating your 3D visualization</span>
                                </div>

                            </div>
                        )}

                    </div>
                    {project && renderVersions.length === 0 && !canGenerateProject && (
                        <p role="status" className="note">
                            Sign in as the project owner to generate a render.
                        </p>
                    )}
                    {generationError && (
                        <div className="panel-actions">
                            <p role="alert" className="note">{generationError}</p>
                            {project && canGenerateProject &&
                                !isGenerationInProgress(project.generationMetadata) && (
                                <Button
                                    size="sm"
                                    onClick={handleGenerateSelectedMode}
                                    disabled={isProcessing}
                                >
                                    Retry selected mode
                                </Button>
                            )}
                        </div>
                    )}

                </div>

                {project && (
                    <section className="generation-workflow" aria-labelledby="generation-workflow-title">
                        <div>
                            <p className="generation-workflow-eyebrow">Generation workflow</p>
                            <h2 id="generation-workflow-title">
                                {selectedGenerationMode === "enhanced" ? "Enhanced generation" : "Baseline generation"}
                            </h2>
                            <p>
                                {selectedGenerationMode === "enhanced"
                                    ? "The source plan, approved structural findings, and saved design preferences guide this conceptual render."
                                    : "Uses the original fixed-prompt image-generation pipeline. Saved settings are recorded for research traceability but are not applied to baseline prompting."}
                            </p>
                        </div>
                        {canGenerateProject && (
                            <GenerationModeSelector
                                value={selectedGenerationMode}
                                onChange={setSelectedGenerationMode}
                            />
                        )}
                        {selectedGenerationMode === "enhanced" ? (
                            <EnhancedGenerationReadiness
                                project={project}
                                isOwner={canGenerateProject}
                                isProcessing={isProcessing}
                            />
                        ) : (
                            <p className="generation-workflow-state" role="status">
                                {renderVersions.length > 0
                                    ? `${renderVersions.length} retained render${renderVersions.length === 1 ? "" : "s"}. A new baseline version will preserve the previous renders.`
                                    : isGenerationInProgress(project.generationMetadata)
                                        ? "Baseline generation is in progress in another session."
                                    : project.generationMetadata?.generationStatus === "failed"
                                        ? "The last generation failed. You can retry or switch modes."
                                        : "New baseline projects render automatically when opened by their owner."}
                            </p>
                        )}
                        <p className="generation-workflow-disclaimer">
                            Generated images are conceptual visualizations, not verified CAD or BIM geometry.
                            Prompting does not guarantee exact structural fidelity.
                        </p>
                    </section>
                )}

                {project && (
                    <FloorPlanAnalysisPanel
                        approvedAnalysis={project.floorPlanAnalysis}
                        isOwner={canGenerateProject}
                        onAnalyze={handleAnalyzeFloorPlan}
                        onApprove={handleApproveAnalysis}
                    />
                )}

                {project && (
                    <ArchitecturalDesignSettingsPanel
                        savedConfiguration={project.renderConfiguration}
                        isOwner={canGenerateProject}
                        onSave={handleSaveRenderConfiguration}
                    />
                )}

                <RenderHistoryPanel
                    versions={renderVersions}
                    versionImages={project?.renderVersionImages ?? {}}
                    activeVersionId={project?.activeRenderVersionId ?? null}
                    selectedVersionId={selectedVersionId}
                    isOwner={canGenerateProject}
                    isLoading={isProjectLoading}
                    isGenerating={isProcessing ||
                        isGenerationInProgress(project?.generationMetadata)}
                    isSaving={isVersionSaving}
                    statusMessage={versionMessage}
                    statusIsError={isVersionMessageError}
                    onSelect={handleSelectVersion}
                    onSetActive={(versionId) => void handleSetActiveVersion(versionId)}
                    onSaveDetails={handleSaveVersionDetails}
                    onExport={handleExportSelectedVersion}
                    onGenerate={handleGenerateSelectedMode}
                />

                <RenderComparisonPanel
                    sourceImage={project?.sourceImage ?? ""}
                    versions={renderVersions}
                    versionImages={project?.renderVersionImages ?? {}}
                    selectedVersionId={selectedVersionId}
                />

            </section>
           
        </div>
       
    )
}

const EnhancedGenerationReadiness = ({
    project,
    isOwner,
    isProcessing,
}: {
    project: DesignItem;
    isOwner: boolean;
    isProcessing: boolean;
}) => {
    const readiness = getEnhancedGenerationReadiness(
        project.floorPlanAnalysis,
        project.renderConfiguration,
        isOwner,
    );
    const configuration = isRenderConfiguration(project.renderConfiguration)
        ? project.renderConfiguration
        : null;
    const status = isProcessing
        ? "Generation in progress."
        : isGenerationInProgress(project.generationMetadata)
            ? "Generation is in progress in another session."
        : project.generationMetadata?.generationStatus === "failed"
            ? "The previous enhanced request failed. Resolve any errors and retry."
            : project.generationMetadata?.generationStatus === "complete"
                    ? "Previous enhanced render complete. You can generate another version."
                : readiness.ready
                    ? "Ready to generate."
                    : "Not ready to generate.";

    return (
        <div className="generation-readiness">
            <p className="generation-workflow-state" role="status">{status}</p>
            <p>
                Floor-plan analysis: {readiness.missingPrerequisites.includes(
                    "Analyze and approve the floor-plan findings.",
                ) ? "Not approved" : "Approved"}
            </p>
            <p>
                Saved architectural style: {configuration?.architecturalStyle ?? "No valid saved settings"}
            </p>
            {!readiness.ready && (
                <ul aria-label="Missing enhanced generation prerequisites">
                    {readiness.missingPrerequisites.map((prerequisite) => (
                        <li key={prerequisite}>{prerequisite}</li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default VisualizerId;