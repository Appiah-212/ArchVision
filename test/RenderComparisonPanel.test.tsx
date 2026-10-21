import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import RenderComparisonPanel from "../components/RenderComparisonPanel";
import type { RenderVersion } from "../lib/render-version";

afterEach(() => cleanup());

const versions: RenderVersion[] = [
    {
        id: "version_one",
        projectId: "project-1",
        versionNumber: 1,
        imageAssetReference: "archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png",
        generationMode: "baseline",
        modelIdentifier: "model-one",
        promptTemplateVersion: "baseline-v1",
        configurationSnapshot: null,
        approvedAnalysisRevision: null,
        createdAt: "2026-10-19T12:00:00.000Z",
        generationStatus: "complete",
        name: "Baseline study",
    },
    {
        id: "version_two",
        projectId: "project-1",
        versionNumber: 2,
        imageAssetReference: "archvision_private_asset:123e4567-e89b-12d3-a456-426614174001.png",
        generationMode: "enhanced",
        modelIdentifier: "model-two",
        promptTemplateVersion: "enhanced-v1",
        configurationSnapshot: null,
        approvedAnalysisRevision: 3,
        createdAt: "2026-10-20T12:00:00.000Z",
        generationStatus: "complete",
        name: "Enhanced study",
    },
];

describe("RenderComparisonPanel", () => {
    it("compares the source plan with a selected version and two independently selected versions", async () => {
        const user = userEvent.setup();
        render(
            <RenderComparisonPanel
                sourceImage="blob:source"
                versions={versions}
                versionImages={{ version_one: "blob:one", version_two: "blob:two" }}
                selectedVersionId="version_two"
            />,
        );

        expect(screen.getByText(/Source floor plan compared with Version 2/)).toBeInTheDocument();
        expect(screen.getByAltText("Original 2D floor plan")).toHaveAttribute("src", "blob:source");

        await user.selectOptions(screen.getByLabelText("Comparison mode"), "render-render");
        expect(screen.getByLabelText("Version A")).toHaveValue("version_two");
        expect(screen.getByLabelText("Version B")).toHaveValue("version_one");
        await user.selectOptions(screen.getByLabelText("Version A"), "version_one");
        await user.selectOptions(screen.getByLabelText("Version B"), "version_two");

        expect(screen.getByRole("heading", { name: "Render versus render" })).toBeInTheDocument();
        expect(screen.getByText(/Baseline study · baseline/)).toBeInTheDocument();
        expect(screen.getByText(/Enhanced study · enhanced/)).toBeInTheDocument();
        expect(screen.getByAltText("Version 1")).toHaveAttribute("src", "blob:one");
        expect(screen.getByAltText("Version 2")).toHaveAttribute("src", "blob:two");
    });

    it("explains when no render versions are available", () => {
        render(
            <RenderComparisonPanel
                sourceImage="blob:source"
                versions={[]}
                versionImages={{}}
                selectedVersionId={null}
            />,
        );
        expect(screen.getByRole("status")).toHaveTextContent(
            "Generate a render version to start a comparison.",
        );
    });
});
