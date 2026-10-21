import { describe, expect, it } from "vitest";
import {
    parseFloorPlanAnalysis,
    validateFloorPlanAnalysis,
} from "../lib/floor-plan-analysis";

const validResponse = {
    schemaVersion: 1,
    summary: "Two rooms are separated by a visible wall.",
    rooms: [
        {
            id: "room-1",
            label: "Room 1",
            possibleFunction: null,
            confidence: 0.7,
            evidence: "A rectangular enclosure is visible.",
        },
        {
            id: "room-2",
            label: "Room 2",
            possibleFunction: "Kitchen",
            confidence: 0.82,
            evidence: "A sink and counters are visible.",
        },
    ],
    doors: [],
    windows: [],
    walls: [],
    relationships: [{
        id: "relation-1",
        fromRoomId: "room-1",
        toRoomId: "room-2",
        relationship: "Adjacent with a connecting doorway.",
        confidence: 0.68,
    }],
    uncertainties: ["The plan scale is not shown."],
};

describe("floor-plan analysis validation", () => {
    it("parses JSON and adds trusted model and timestamp metadata", () => {
        const result = parseFloorPlanAnalysis(
            `\`\`\`json\n${JSON.stringify(validResponse)}\n\`\`\``,
            "gemini-2.5-flash",
            "2026-10-19T12:00:00.000Z",
        );

        expect(result).toEqual({
            ...validResponse,
            model: "gemini-2.5-flash",
            analyzedAt: "2026-10-19T12:00:00.000Z",
        });
    });

    it("extracts a JSON object surrounded by model explanation or markdown fences", () => {
        const result = parseFloorPlanAnalysis(
            `Here is the floor-plan analysis:\n\`\`\`json\n${JSON.stringify(validResponse)}\n\`\`\`\nI could not verify the drawing scale.`,
            "gemini-2.5-flash",
        );

        expect(result.summary).toBe(validResponse.summary);
        expect(result.uncertainties).toEqual(validResponse.uncertainties);
    });

    it("rejects malformed JSON and missing structured categories", () => {
        expect(() => parseFloorPlanAnalysis("not JSON", "gemini-2.5-flash")).toThrow(
            "invalid JSON",
        );
        const incomplete = { ...validResponse };
        delete (incomplete as Partial<typeof incomplete>).doors;
        expect(() => validateFloorPlanAnalysis({
            ...incomplete,
            model: "gemini-2.5-flash",
            analyzedAt: new Date().toISOString(),
        })).toThrow("invalid door list");
    });

    it("rejects invalid confidence values and relationships to unknown rooms", () => {
        const invalidConfidence = structuredClone(validResponse);
        invalidConfidence.rooms[0].confidence = 1.5;
        expect(() => validateFloorPlanAnalysis({
            ...invalidConfidence,
            model: "gemini-2.5-flash",
            analyzedAt: new Date().toISOString(),
        })).toThrow("invalid confidence");

        const unknownRoom = structuredClone(validResponse);
        unknownRoom.relationships[0].toRoomId = "missing-room";
        expect(() => validateFloorPlanAnalysis({
            ...unknownRoom,
            model: "gemini-2.5-flash",
            analyzedAt: new Date().toISOString(),
        })).toThrow("unknown room");
    });
});
