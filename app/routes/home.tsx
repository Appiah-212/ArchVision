import { ArrowRight, ArrowUpRight, Clock, Layers, Sparkles, UploadCloud } from "lucide-react";
import Navbar from "../../components/Navbar";
import Button from "../../components/ui/button";
import type { Route } from "./+types/home";
import Upload from "../../components/Upload";
import { useNavigate } from "react-router";



export function meta({}: Route.MetaArgs) {
  return [
    { title: "ArchVision | Design-to-Render Studio" },
    { name: "description", content: "Turn rough concepts into polished 3D-ready visuals." },
  ];
}

export default function Home() {
  const navigate = useNavigate();

  const handleUploadComplete = async (base64Image: string) => {
    const newId = Date.now().toString();

    navigate(`/visualizer/${newId}`);

    return true;
  }
  return (
    <div className="home">
      <Navbar />
      <section className="hero">
        <div className="announce">
          <div className="dot">
            <div className="pulse"></div>
          </div>

          <p>NEW: Introducing ARCHVISION</p>
        </div>
        <h1>Build beautiful spaces at the speed of thought with Archvision</h1>

        <p className="subtitle">
          ARCHVISION HELPS TEAMS EXPLORE CONCEPTS, VALIDATE IDEAS, AND 
          SHIP POLISHED ARCHITECTURAL NARRATIVES FASTER.

        </p>

        <div className="actions">
          <a href="#upload" className="cta">
              Start Building <ArrowRight className="icon"/>
          </a>
          <Button variant="outline" size="lg" className="demo">
              Watch Demo
          </Button>
        </div>

        <div id="upload" className="upload-shell">
          <div className="grid-overlay"/>

            <div className="upload-card">
              <div className="upload-head">
                <div className="upload-icon">
                  <Layers className="icon"/>

                </div>
                 <h3>Upload your floor plan</h3>
                 <p>Supports JPG, PNG, formats up to 50MB</p>
              </div>

              <Upload onComplete={handleUploadComplete}/>           
            </div>
        </div>
      </section>

      <section className="projects">
        <div className="section-inner">
          <div className="section-head">
            <div className="copy">
              <h2>Projects</h2>
              <p>Your latest work and shared community projects, all in one place.</p>

            </div>
          </div>

          <div className="projects-grid">
            <div className="project-card group">
              <div className="preview">
                <img
                src="https://roomify-mlhuk267-dfwu1i.puter.site/projects/1770803585402/rendered.png"
                alt="Project"
                />

                <div className="badge">
                  <span>Community</span>
                </div>
              </div>

              <div className="card-body">
                <div>
                  <h3>Project Elbob</h3>
                  <div className="meta">
                    <Clock size={12}/>
                    <span>{new Date('2026-09-29').toLocaleDateString()}</span>
                    <span>By Kubiman</span>
                  </div>
                </div>

                <div className="arrow">
                  <ArrowUpRight size={18}/>

                </div>
              </div>
            </div>
          </div>
        </div>
      </section>     
    </div>
  );
}