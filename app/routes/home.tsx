import { ArrowRight, Sparkles, UploadCloud } from "lucide-react";
import Navbar from "../../components/Navbar";
import Button from "../../components/ui/button";
import type { Route } from "./+types/home";

const featuredProjects = [
  { name: "Northstar Villa", type: "Concept", year: "2026" },
  { name: "Aster Loft", type: "Render", year: "2025" },
  { name: "Coastal Studio", type: "Prototype", year: "2024" },
];

const partners = ["Launchpad", "Northstar", "Helio", "Meridian", "Axiom"];

export function meta({}: Route.MetaArgs) {
  return [
    { title: "ArchVision | Design-to-Render Studio" },
    { name: "description", content: "Turn rough concepts into polished 3D-ready visuals." },
  ];
}

export default function Home() {
  return (
    <div className="home">
      <Navbar />

      <main className="hero">
        <div className="announce">
          <div className="dot">
            <div className="pulse" />
          </div>
          <p>New: AI rendering with instant previews</p>
        </div>

        <h1>Turn design prompts into standout visual stories.</h1>

        <p className="subtitle">
          ArchVision helps teams explore concepts, validate ideas, and ship polished
          architectural narratives faster.
        </p>

        <div className="actions">
          <Button size="lg" className="cta">
            Get started
            <ArrowRight className="icon" />
          </Button>
          <Button variant="secondary" size="lg" className="demo">
            Watch demo
          </Button>
        </div>

        <div className="upload-shell" id="upload">
          <div className="grid-overlay" />

          <div className="upload-card">
            <div className="upload-head">
              <div className="upload-icon">
                <UploadCloud className="icon" />
              </div>
              <h3>Upload a mockup or concept</h3>
              <p>Drop a file to compare visual directions and generate refined outputs.</p>
            </div>

            <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-200 bg-zinc-50 px-4 py-3 text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
              <Sparkles className="h-4 w-4 text-primary" />
              Ready for your next render
            </div>
          </div>
        </div>
      </main>

      <section className="projects">
        <div className="section-inner">
          <div className="section-head">
            <div className="copy">
              <h2>Featured work</h2>
              <p>From early sketches to final presentation boards, every concept starts with clarity.</p>
            </div>
          </div>

          <div className="projects-grid">
            {featuredProjects.map((project) => (
              <article key={project.name} className="project-card group">
                <div className="preview">
                  <div className="badge">
                    <span>{project.type}</span>
                  </div>
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-orange-100 via-white to-blue-100 text-2xl font-serif text-zinc-700">
                    {project.name.slice(0, 1)}
                  </div>
                </div>

                <div className="card-body">
                  <div>
                    <h3>{project.name}</h3>
                    <div className="meta">
                      <span>{project.type}</span>
                      <span>{project.year}</span>
                    </div>
                  </div>
                  <div className="arrow">
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="partners">
        <div className="section-inner">
          <div className="logos" aria-label="Partner brands">
            {partners.map((partner) => (
              <div key={partner} className="logo-item">
                <div>
                  <span>{partner}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}