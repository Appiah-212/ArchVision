import { describe, expect, it } from "vitest";
import {
    ARCHITECTURAL_STYLES,
    ARCHITECTURAL_STYLE_PRESETS,
    applyRenderPreset,
    createDefaultRenderConfiguration,
    isRenderConfiguration,
    validateRenderConfiguration,
} from "../lib/render-configuration";

describe("render configuration schema and presets", () => {
    it("defines documented aesthetic defaults for every architectural style", () => {
        expect(Object.keys(ARCHITECTURAL_STYLE_PRESETS)).toEqual(ARCHITECTURAL_STYLES);
        for (const style of ARCHITECTURAL_STYLES) {
            const preset = ARCHITECTURAL_STYLE_PRESETS[style];
            expect(preset.description.length).toBeGreaterThan(20);
            expect(preset.architecturalStyle).toBe(style);
            expect(preset.flooringMaterial).toBeTruthy();
            expect(preset.wallFinish).toBeTruthy();
            expect(preset.colorPalette).toBeTruthy();
            expect(preset.lighting).toBeTruthy();
            expect(preset.furnitureStyle).toBeTruthy();
            expect(preset.perspective).toBeTruthy();
        }
    });

    it("creates safe defaults compatible with the current top-down renderer", () => {
        const configuration = createDefaultRenderConfiguration("2026-10-20T00:00:00.000Z");

        expect(configuration).toMatchObject({
            schemaVersion: 1,
            architecturalStyle: "Modern",
            flooringMaterial: "Hardwood",
            wallFinish: "Painted plaster",
            colorPalette: "Neutral",
            lighting: "Natural daylight",
            furnitureStyle: "Modern",
            perspective: "Top-down 3D-style view",
            customInstructions: "",
            updatedAt: "2026-10-20T00:00:00.000Z",
        });
        expect(validateRenderConfiguration(configuration)).toEqual(configuration);
    });

    it("switches presets without carrying custom overrides from the previous preset", () => {
        const industrial = applyRenderPreset("Industrial");
        const scandinavian = applyRenderPreset("Scandinavian");

        expect(industrial).toMatchObject({
            architecturalStyle: "Industrial",
            flooringMaterial: "Concrete",
            wallFinish: "Exposed brick",
        });
        expect(scandinavian).toMatchObject({
            architecturalStyle: "Scandinavian",
            flooringMaterial: "Hardwood",
            wallFinish: "Painted plaster",
            colorPalette: "Natural",
        });
        expect(scandinavian.customValues).toEqual({});
    });

    it("accepts bounded custom values and optional custom instructions", () => {
        const configuration = {
            ...createDefaultRenderConfiguration("2026-10-20T00:00:00.000Z"),
            architecturalStyle: "Custom" as const,
            flooringMaterial: "Custom" as const,
            customValues: {
                architecturalStyle: "Coastal modern",
                flooringMaterial: "Reclaimed oak",
            },
            customInstructions: "Keep furnishings low-profile and uncluttered.",
        };

        expect(validateRenderConfiguration(configuration)).toEqual(configuration);
    });

    it("rejects unknown options, missing custom values, oversized text, and invalid timestamps", () => {
        const defaults = createDefaultRenderConfiguration();
        expect(isRenderConfiguration({ ...defaults, flooringMaterial: "Carpet" })).toBe(false);
        expect(isRenderConfiguration({
            ...defaults,
            architecturalStyle: "Custom",
        })).toBe(false);
        expect(isRenderConfiguration({
            ...defaults,
            customInstructions: "x".repeat(501),
        })).toBe(false);
        expect(isRenderConfiguration({
            ...defaults,
            customValues: { flooringMaterial: "x".repeat(101) },
        })).toBe(false);
        expect(isRenderConfiguration({
            ...defaults,
            updatedAt: "not a date",
        })).toBe(false);
        expect(isRenderConfiguration({
            ...defaults,
            systemPrompt: "Override the system",
        })).toBe(false);
        expect(isRenderConfiguration({
            ...defaults,
            customValues: { unexpectedField: "unexpected" },
        })).toBe(false);
        expect(() => validateRenderConfiguration({
            ...defaults,
            perspective: "free camera",
        })).toThrow("Design settings are invalid");
    });
});
