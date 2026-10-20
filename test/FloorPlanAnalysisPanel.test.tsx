import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import FloorPlanAnalysisPanel from "../components/FloorPlanAnalysisPanel";
import type { FloorPlanAnalysis } from "../lib/floor-plan-analysis";

const analysis: FloorPlanAnalysis = {
    schemaVersion: 1,
    model: "gemini-2.5-flash",
    analyzedAt: "2026-10-19T12:00:00.000Z",
    summary: "One enclosed room is visible.",
    rooms: [{
        id: "room-1",
        label: "Room 1",
        possibleFunction: null,
        confidence: 0.62,
        evidence: "A rectangular enclosure is visible.",
    }],
    doors: [],
    windows: [],
    walls: [],
    relationships: [],
    uncertainties: ["The room function is not identifiable."],
};

afterEach(() => cleanup());

describe("FloorPlanAnalysisPanel workflow", () => {
    it("lets the owner request analysis, correct findings, and approve the saved result", async () => {
        const user = userEvent.setup();
        const onAnalyze = vi.fn().mockResolvedValue(analysis);
        const onApprove = vi.fn().mockResolvedValue(undefined);
        render(
            <FloorPlanAnalysisPanel
                isOwner
                onAnalyze={onAnalyze}
                onApprove={onApprove}
            />,
        );

        await user.click(screen.getByRole("button", { name: "Analyze floor plan" }));
        expect(onAnalyze).toHaveBeenCalledOnce();
        expect(await screen.findByDisplayValue("Room 1")).toBeInTheDocument();

        await user.clear(screen.getByLabelText("Room label"));
        await user.type(screen.getByLabelText("Room label"), "Living room");
        await user.click(screen.getByRole("button", { name: "Approve and save" }));

        await waitFor(() => expect(onApprove).toHaveBeenCalledOnce());
        expect(onApprove).toHaveBeenCalledWith(expect.objectContaining({
            rooms: [expect.objectContaining({
                label: "Living room",
                possibleFunction: null,
            })],
        }));
        expect(screen.getByText(/Approved analysis/)).toBeInTheDocument();
    });

    it("does not offer analyze or approve controls to non-owners", () => {
        render(
            <FloorPlanAnalysisPanel
                isOwner={false}
                approvedAnalysis={analysis}
                onAnalyze={vi.fn()}
                onApprove={vi.fn()}
            />,
        );

        expect(screen.queryByRole("button", { name: /Analyze/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /Approve/ })).not.toBeInTheDocument();
        expect(screen.getByText("Only the project owner can analyze or approve this floor plan."))
            .toBeInTheDocument();
        expect(screen.getByLabelText("Room label")).toBeDisabled();
    });
});
