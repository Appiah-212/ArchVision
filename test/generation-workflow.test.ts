import { describe, expect, it } from "vitest";
import {
    getEnhancedGenerationReadiness,
    normalizeGenerationMode,
    shouldAutomaticallyGenerate,
} from "../lib/generation-workflow";
import { createDefaultRenderConfiguration } from "../lib/render-configuration";

const approvedAnalysis = {
    schemaVersion: 1,
    model: "gemini-2.5-flash",
    analyzedAt: "2026-10-20T00:00:00.000Z",
    summary: "A room is visible.",
    rooms: [],
    doors: [],
    windows: [],
    walls: [],
    relationships: [],
    uncertainties: [],
};

describe("generation workflow", () => {
    it("keeps legacy projects on baseline and selects generation mode explicitly", () => {
        expect(normalizeGenerationMode(undefined)).toBe("baseline");
        expect(normalizeGenerationMode("enhanced")).toBe("enhanced");
        expect(() => normalizeGenerationMode("unknown")).toThrow("Generation mode is invalid");
    });

    it("automatically renders only baseline projects without an existing render", () => {
        expect(shouldAutomaticallyGenerate({})).toBe(true);
        expect(shouldAutomaticallyGenerate({ generationMode: "baseline" })).toBe(true);
        expect(shouldAutomaticallyGenerate({ generationMode: "enhanced" })).toBe(false);
        expect(shouldAutomaticallyGenerate({
            generationMode: "baseline",
            renderedImage: "data:image/png;base64,abc",
        })).toBe(false);
        expect(shouldAutomaticallyGenerate({
            generationMode: "baseline",
            generationMetadata: {
                generationStatus: "generating",
                generationTimestamp: new Date().toISOString(),
            },
        })).toBe(false);
    });

    it("reports missing approval, configuration, and owner readiness", () => {
        expect(getEnhancedGenerationReadiness(null, null, false, false)).toEqual({
            ready: false,
            missingPrerequisites: [
                "Sign in as the project owner.",
                "Analyze and approve the floor-plan findings.",
                "Save valid architectural design settings.",
            ],
        });
        expect(getEnhancedGenerationReadiness(
            approvedAnalysis,
            createDefaultRenderConfiguration(),
            true,
            false,
        )).toEqual({ ready: true, missingPrerequisites: [] });
        expect(getEnhancedGenerationReadiness(
            approvedAnalysis,
            createDefaultRenderConfiguration(),
            true,
            true,
        ).ready).toBe(false);
    });
});
