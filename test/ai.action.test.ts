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

import { analyzeFloorPlan } from "../lib/ai.action";

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

    it("reports a missing structured response instead of trying to parse prose", async () => {
        chat.mockResolvedValue({ message: { content: "I see a kitchen." } });

        await expect(analyzeFloorPlan("data:image/png;base64,ZmFrZQ==")).rejects.toThrow(
            "did not return a structured floor-plan analysis",
        );
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

    it("reports truncated structured responses as retryable errors", async () => {
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

        await expect(analyzeFloorPlan("data:image/png;base64,ZmFrZQ==")).rejects.toThrow(
            "reached its output limit",
        );
    });

    it("detects an output-limit response before treating missing content as an empty result", async () => {
        chat.mockResolvedValue({
            finish_reason: "length",
            message: { role: "assistant", tool_calls: [] },
        });

        await expect(analyzeFloorPlan("data:image/png;base64,ZmFrZQ==")).rejects.toThrow(
            "The AI response was incomplete because it reached its output limit",
        );
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
});
