import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ArchitecturalDesignSettingsPanel from "../components/ArchitecturalDesignSettingsPanel";
import {
    createDefaultRenderConfiguration,
    type RenderConfiguration,
} from "../lib/render-configuration";

afterEach(() => cleanup());

describe("ArchitecturalDesignSettingsPanel", () => {
    it("switches presets, saves settings, and reloads the persisted configuration", async () => {
        const user = userEvent.setup();
        const onSave = vi.fn(async (configuration: RenderConfiguration) => configuration);
        const { rerender } = render(
            <ArchitecturalDesignSettingsPanel
                isOwner
                onSave={onSave}
            />,
        );

        await user.selectOptions(screen.getByLabelText("Architectural style"), "Scandinavian");
        expect(screen.getByLabelText("Floor material")).toHaveValue("Hardwood");
        expect(screen.getByLabelText("Color palette")).toHaveValue("Natural");
        expect(screen.getByText("Defaults not saved")).toBeInTheDocument();

        await user.type(
            screen.getByLabelText("Additional design instructions"),
            "Keep furniture simple.",
        );
        await user.click(screen.getByRole("button", { name: "Save settings" }));
        await waitFor(() => expect(onSave).toHaveBeenCalledOnce());
        const savedConfiguration = onSave.mock.calls[0][0];
        expect(savedConfiguration).toMatchObject({
            architecturalStyle: "Scandinavian",
            colorPalette: "Natural",
            customInstructions: "Keep furniture simple.",
        });
        expect(screen.getByText(/Saved/)).toBeInTheDocument();

        rerender(
            <ArchitecturalDesignSettingsPanel
                savedConfiguration={savedConfiguration}
                isOwner
                onSave={onSave}
            />,
        );
        expect(screen.getByLabelText("Architectural style")).toHaveValue("Scandinavian");
        expect(screen.getByLabelText("Additional design instructions"))
            .toHaveValue("Keep furniture simple.");
    });

    it("requires a custom value, resets unsaved changes to safe defaults, and waits for explicit save", async () => {
        const user = userEvent.setup();
        const onSave = vi.fn(async (configuration: RenderConfiguration) => configuration);
        render(
            <ArchitecturalDesignSettingsPanel
                isOwner
                onSave={onSave}
            />,
        );

        await user.selectOptions(screen.getByLabelText("Architectural style"), "Custom");
        expect(screen.getByLabelText("Describe your architectural style")).toHaveAttribute(
            "aria-required",
            "true",
        );
        await user.click(screen.getByRole("button", { name: "Save settings" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("custom values");
        expect(onSave).not.toHaveBeenCalled();

        await user.type(
            screen.getByLabelText("Describe your architectural style"),
            "Coastal modern",
        );
        expect(onSave).not.toHaveBeenCalled();
        await user.click(screen.getByRole("button", { name: "Reset to defaults" }));
        expect(screen.getByLabelText("Architectural style")).toHaveValue("Modern");
        expect(screen.queryByLabelText("Describe your architectural style")).not.toBeInTheDocument();
        expect(screen.getByText("Defaults not saved")).toBeInTheDocument();
        expect(onSave).not.toHaveBeenCalled();
    });

    it("shows a failed persistence request and leaves the panel unsaved", async () => {
        const user = userEvent.setup();
        const onSave = vi.fn().mockRejectedValue(new Error("KV unavailable"));
        render(
            <ArchitecturalDesignSettingsPanel
                isOwner
                onSave={onSave}
            />,
        );

        await user.selectOptions(screen.getByLabelText("Lighting"), "Warm ambient");
        await user.click(screen.getByRole("button", { name: "Save settings" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("KV unavailable");
        expect(screen.getByText("Defaults not saved")).toBeInTheDocument();
    });

    it("allows non-owners to inspect but not change project settings", () => {
        render(
            <ArchitecturalDesignSettingsPanel
                savedConfiguration={createDefaultRenderConfiguration()}
                isOwner={false}
                onSave={vi.fn()}
            />,
        );

        expect(screen.getByLabelText("Architectural style")).toBeDisabled();
        expect(screen.getByText("Only the project owner can change these settings."))
            .toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Save settings" })).not.toBeInTheDocument();
    });
});
