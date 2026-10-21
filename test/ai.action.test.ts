import { beforeEach, describe, expect, it, vi } from "vitest";

const { chat, txt2img } = vi.hoisted(() => ({
    chat: vi.fn(),
    txt2img: vi.fn(),
}));

vi.mock("@heyputer/puter.js", () => ({
    default: {
        ai: { chat, txt2img },
    },
}));

import {
    analyzeFloorPlan,
    generate3DView,
    GENERATION_MODEL_IDENTIFIER,
} from "../lib/ai.action";
import { ARCHVISION_RENDER_PROMPT } from "../lib/constants";
import { createDefaultRenderConfiguration } from "../lib/render-configuration";

const approvedRenderAnalysis = {
    schemaVersion: 1 as const,
    model: "gemini-2.5-flash",
    analyzedAt: "2026-10-20T00:00:00.000Z",
    summary: "One room with a visible window.",
    rooms: [{
        id: "room-1",
        label: "Bedroom",
        possibleFunction: "Bedroom",
        confidence: 0.8,
        evidence: "A bed symbol is visible.",
    }],
    doors: [],
    windows: [],
    walls: [],
    relationships: [],
    uncertainties: ["The scale is unknown."],
};

describe("AI floor-plan interpretation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("uses Puter's image-capable chat and validates its structured response", async () => {
        chat.mockResolvedValue({
            message: {
                tool_calls: [{
                    id: "call-analysis",
                    function: {
                        name: "submit_floor_plan_analysis",
                        arguments: JSON.stringify({
                            schemaVersion: 1,
                            summary: "One enclosed room is visible.",
                            rooms: [{
                                id: "room-1",
                                label: "Room 1",
                                possibleFunction: null,
                                confidence: 0.62,
                                evidence: "The image shows an enclosed rectangular space.",
                            }],
                            doors: [],
                            windows: [],
                            walls: [],
                            relationships: [],
                            uncertainties: ["The room function is not identifiable."],
                        }),
                    },
                }],
            },
        });

        const result = await analyzeFloorPlan("data:image/png;base64,cGxhbg==");

        expect(chat).toHaveBeenCalledWith(
            expect.stringContaining("visible evidence"),
            "data:image/png;base64,cGxhbg==",
            expect.objectContaining({
                provider: "gemini",
                model: "gemini-2.5-flash",
                vision: true,
                normalize: true,
                max_tokens: 8192,
                tools: [expect.objectContaining({
                    type: "function",
                    function: expect.objectContaining({
                        name: "submit_floor_plan_analysis",
                        strict: true,
                    }),
                })],
            }),
        );
        expect(result.rooms[0].possibleFunction).toBeNull();
        expect(result.uncertainties).toEqual(["The room function is not identifiable."]);
        expect(result.analyzedAt).toBeTruthy();
    });

    it("returns a conservative fallback when the model replies with prose instead of structured JSON", async () => {
        chat.mockResolvedValue({ message: { content: "I see a kitchen." } });

        await expect(analyzeFloorPlan("data:image/png;base64,ZmFrZQ==")).resolves.toMatchObject({
            summary: expect.stringContaining("simplified because the model reached its output limit"),
            uncertainties: [expect.stringContaining("output limit")],
        });
    });

    it("parses JSON returned as ordinary assistant message content", async () => {
        chat.mockResolvedValue({
            message: {
                content: JSON.stringify({
                    schemaVersion: 1,
                    summary: "A single room is visible.",
                    rooms: [{
                        id: "room-1",
                        label: "Room 1",
                        possibleFunction: null,
                        confidence: 0.5,
                        evidence: "An enclosed space is visible.",
                    }],
                    doors: [],
                    windows: [],
                    walls: [],
                    relationships: [],
                    uncertainties: [],
                }),
            },
        });

        await expect(analyzeFloorPlan("data:image/png;base64,ZmFrZQ=="))
            .resolves.toMatchObject({ summary: "A single room is visible." });
    });

    it("falls back to a conservative minimal analysis when truncated structured responses are returned", async () => {
        chat.mockResolvedValue({
            finish_reason: "length",
            message: {
                tool_calls: [{
                    id: "call-analysis",
                    function: {
                        name: "submit_floor_plan_analysis",
                        arguments: '{"schemaVersion":1,',
                    },
                }],
            },
        });

        await expect(analyzeFloorPlan("data:image/png;base64,ZmFrZQ==")).resolves.toMatchObject({
            summary: expect.stringContaining("simplified because the model reached its output limit"),
            rooms: [],
            uncertainties: [expect.stringContaining("output limit")],
        });
    });

    it("falls back to a conservative minimal analysis when the response is cut off before any content", async () => {
        chat.mockResolvedValue({
            finish_reason: "length",
            message: { role: "assistant", tool_calls: [] },
        });

        await expect(analyzeFloorPlan("data:image/png;base64,ZmFrZQ==")).resolves.toMatchObject({
            summary: expect.stringContaining("simplified because the model reached its output limit"),
            rooms: [],
        });
    });

    it("falls back to a minimal analysis for provider-specific MAX_TOKENS responses", async () => {
        chat.mockResolvedValue({
            finishReason: "MAX_TOKENS",
            message: { role: "assistant", content: null },
        });

        await expect(analyzeFloorPlan("data:image/png;base64,ZmFrZQ==")).resolves.toMatchObject({
            model: "gemini-2.5-flash",
            uncertainties: [expect.stringContaining("output limit")],
        });
    });

    it("reads a Gemini-native function call nested in candidate parts", async () => {
        chat.mockResolvedValue({
            candidates: [{
                content: {
                    parts: [{
                        functionCall: {
                            name: "submit_floor_plan_analysis",
                            args: {
                                schemaVersion: 1,
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
                                uncertainties: [],
                            },
                        },
                    }],
                },
            }],
        });

        await expect(analyzeFloorPlan("data:image/png;base64,ZmFrZQ=="))
            .resolves.toMatchObject({ summary: "One enclosed room is visible." });
    });

    it("includes response shape metadata when the provider returns no readable result", async () => {
        chat.mockResolvedValue({
            finish_reason: "stop",
            message: { role: "assistant", content: null },
        });

        await expect(analyzeFloorPlan("data:image/png;base64,ZmFrZQ==")).rejects.toThrow(
            "finish reason: stop; response fields: finish_reason, message; message fields: role, content; content type: object",
        );
    });

    it("preserves the original baseline fixed prompt and image-generation options", async () => {
        txt2img.mockResolvedValue({ src: "data:image/png;base64,b2s=" });

        const result = await generate3DView({
            sourceImage: "data:image/png;base64,cGxhbg==",
            generationMode: "baseline",
        });

        expect(txt2img).toHaveBeenCalledWith(ARCHVISION_RENDER_PROMPT, {
            provider: "gemini",
            model: "gemini-3.1-flash-image-preview",
            input_image: "cGxhbg==",
            input_image_mime_type: "image/png",
            ratio: { w: 1024, h: 1024 },
        });
        expect(result.generationMetadata).toMatchObject({
            generationMode: "baseline",
            modelIdentifier: GENERATION_MODEL_IDENTIFIER,
            promptTemplateVersion: "archvision-baseline-v1",
            configurationSnapshot: null,
            approvedAnalysisRevision: null,
            generationStatus: "complete",
        });
    });

    it("builds an Enhanced prompt and sends the source image to Puter", async () => {
        txt2img.mockResolvedValue({ src: "data:image/png;base64,b2s=" });

        const result = await generate3DView({
            sourceImage: "data:image/png;base64,cGxhbg==",
            generationMode: "enhanced",
            analysis: approvedRenderAnalysis,
            configuration: createDefaultRenderConfiguration(),
            approvedAnalysisRevision: 3,
            generationTimestamp: "2026-10-20T00:00:00.000Z",
        });

        const [prompt, options] = txt2img.mock.calls[0];
        expect(prompt).toContain("APPROVED STRUCTURAL OBSERVATIONS");
        expect(prompt).toContain("Bedroom");
        expect(options).toMatchObject({
            provider: "gemini",
            model: GENERATION_MODEL_IDENTIFIER,
            input_image: "cGxhbg==",
            input_image_mime_type: "image/png",
        });
        expect(result.generationMetadata).toMatchObject({
            generationMode: "enhanced",
            promptTemplateVersion: "archvision-enhanced-v1",
            approvedAnalysisRevision: 3,
            generationTimestamp: "2026-10-20T00:00:00.000Z",
            generationStatus: "complete",
        });
    });

    it("requires approved analysis, saved configuration, and revision for Enhanced mode", async () => {
        await expect(generate3DView({
            sourceImage: "data:image/png;base64,cGxhbg==",
            generationMode: "enhanced",
        })).rejects.toThrow("requires approved floor-plan analysis");
        expect(txt2img).not.toHaveBeenCalled();

        await expect(generate3DView({
            sourceImage: "data:image/png;base64,cGxhbg==",
            generationMode: "enhanced",
            analysis: approvedRenderAnalysis,
        })).rejects.toThrow("requires saved design settings");
        expect(txt2img).not.toHaveBeenCalled();
    });

    it("surfaces empty AI responses rather than falling back to baseline", async () => {
        txt2img.mockResolvedValue({ src: "" });

        await expect(generate3DView({
            sourceImage: "data:image/png;base64,cGxhbg==",
            generationMode: "enhanced",
            analysis: approvedRenderAnalysis,
            configuration: createDefaultRenderConfiguration(),
            approvedAnalysisRevision: 1,
        })).rejects.toThrow("returned no image");
        expect(txt2img).toHaveBeenCalledOnce();
    });
});
