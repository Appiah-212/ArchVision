# Welcome to React Router!

A modern, production-ready template for building full-stack React applications using React Router.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/remix-run/react-router-templates/tree/main/default)

## Features

- 🚀 Server-side rendering
- ⚡️ Hot Module Replacement (HMR)
- 📦 Asset bundling and optimization
- 🔄 Data loading and mutations
- 🔒 TypeScript by default
- 🎉 TailwindCSS for styling
- 📖 [React Router docs](https://reactrouter.com/)

## Getting Started

### Installation

Install the dependencies:

```bash
npm install
```

### Development

Start the development server with HMR:

```bash
npm run dev
```

Your application will be available at `http://localhost:5173`.

## Building for Production

Create a production build:

```bash
npm run build
```

## Deployment

### Docker Deployment

To build and run using Docker:

```bash
docker build -t my-app .

# Run the container
docker run -p 3000:3000 my-app
```

The containerized application can be deployed to any platform that supports Docker, including:

- AWS ECS
- Google Cloud Run
- Azure Container Apps
- Digital Ocean App Platform
- Fly.io
- Railway

### DIY Deployment

If you're familiar with deploying Node applications, the built-in app server is production-ready.

Make sure to deploy the output of `npm run build`

```
├── package.json
├── package-lock.json (or pnpm-lock.yaml, or bun.lockb)
├── build/
│   ├── client/    # Static assets
│   └── server/    # Server-side code
```

## Styling

This template comes with [Tailwind CSS](https://tailwindcss.com/) already configured for a simple default starting experience. You can use whatever CSS framework you prefer.

## AI floor-plan analysis

On a project page, the owner can explicitly request a multimodal interpretation of the uploaded floor plan. When requested, the image is sent to Puter AI (Gemini 2.5 Flash) for structured findings on rooms, possible room functions, doors, windows, walls, spatial relationships, evidence, confidence estimates, and uncertainties. The application validates this response before presenting it for review.

Owners can edit the draft and must select **Approve and save** to persist it. The approved analysis is stored with the owner's private project record; it is not included in the public shared-project copy. Analysis requests use the existing daily AI usage quota. Existing projects without an analysis remain valid.

This is an AI-assisted conceptual interpretation, not verified CAD/BIM geometry or a substitute for professional review. Findings may be uncertain or unidentifiable, and the interface exposes those uncertainties for review.

## Architectural design settings (Phase 2.2)

The project visualizer includes owner-editable design controls for architectural style, flooring, wall finish, color palette, lighting, furniture, visualization perspective, and optional additional instructions. Settings are changed locally until **Save settings** is selected. **Reset to defaults** resets the draft; save it separately to persist those defaults. The panel reports saved and unsaved state and validates required custom values before saving.

The data-driven presets are defined in `lib/render-configuration.ts`:

| Preset | Floor | Walls | Palette | Lighting | Furniture | Perspective | Default aesthetic direction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Modern | Hardwood | Painted plaster | Neutral | Natural daylight | Modern | Top-down 3D-style view | Clean contemporary lines, balanced contrast, and refined natural finishes |
| Contemporary | Hardwood | Painted plaster | Warm earth tones | Natural daylight | Contemporary | Angled architectural view | Current, comfortable design with polished and tactile materials |
| Minimalist | Concrete | Painted plaster | Monochrome | Bright studio | Minimalist | Top-down 3D-style view | Restrained forms, uncluttered rooms, and a quiet monochrome palette |
| Scandinavian | Hardwood | Painted plaster | Natural | Natural daylight | Scandinavian | Isometric view | Light timber, soft natural colors, and functional furnishings |
| Industrial | Concrete | Exposed brick | Monochrome | Bright studio | Modern | Angled architectural view | Expressive structural materials, tactile surfaces, and practical lighting |
| Mediterranean | Ceramic tile | Stone | Warm earth tones | Natural daylight | Traditional | Isometric view | Sun-warmed surfaces, earthy colors, and natural stone accents |
| Traditional | Hardwood | Wood paneling | Warm earth tones | Warm ambient | Traditional | Angled architectural view | Timeless detailing, warm materials, and familiar furniture arrangements |
| Custom | Hardwood | Painted plaster | Neutral | Natural daylight | Modern | Top-down 3D-style view | A starting point for individually selected materials, colors, and lighting |

Each preset supplies sensible defaults for all aesthetic controls. The other available choices are:

- **Floor material:** Hardwood, Ceramic tile, Marble, Concrete, Vinyl, or Custom.
- **Wall finish:** Painted plaster, Exposed brick, Concrete, Wood paneling, Stone, or Custom.
- **Color palette:** Neutral, Warm earth tones, Cool tones, Monochrome, Natural, or Custom.
- **Lighting:** Natural daylight, Warm ambient, Bright studio, Evening atmosphere, or Custom.
- **Furniture:** Modern, Minimalist, Scandinavian, Traditional, Contemporary, or Custom.
- **Perspective:** Top-down 3D-style view, Isometric view, or Angled architectural view.

### Configuration schema and validation

`RenderConfiguration` is a runtime-validated TypeScript model with `schemaVersion`, `architecturalStyle`, `flooringMaterial`, `wallFinish`, `colorPalette`, `lighting`, `furnitureStyle`, `perspective`, `customInstructions`, `customValues`, and `updatedAt`. `customValues` stores the user's descriptions when a control is set to Custom; each description is required for its selected Custom option and limited to 100 characters. `customInstructions` is optional and limited to 500 characters. The centralized option lists and schema version are checked on the client and independently on the trusted Worker; unknown fields and unsupported options are rejected.

Safe defaults are Modern style, Hardwood flooring, Painted plaster walls, Neutral palette, Natural daylight, Modern furniture, and a Top-down 3D-style view. Switching a style preset applies its complete documented set of defaults and clears prior custom-value overrides.

### Persistence, privacy, and compatibility

Saving calls the authenticated Puter Worker endpoint, which validates the full configuration again and verifies ownership against the owner's private project record before updating it in owner-scoped Puter KV. It updates only the design configuration and project timestamp, preserving the approved floor-plan analysis and image references. Existing project saves also retain previously stored private fields omitted from partial updates. Storage errors are returned to the panel rather than reported as a successful save.

Design settings and approved floor-plan analysis are private project metadata. They are omitted from public shared copies and public project responses. Older projects without a configuration remain supported; the panel displays safe defaults until the owner explicitly saves settings.

### Structural and aesthetic data remain separate

The approved Phase 2.1 analysis contains structural observations (rooms, walls, doors, windows, relationships, evidence, confidence, and uncertainty). The Phase 2.2 configuration contains aesthetic preferences only. Editing or saving aesthetic preferences does not modify structural analysis. Additional design instructions are untrusted visual preferences and are used only by Enhanced generation.

## Phase 2.3 generation modes

Choose a mode on the upload screen, before a new project opens:

- **Baseline** remains the default. It uses the original Phase 1 fixed prompt and the original Puter image-generation options. New baseline projects continue to render automatically when the owner opens the visualizer. Existing projects with no stored mode are treated as baseline.
- **Enhanced** is explicit opt-in. Uploading opens the project without starting image generation or spending generation quota. The owner can request analysis, edit and approve it, configure and save design preferences, review readiness, then explicitly start Enhanced generation.

Enhanced readiness requires the owner's approved floor-plan analysis and a valid saved design configuration. Floor-plan analysis itself remains an explicit, quota-counted AI request; it is never run automatically. Enhanced image-generation authorization is requested only when the owner selects **Start enhanced generation**.

### Structure-aware prompt construction

`lib/generation-prompt.ts` builds an Enhanced prompt deterministically from validated project inputs. Its sections cover source-image primacy, approved observations, spatial constraints, uncertainty handling, architectural style, materials/furnishings, lighting/perspective, and conceptual-use constraints. Observations include room labels and functions, walls, doors, windows, relationships, evidence, and recorded uncertainty. Structural observations and the source image take precedence over aesthetic preferences. Unknown details are not converted into asserted dimensions or architectural facts.

Analysis text and custom design text remain untrusted data. The builder JSON-encodes these values inside explicitly delimited data sections, sets a strict instruction hierarchy, revalidates the input schemas, and rejects prompts exceeding 24,000 characters. This limits and organizes model input; prompt construction cannot guarantee layout fidelity or prevent every model interpretation error.

### Pre-generation, authorization, and persistence

The Worker derives the generation mode and Enhanced inputs from the owner-scoped project record; client-supplied project IDs are only lookup keys and do not establish ownership. It validates the approved analysis/configuration, enforces the existing shared daily AI quota, and takes a per-project generation lock before the client invokes Puter. Duplicate active requests are rejected; the lock expires after 30 minutes if a browser disappears before reporting completion or failure. Generation errors are recorded as failed and can be retried. Settings and analysis cannot be changed while generation is active.

The saved private render stores `generationMode`, `modelIdentifier`, `promptTemplateVersion`, `configurationSnapshot`, `approvedAnalysisRevision`, `generationTimestamp`, `generationStatus`, and measured `generationLatencyMs`. Existing `sourceImage` and `renderedImage` fields remain unchanged. A successful render cannot be overwritten by another generation. Private analysis, configuration, and generation metadata remain excluded from public project copies.

### Limitations and research preparation

Both modes produce conceptual images from a 2D raster image, not verified CAD/BIM geometry, editable construction documents, measured dimensions, or professional design advice. Image generation can omit or alter features even when structural constraints are supplied. The two modes provide the preserved baseline and structured inputs needed for a controlled research comparison; mode and prompt metadata support later analysis but do not establish architectural consistency by themselves.

This milestone deliberately does not add render history. The single-render metadata shape is compatible with a future Phase 2.4 version-history model, while the baseline/enhanced distinction and approved-analysis revision prepare the project for Phase 2.5 structural-fidelity evaluation. Those phases are not included here.

---

Built with ❤️ using React Router.
