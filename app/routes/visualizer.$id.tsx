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
    createProject,
    getProjectById,
    markProjectGenerationFailed,
    saveFloorPlanAnalysis,
    saveRenderConfiguration,
    shareProject,
    unshareProject,
} from "../../lib/puter.action";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";
import FloorPlanAnalysisPanel from "../../components/FloorPlanAnalysisPanel";
import type { FloorPlanAnalysis } from "../../lib/floor-plan-analysis";
import ArchitecturalDesignSettingsPanel from "../../components/ArchitecturalDesignSettingsPanel";
import type { RenderConfiguration } from "../../lib/render-configuration";
import { isRenderConfiguration } from "../../lib/render-configuration";
import {
    getEnhancedGenerationReadiness,
    isGenerationInProgress,
    shouldAutomaticallyGenerate,
} from "../../lib/generation-workflow";
import type { GenerationMetadata, GenerationMode } from "../../lib/generation-types";
import { ENHANCED_PROMPT_TEMPLATE_VERSION } from "../../lib/generation-prompt";

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
    const canGenerateProject = Boolean(
        project?.ownerId && userId && project.ownerId === userId,
    );
    const canUnshareProject = project?.isPublic && project.ownerId === userId;

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

    const handleExport = async () => {
        if (!currentImage) return;

        let downloadUrl: string | null = null;

        try {
            const response = await fetch(currentImage);
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
            link.download = `${safeName || 'ArchVision'}-render.${extension}`;
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

    const runGeneration = async (item: DesignItem) => {
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
        const generationMode: GenerationMode = item.generationMode ?? "baseline";
        if (item.renderedImage) {
            setGenerationError("This project already has a render. Existing renders are not overwritten.");
            return;
        }
        if (generationMode === "enhanced") {
            const readiness = getEnhancedGenerationReadiness(
                item.floorPlanAnalysis,
                item.renderConfiguration,
                true,
                Boolean(item.renderedImage),
            );
            if (!readiness.ready) {
                setGenerationError(readiness.missingPrerequisites.join(" "));
                return;
            }
        }

        generationRequestInFlight.current = true;
        let authorizedTimestamp: string | null = null;
        let activeMetadata: GenerationMetadata | null = null;
        try {
            setIsProcessing(true);
            setGenerationError(null);
            
            const authorization = await authorizeProjectGeneration(id);
            authorizedTimestamp = authorization.generationTimestamp;
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

            const completedMetadata: GenerationMetadata = {
                ...result.generationMetadata,
                generationMode: authorization.generationMode,
                modelIdentifier: GENERATION_MODEL_IDENTIFIER,
                promptTemplateVersion: authorization.generationMode === "baseline"
                    ? "archvision-baseline-v1"
                    : ENHANCED_PROMPT_TEMPLATE_VERSION,
                configurationSnapshot: authorization.configuration ?? null,
                approvedAnalysisRevision: authorization.approvedAnalysisRevision,
                generationTimestamp: authorization.generationTimestamp,
                generationStatus: "complete",
                generationLatencyMs: result.generationMetadata.generationLatencyMs,
            };
            const updatedItem = {
                ...item,
                renderedImage: result.renderedImage,
                renderedPath: result.renderedPath,
                generationMode: authorization.generationMode,
                generationMetadata: completedMetadata,
                approvedAnalysisRevision: authorization.approvedAnalysisRevision ?? item.approvedAnalysisRevision,
                timestamp: Date.now(),
                ownerId: item.ownerId,
                isPublic: item.isPublic ?? false,
            };
            const saveCompletedRender = async (candidate: typeof updatedItem) => {
                const saved = await createProject({
                    item: candidate,
                    visibility: item.isPublic ? "public" : "private",
                });
                if (saved) return saved;

                const refreshedProject = await getProjectById({ id });
                if (!refreshedProject || refreshedProject.renderedImage) return null;

                const refreshedMetadata: GenerationMetadata = refreshedProject.generationMetadata
                    ? {
                        ...candidate.generationMetadata,
                        generationTimestamp: refreshedProject.generationMetadata.generationTimestamp,
                        generationStatus: "complete",
                        generationMode: refreshedProject.generationMetadata.generationMode ?? candidate.generationMetadata.generationMode,
                        configurationSnapshot: refreshedProject.generationMetadata.configurationSnapshot ?? candidate.generationMetadata.configurationSnapshot,
                        approvedAnalysisRevision: refreshedProject.generationMetadata.approvedAnalysisRevision ?? candidate.generationMetadata.approvedAnalysisRevision,
                        modelIdentifier: refreshedProject.generationMetadata.modelIdentifier || candidate.generationMetadata.modelIdentifier,
                        promptTemplateVersion: refreshedProject.generationMetadata.promptTemplateVersion || candidate.generationMetadata.promptTemplateVersion,
                        generationLatencyMs: refreshedProject.generationMetadata.generationLatencyMs ?? candidate.generationMetadata.generationLatencyMs,
                    }
                    : candidate.generationMetadata;

                return createProject({
                    item: {
                        ...candidate,
                        generationMetadata: refreshedMetadata,
                    },
                    visibility: item.isPublic ? "public" : "private",
                });
            };
            const saved = await saveCompletedRender(updatedItem);
            if (!saved) throw new Error("The render was generated but could not be saved.");

            setProject(saved);
            setCurrentImage(saved.renderedImage || result.renderedImage);
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

      setProject(fetchedProject);
      setCurrentImage(fetchedProject?.renderedImage || null);
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
      setCurrentImage(project.renderedImage);
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
                                onClick={handleExport}
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
                                    !currentImage ||
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
                                        : "Share"}

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
                    {project && !project.renderedImage && !canGenerateProject && (
                        <p role="status" className="note">
                            Sign in as the project owner to generate a render.
                        </p>
                    )}
                    {generationError && (
                        <div className="panel-actions">
                            <p role="alert" className="note">{generationError}</p>
                            {project && canGenerateProject &&
                                (project.generationMode ?? "baseline") === "baseline" &&
                                project.generationMetadata?.generationStatus !== "failed" &&
                                !isGenerationInProgress(project.generationMetadata) && (
                                <Button
                                    size="sm"
                                    onClick={() => void runGeneration(project)}
                                    disabled={isProcessing}
                                >
                                    Retry generation
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
                                {project.generationMode === "enhanced" ? "Enhanced generation" : "Baseline generation"}
                            </h2>
                            <p>
                                {project.generationMode === "enhanced"
                                    ? "The source plan, approved structural findings, and saved design preferences guide this conceptual render."
                                    : "Uses the original fixed-prompt image-generation pipeline. Baseline behavior is unchanged."}
                            </p>
                        </div>
                        {project.generationMode === "enhanced" ? (
                            <EnhancedGenerationReadiness
                                project={project}
                                isOwner={canGenerateProject}
                                isProcessing={isProcessing}
                                onGenerate={() => void runGeneration(project)}
                            />
                        ) : (
                            <>
                            <p className="generation-workflow-state" role="status">
                                {project.generationMetadata?.generationStatus === "complete"
                                    ? "Baseline render complete."
                                    : isGenerationInProgress(project.generationMetadata)
                                        ? "Baseline generation is in progress in another session."
                                    : project.generationMetadata?.generationStatus === "failed"
                                        ? "The last baseline request failed. Use Retry generation above."
                                        : "Baseline projects render automatically when opened by their owner."}
                            </p>
                            {canGenerateProject &&
                                !project.renderedImage &&
                                (project.generationMetadata?.generationStatus === "failed" ||
                                    (project.generationMetadata?.generationStatus === "generating" &&
                                        !isGenerationInProgress(project.generationMetadata))) && (
                                    <Button
                                        size="sm"
                                        onClick={() => void runGeneration(project)}
                                        disabled={isProcessing}
                                    >
                                        Retry baseline generation
                                    </Button>
                                )}
                            </>
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

                <div className="panel compare">
                    <div className="panel-header">
                        <div className="panel-meta">
                            <p>Comparison</p>
                            <h3>Before and After</h3>

                        </div>
                        <div className="hint">Drag to compare</div>
                    </div>

                    <div className="compare-stage">
                        {project?.sourceImage && currentImage ? (
                            <ReactCompareSlider
                                defaultValue={50}
                                style={{ width: '100%', height: 'auto' }}
                                itemOne={
                                    <ReactCompareSliderImage src={project?.sourceImage} alt="before"
                                    className="compare-img" />
                                }
                                 itemTwo={
                                    <ReactCompareSliderImage src={currentImage} alt="after"
                                    className="compare-img" />
                                }
                            />
                        ) : (
                            <div className="compare-fallback">
                                {project?.sourceImage && (
                                    <img src={project.sourceImage} alt="Before" className="compare-img" />
                                )}

                            </div>
                        )}

                    </div>

                </div>

            </section>
           
        </div>
       
    )
}

const EnhancedGenerationReadiness = ({
    project,
    isOwner,
    isProcessing,
    onGenerate,
}: {
    project: DesignItem;
    isOwner: boolean;
    isProcessing: boolean;
    onGenerate: () => void;
}) => {
    const readiness = getEnhancedGenerationReadiness(
        project.floorPlanAnalysis,
        project.renderConfiguration,
        isOwner,
        Boolean(project.renderedImage),
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
                ? "Enhanced render complete."
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
            {isOwner && !project.renderedImage && (
                <Button
                    size="sm"
                    onClick={onGenerate}
                    disabled={!readiness.ready || isProcessing ||
                        isGenerationInProgress(project.generationMetadata)}
                >
                    {isProcessing
                        ? "Generating..."
                        : isGenerationInProgress(project.generationMetadata)
                            ? "Generation in progress"
                        : project.generationMetadata?.generationStatus === "failed"
                            ? "Retry enhanced generation"
                            : "Start enhanced generation"}
                </Button>
            )}
        </div>
    );
};

export default VisualizerId;