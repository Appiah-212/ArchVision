import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ state: { isSignedIn: true, userName: "Researcher", userId: "owner-1", signIn: vi.fn() }, location: { key: "initial" } }));
const actions = vi.hoisted(() => ({ getResearchWorkspace: vi.fn(), saveResearchWorkspace: vi.fn(), getProjectById: vi.fn() }));
vi.mock("react-router", async () => {
  const actual = await vi.importActual<typeof import("react-router")>("react-router");
  return { ...actual, useOutletContext: () => auth.state, useNavigate: () => vi.fn(), useLocation: () => auth.location };
});
vi.mock("../lib/puter.action", () => actions);
import Research from "../app/routes/research";

afterEach(() => cleanup());
beforeEach(() => { vi.clearAllMocks(); auth.state.isSignedIn = true; actions.getResearchWorkspace.mockResolvedValue({ workspace: { schemaVersion: 1, datasets: [], experiments: [] }, projects: [], retrievalLatencyMs: 2 }); });

describe("Research Evaluation dashboard", () => {
  it("shows a clear empty state without fabricated experiment results", async () => {
    render(<Research />);
    expect(await screen.findByRole("button", { name: "Back to projects" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh workspace data" })).toBeInTheDocument();
    expect(screen.queryByText(/PHASE 2\.6/i)).not.toBeInTheDocument();
    expect(await screen.findByText("No experiments yet")).toBeInTheDocument();
    expect(screen.getByText(/No sample results are provided/)).toBeInTheDocument();
    expect(screen.queryByText(/0\.0%/)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/[ÃÂâ�]/);
  });
  it("requires sign-in before loading private research data", () => {
    auth.state.isSignedIn = false;
    render(<Research />);
    expect(screen.getByText("Sign in as the project owner to access private research records.")).toBeInTheDocument();
    expect(actions.getResearchWorkspace).not.toHaveBeenCalled();
  });
  it("does not issue AI generation or evaluator calls", async () => {
    render(<Research />);
    await waitFor(() => expect(actions.getResearchWorkspace).toHaveBeenCalledTimes(1));
    expect(actions.getProjectById).not.toHaveBeenCalled();
    expect(actions.saveResearchWorkspace).not.toHaveBeenCalled();
  });
  it("keeps saved experiment records while hiding their dashboard until requested", async () => {
    actions.getResearchWorkspace.mockResolvedValue({
      workspace: { schemaVersion: 1, datasets: [], experiments: [{
        experimentId: "experiment-1", experimentName: "Saved pilot", researchQuestion: "Question",
        protocolVersion: "archvision-pilot-v1", datasetIdentifier: "dataset-1", sourceProjectIds: [],
        baselineRenderVersionIds: [], enhancedRenderVersionIds: [], evaluationRecordIds: [],
        evaluationRubricVersion: "archvision-structural-fidelity-v1", generationModelIdentifiers: [],
        promptTemplateVersions: [], configurationSnapshots: [], generationSnapshots: [],
        analysisRevisionIdentifiers: [], experimentalConditions: { controlledVariables: [], uncontrolledVariables: [], notes: [] },
        comparisons: [], blindReviewEnabled: true, createdAt: "2026-10-20T00:00:00.000Z",
        updatedAt: "2026-10-20T00:00:00.000Z", experimentStatus: "PLANNED", notes: [], limitations: [],
      }] }, projects: [], retrievalLatencyMs: 2,
    });
    const { rerender } = render(<Research />);
    const experimentPicker = await screen.findByRole("combobox", { name: "Research experiment" });
    expect(screen.getByRole("option", { name: "Saved pilot" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Saved pilot" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show experiment dashboard" })).toBeDisabled();
    fireEvent.change(experimentPicker, { target: { value: "experiment-1" } });
    expect(await screen.findByRole("button", { name: "Show experiment dashboard" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Show experiment dashboard" }));
    expect(await screen.findByRole("heading", { name: "Saved pilot" })).toBeInTheDocument();
    auth.location.key = "returned-to-research";
    rerender(<Research />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Show experiment dashboard" })).toBeDisabled());
    expect(screen.queryByRole("heading", { name: "Saved pilot" })).not.toBeInTheDocument();
    expect(actions.saveResearchWorkspace).not.toHaveBeenCalled();
  });
  it("uses a friendly residence label and explains when an enhanced render is missing", async () => {
    actions.getResearchWorkspace.mockResolvedValue({
      workspace: { schemaVersion: 1, datasets: [], experiments: [] },
      projects: [{ id: "1791975115300", name: "Residence 1791975115300", versions: [{ id: "legacy_abc", projectId: "1791975115300", versionNumber: 1, imageAssetReference: "private", generationMode: "baseline", modelIdentifier: "legacy/unknown", promptTemplateVersion: "legacy/unknown", configurationSnapshot: null, approvedAnalysisRevision: null, createdAt: "2026-10-20T00:00:00.000Z", generationStatus: "complete", name: "Original render" }], evaluations: [], generationOutcomes: [], warnings: [] }],
      retrievalLatencyMs: 2,
    });
    render(<Research />);
    expect(await screen.findByText(/This residence has a baseline render but no enhanced render yet/)).toBeInTheDocument();
    expect(screen.getAllByRole("option", { name: /Residence 1/ })).toHaveLength(2);
    expect(screen.getByRole("option", { name: /generation details unavailable/ })).toBeInTheDocument();
    expect(screen.queryByText(/1791975115300/)).not.toBeInTheDocument();
  });
});
