import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RenderHistoryPanel from "../components/RenderHistoryPanel";
import type { RenderVersion } from "../lib/render-version";

afterEach(() => cleanup());

const versions: RenderVersion[] = [
    {
        id: "version_one",
        projectId: "project-1",
        versionNumber: 1,
        imageAssetReference: "archvision_private_asset:123e4567-e89b-12d3-a456-426614174000.png",
        generationMode: "baseline",
        modelIdentifier: "gemini-3.1-flash-image-preview",
        promptTemplateVersion: "archvision-baseline-v1",
        configurationSnapshot: null,
        approvedAnalysisRevision: null,
        createdAt: "2026-10-19T12:00:00.000Z",
        generationStatus: "complete",
        name: "Initial study",
    },
    {
        id: "version_two",
        projectId: "project-1",
        versionNumber: 2,
        imageAssetReference: "archvision_private_asset:123e4567-e89b-12d3-a456-426614174001.png",
        generationMode: "enhanced",
        modelIdentifier: "gemini-3.1-flash-image-preview",
        promptTemplateVersion: "archvision-enhanced-v1",
        configurationSnapshot: null,
        approvedAnalysisRevision: 4,
        createdAt: "2026-10-20T12:00:00.000Z",
        generationLatencyMs: 5000,
        generationStatus: "complete",
    },
];

describe("RenderHistoryPanel", () => {
    it("selects, activates, edits and exports a retained render", async () => {
        const user = userEvent.setup();
        const onSelect = vi.fn();
        const onSetActive = vi.fn();
        const onSaveDetails = vi.fn(async () => undefined);
        const onExport = vi.fn();
        render(
            <RenderHistoryPanel
                versions={versions}
                versionImages={{ version_one: "blob:one", version_two: "blob:two" }}
                activeVersionId="version_one"
                selectedVersionId="version_two"
                isOwner
                isLoading={false}
                isGenerating={false}
                isSaving={false}
                statusMessage=""
                statusIsError={false}
                onSelect={onSelect}
                onSetActive={onSetActive}
                onSaveDetails={onSaveDetails}
                onExport={onExport}
                onGenerate={vi.fn()}
            />,
        );

        expect(screen.getByText("gemini-3.1-flash-image-preview")).toBeInTheDocument();
        expect(screen.getByText("archvision-enhanced-v1")).toBeInTheDocument();
        expect(screen.getByText("4")).toBeInTheDocument();

        await user.click(screen.getByRole("button", { name: /Version 1 · baseline/ }));
        expect(onSelect).toHaveBeenCalledWith("version_one");

        await user.clear(screen.getByLabelText("Version name"));
        await user.type(screen.getByLabelText("Version name"), "Controlled run");
        await user.type(screen.getByLabelText("Notes"), "Compare with approved revision four.");
        await user.click(screen.getByRole("button", { name: "Save name and notes" }));
        await waitFor(() => expect(onSaveDetails).toHaveBeenCalledWith(
            "version_two",
            "Controlled run",
            "Compare with approved revision four.",
        ));

        await user.click(screen.getByRole("button", { name: "Make active render" }));
        expect(onSetActive).toHaveBeenCalledWith("version_two");
        await user.click(screen.getByRole("button", { name: "Export selected render" }));
        expect(onExport).toHaveBeenCalledOnce();
    });

    it("shows a useful empty state and generation action", () => {
        const onGenerate = vi.fn();
        render(
            <RenderHistoryPanel
                versions={[]}
                versionImages={{}}
                activeVersionId={null}
                selectedVersionId={null}
                isOwner
                isLoading={false}
                isGenerating={false}
                isSaving={false}
                statusMessage=""
                statusIsError={false}
                onSelect={vi.fn()}
                onSetActive={vi.fn()}
                onSaveDetails={vi.fn(async () => undefined)}
                onExport={vi.fn()}
                onGenerate={onGenerate}
            />,
        );

        expect(screen.getByText(/No render versions yet/)).toBeInTheDocument();
        screen.getByRole("button", { name: "Generate new version" }).click();
        expect(onGenerate).toHaveBeenCalledOnce();
    });

    it("surfaces loading, image retrieval, and persistence error states", () => {
        const { rerender } = render(
            <RenderHistoryPanel
                versions={[]}
                versionImages={{}}
                activeVersionId={null}
                selectedVersionId={null}
                isOwner
                isLoading
                isGenerating={false}
                isSaving={false}
                statusMessage=""
                statusIsError={false}
                onSelect={vi.fn()}
                onSetActive={vi.fn()}
                onSaveDetails={vi.fn(async () => undefined)}
                onExport={vi.fn()}
                onGenerate={vi.fn()}
            />,
        );
        expect(screen.getByRole("status")).toHaveTextContent("Loading render history");

        rerender(
            <RenderHistoryPanel
                versions={[versions[0]]}
                versionImages={{}}
                activeVersionId={versions[0].id}
                selectedVersionId={versions[0].id}
                isOwner
                isLoading={false}
                isGenerating={false}
                isSaving={false}
                statusMessage="Worker unavailable"
                statusIsError
                onSelect={vi.fn()}
                onSetActive={vi.fn()}
                onSaveDetails={vi.fn(async () => undefined)}
                onExport={vi.fn()}
                onGenerate={vi.fn()}
            />,
        );
        expect(screen.getAllByRole("alert")).toHaveLength(2);
        expect(screen.getByText("Worker unavailable")).toBeInTheDocument();
        expect(screen.getByText(/private render images could not be loaded/)).toBeInTheDocument();
    });
});
