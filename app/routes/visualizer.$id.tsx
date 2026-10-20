import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router"
import { analyzeFloorPlan, generate3DView } from "../../lib/ai.action";
import { Box, Copy, Download, RefreshCcw, Share2, X } from "lucide-react";
import Button from "../../components/ui/button";
import {
    authorizeFloorPlanAnalysis,
    authorizeProjectGeneration,
    createProject,
    getProjectById,
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

const VisualizerId = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = useOutletContext<AuthContext>()
   

    const hasInitialGenerated = useRef(false);

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
        const savedAnalysis = await saveFloorPlanAnalysis(id, analysis);
        setProject((current) => current
            ? { ...current, floorPlanAnalysis: savedAnalysis }
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
        if (!id || !item.sourceImage) {
            setGenerationError("The project source image is unavailable.");
            return;
        }
        if (!userId || item.ownerId !== userId) {
            setGenerationError("Only the project owner can generate a render.");
            return;
        }

        try {
            setIsProcessing(true);
            setGenerationError(null);
            
            await authorizeProjectGeneration(id);

            const aiStartTime = performance.now();
            let aiStatus = "FAILED";
            let result: Awaited<ReturnType<typeof generate3DView>>;

            try {
            result = await generate3DView({
                sourceImage: item.sourceImage
            });

            if (!result.renderedImage) {
                throw new Error(
                "The AI service returned no render. Please try again."
                );
            }

            aiStatus = "SUCCESS";
            } finally {
            const aiDurationMs = performance.now() - aiStartTime;

            console.info(
                `[ARCHVISION_METRIC] AI generation: ${aiDurationMs.toFixed(2)} ms | Status: ${aiStatus}`
            );
        }

            const updatedItem = {
                ...item,
                renderedImage: result.renderedImage,
                renderedPath: result.renderedPath,
                timestamp: Date.now(),
                ownerId: item.ownerId,
                isPublic: item.isPublic ?? false,
            };
            const saved = await createProject({
                item: updatedItem,
                visibility: item.isPublic ? "public" : "private",
            });
            if (!saved) throw new Error("The render was generated but could not be saved.");

            setProject(saved);
            setCurrentImage(saved.renderedImage || result.renderedImage);
        } catch (error) {
            console.error("AI generation failed:", error);
            setGenerationError(
                error instanceof Error
                    ? error.message
                    : "AI generation failed. Please try again.",
            );
        } finally {
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
    void runGeneration(project);
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
                            {project && canGenerateProject && (
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
export default VisualizerId