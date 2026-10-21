import { describe, expect, it } from "vitest";
import {
    createLegacyRenderVersion,
    getRenderVersions,
    isRenderVersion,
} from "../lib/render-version";
import { createDefaultRenderConfiguration } from "../lib/render-configuration";

const legacyProject = {
    id: "project-legacy",
    renderedImage: "data:image/png;base64,abc",
    timestamp: Date.parse("2026-10-20T10:00:00.000Z"),
};

describe("render version schema and legacy adapter", () => {
    it("provides a stable non-persisting version for a legacy single render", () => {
        const first = createLegacyRenderVersion(legacyProject);
        const second = createLegacyRenderVersion(legacyProject);

        expect(first).toMatchObject({
            projectId: "project-legacy",
            versionNumber: 1,
            imageAssetReference: legacyProject.renderedImage,
            generationMode: "baseline",
            generationStatus: "complete",
            isLegacy: true,
        });
        expect(first?.id).toBe(second?.id);
        expect(getRenderVersions(legacyProject)).toEqual([first]);
    });

    it("retains versioned metadata in stable number order and rejects duplicates", () => {
        const base = createLegacyRenderVersion(legacyProject)!;
        const second = {
            ...base,
            id: "version_two",
            versionNumber: 2,
            generationMode: "enhanced" as const,
            modelIdentifier: "gemini-3.1-flash-image-preview",
            promptTemplateVersion: "archvision-enhanced-v1",
            configurationSnapshot: createDefaultRenderConfiguration(),
            approvedAnalysisRevision: 1,
            approvedAnalysisSnapshot: {
                schemaVersion: 1 as const,
                model: "gemini-2.5-flash",
                analyzedAt: "2026-10-20T00:00:00.000Z",
                summary: "One room is visible.",
                rooms: [],
                doors: [],
                windows: [],
                walls: [],
                relationships: [],
                uncertainties: [],
            },
            isLegacy: undefined,
        };
        expect(isRenderVersion(second)).toBe(true);
        expect(getRenderVersions({
            ...legacyProject,
            renderVersions: [second, base],
        }).map(({ versionNumber }) => versionNumber)).toEqual([1, 2]);
        expect(() => getRenderVersions({
            ...legacyProject,
            renderVersions: [second, { ...second, id: "duplicate" }],
        })).toThrow("invalid render version metadata");
    });

    it("rejects unsafe identifiers and non-image references", () => {
        const version = createLegacyRenderVersion(legacyProject)!;
        expect(isRenderVersion({
            ...version,
            id: "../other-project",
        })).toBe(false);
        expect(isRenderVersion({
            ...version,
            imageAssetReference: "archvision_private_asset:../../secret.png",
        })).toBe(false);
    });
});
