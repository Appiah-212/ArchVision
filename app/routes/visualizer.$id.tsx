import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext, useParams } from "react-router"
import { generate3DView } from "../../lib/ai.action";
import { Box, Download, RefreshCcw, Share2, X } from "lucide-react";
import Button from "../../components/ui/button";
import { createProject, getProjectById } from "../../lib/puter.action";
import { ReactCompareSlider, ReactCompareSliderImage } from "react-compare-slider";

const VisualizerId = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { userId } = useOutletContext<AuthContext>()
   

    const hasInitialGenerated = useRef(false);

    const [project, setProject] = useState<DesignItem | null>(null);
    const [isProjectLoading, setIsProjectLoading] = useState(true);

    const [isProcessing, setIsProcessing] = useState(false);
    const [currentImage, setCurrentImage] = useState<string | null>(null);

    const handleBack = () =>navigate('/');

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

    const runGeneration = async (item: DesignItem) => {
        if(!id || !item.sourceImage) return;

        try {
            setIsProcessing(true);
            const result = await generate3DView({ sourceImage: item.sourceImage });

            if(result.renderedImage) {
                setCurrentImage(result.renderedImage);

                const updatedItem = {
                    ...item,
                    renderedImage: result.renderedImage,
                    renderedPath: result.renderedPath,
                    timestamp: Date.now(),
                    ownerId: item.ownerId ?? userId ?? null,
                    isPublic: item.isPublic ?? false,
                }

                const saved = await createProject({ item: updatedItem, visibility: "private"})

                if (saved) {
                    setProject(saved);
                    setCurrentImage(saved.renderedImage || result.renderedImage);
                }
            }
        } catch (error) {
            console.error('Generation failed: ', error)
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
      !project?.sourceImage
    )
      return;

    if (project.renderedImage) {
      setCurrentImage(project.renderedImage);
      hasInitialGenerated.current = true;
      return;
    }

    hasInitialGenerated.current = true;
    void runGeneration(project);
  }, [project, isProjectLoading]);
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
                            <p className="note">Created by You</p>

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

                            <Button size="sm" onClick={() => {}} className="share">
                                <Share2 className="w-4 h-4 mr-2" /> Share

                            </Button>

                        </div>
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

                </div>

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
                                style={{ width: '100%', height: 'autho' }}
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