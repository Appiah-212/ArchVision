import puter from "@heyputer/puter.js";
import { ARCHVISION_RENDER_PROMPT } from "./constants";
import { parseFloorPlanAnalysis, type FloorPlanAnalysis } from "./floor-plan-analysis";

const FLOOR_PLAN_ANALYSIS_MODEL = "gemini-2.5-flash";
const FLOOR_PLAN_ANALYSIS_TOOL = {
    type: "function",
    function: {
        name: "submit_floor_plan_analysis",
        description: "Return the evidence-based structured interpretation of the floor-plan image.",
        strict: true,
        parameters: {
            type: "object",
            properties: {
                schemaVersion: { type: "integer", enum: [1] },
                summary: { type: "string" },
                rooms: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            label: { type: "string" },
                            possibleFunction: { type: ["string", "null"] },
                            confidence: { type: "number" },
                            evidence: { type: "string" },
                        },
                        required: ["id", "label", "possibleFunction", "confidence", "evidence"],
                        additionalProperties: false,
                    },
                },
                doors: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            description: { type: "string" },
                            location: { type: "string" },
                            confidence: { type: "number" },
                            evidence: { type: "string" },
                        },
                        required: ["id", "description", "location", "confidence", "evidence"],
                        additionalProperties: false,
                    },
                },
                windows: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            description: { type: "string" },
                            location: { type: "string" },
                            confidence: { type: "number" },
                            evidence: { type: "string" },
                        },
                        required: ["id", "description", "location", "confidence", "evidence"],
                        additionalProperties: false,
                    },
                },
                walls: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            description: { type: "string" },
                            location: { type: "string" },
                            confidence: { type: "number" },
                            evidence: { type: "string" },
                        },
                        required: ["id", "description", "location", "confidence", "evidence"],
                        additionalProperties: false,
                    },
                },
                relationships: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            id: { type: "string" },
                            fromRoomId: { type: "string" },
                            toRoomId: { type: "string" },
                            relationship: { type: "string" },
                            confidence: { type: "number" },
                        },
                        required: ["id", "fromRoomId", "toRoomId", "relationship", "confidence"],
                        additionalProperties: false,
                    },
                },
                uncertainties: {
                    type: "array",
                    items: { type: "string" },
                },
            },
            required: [
                "schemaVersion",
                "summary",
                "rooms",
                "doors",
                "windows",
                "walls",
                "relationships",
                "uncertainties",
            ],
            additionalProperties: false,
        },
    },
} as const;
const FLOOR_PLAN_ANALYSIS_PROMPT = `Analyze the supplied architectural floor-plan image. Report only visible evidence.

Identify visible rooms and possible functions (use null when unknown), doors, windows, walls, and spatial relationships. Use confidence from 0 to 1. Keep findings concise: one short sentence per evidence field, a brief relative location, and no more than 30 rooms, 40 doors, 40 windows, 60 meaningful wall spans, 60 relationships, and 20 uncertainties. Group continuous wall segments rather than listing every line fragment. Include obscured, ambiguous, or unidentifiable elements in uncertainties. Do not invent geometry or room functions.

Call the submit_floor_plan_analysis function exactly once with the result, rather than replying with prose or Markdown. Use this exact data shape:
{
  "schemaVersion": 1,
  "summary": "brief evidence-based overview",
  "rooms": [{ "id": "room-1", "label": "Room 1", "possibleFunction": null, "confidence": 0.4, "evidence": "visible cue" }],
  "doors": [{ "id": "door-1", "description": "visible door or opening", "location": "relative location", "confidence": 0.8, "evidence": "visible cue" }],
  "windows": [{ "id": "window-1", "description": "visible window", "location": "relative location", "confidence": 0.8, "evidence": "visible cue" }],
  "walls": [{ "id": "wall-1", "description": "visible wall segment", "location": "relative location", "confidence": 0.8, "evidence": "visible cue" }],
  "relationships": [{ "id": "relation-1", "fromRoomId": "room-1", "toRoomId": "room-2", "relationship": "opens into / adjacent to / separated by a wall", "confidence": 0.8 }],
  "uncertainties": ["uncertain or unidentifiable visible element"]
}
Use empty arrays when a category has no identifiable findings. For a room whose function is unclear, retain the room and set possibleFunction to null. This is conceptual interpretation, not verified CAD or BIM geometry.`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const getChatText = (content: unknown, depth = 0): string => {
    if (depth > 5) return "";
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .map((part) => getChatText(part, depth + 1))
            .filter(Boolean)
            .join("\n");
    }
    if (!isRecord(content)) return "";
    if (typeof content.text === "string") return content.text;
    for (const key of ["message", "choices", "content", "parts", "candidates", "output_text"]) {
        const text = getChatText(content[key], depth + 1);
        if (text) return text;
    }
    return "";
};

const getAnalysisToolArguments = (response: unknown): string | undefined => {
    const visit = (value: unknown, depth: number): string | undefined => {
        if (depth > 6) return undefined;
        if (Array.isArray(value)) {
            for (const item of value) {
                const result = visit(item, depth + 1);
                if (result) return result;
            }
            return undefined;
        }
        if (!isRecord(value)) return undefined;

        const functionCall = isRecord(value.functionCall)
            ? value.functionCall
            : isRecord(value.function_call)
                ? value.function_call
                : null;
        if (functionCall?.name === "submit_floor_plan_analysis") {
            const args = functionCall.arguments ?? functionCall.args;
            if (typeof args === "string") return args;
            if (isRecord(args)) return JSON.stringify(args);
        }

        if (Array.isArray(value.tool_calls)) {
            for (const call of value.tool_calls) {
                if (!isRecord(call) || !isRecord(call.function) ||
                    call.function.name !== "submit_floor_plan_analysis") continue;
                if (typeof call.function.arguments === "string") return call.function.arguments;
                if (isRecord(call.function.arguments)) return JSON.stringify(call.function.arguments);
            }
        }
        for (const key of ["message", "choices", "content", "parts", "candidates"]) {
            const result = visit(value[key], depth + 1);
            if (result) return result;
        }
        return undefined;
    };

    return visit(response, 0);
};

const describeChatResponse = (response: unknown): string => {
    if (!isRecord(response)) return `response type: ${Array.isArray(response) ? "array" : typeof response}`;
    const message = isRecord(response.message) ? response.message : null;
    const content = message?.content;
    const details = [
        `finish reason: ${typeof response.finish_reason === "string" ? response.finish_reason : "not provided"}`,
        `response fields: ${Object.keys(response).join(", ") || "none"}`,
    ];
    if (message) {
        details.push(`message fields: ${Object.keys(message).join(", ") || "none"}`);
        details.push(`content type: ${Array.isArray(content) ? "array" : typeof content}`);
    }
    return details.join("; ");
};

const getStopReason = (response: unknown): unknown =>
    isRecord(response) ? response.stopReason : undefined;

export const fetchAsDataUrl = async (url: string): Promise<string> => {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }

    const blob = await response.blob();

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });


};

export const generate3DView = async ({ sourceImage }: Generate3DViewParams) => {
    const dataUrl = sourceImage.startsWith('data:')
        ? sourceImage
        : await fetchAsDataUrl(sourceImage);

    const base64Data = dataUrl.split(',')[1];
    const mimeType = dataUrl.split(';')[0].split(':')[1];

    if(!mimeType || !base64Data) throw new Error('Invalid source image payload');

    const response = await puter.ai.txt2img(ARCHVISION_RENDER_PROMPT,{
        provider: "gemini",
        model: "gemini-3.1-flash-image-preview",
        input_image: base64Data,
        input_image_mime_type: mimeType,
        ratio: { w: 1024, h: 1024},
    });

    const rawImageUrl = response.src;

    if (!rawImageUrl) throw new Error("Gemini image generation returned no image");

    const renderedImage = rawImageUrl.startsWith('data:')
    ? rawImageUrl : await fetchAsDataUrl(rawImageUrl);

    return { renderedImage, renderedPath: undefined };
}

export const analyzeFloorPlan = async (sourceImage: string): Promise<FloorPlanAnalysis> => {
    if (!sourceImage) throw new Error("The project source image is unavailable.");
    const imageDataUrl = sourceImage.startsWith("data:")
        ? sourceImage
        : await fetchAsDataUrl(sourceImage);

    const response = await puter.ai.chat(
        FLOOR_PLAN_ANALYSIS_PROMPT,
        imageDataUrl,
        {
            provider: "gemini",
            model: FLOOR_PLAN_ANALYSIS_MODEL,
            vision: true,
            temperature: 0.1,
            max_tokens: 8192,
            normalize: true,
            tools: [FLOOR_PLAN_ANALYSIS_TOOL],
        },
    );
    const analysisArguments = getAnalysisToolArguments(response);
    const content = analysisArguments ?? getChatText(response);
    const stopReason = getStopReason(response);
    if (response.finish_reason === "length" || stopReason === "max_tokens") {
        throw new Error("The AI response was incomplete because it reached its output limit. Try analyzing the floor plan again.");
    }
    if (!content.trim()) {
        throw new Error(`The AI returned no floor-plan analysis (${describeChatResponse(response)}).`);
    }

    try {
        return parseFloorPlanAnalysis(content, FLOOR_PLAN_ANALYSIS_MODEL);
    } catch (error) {
        if (!analysisArguments) {
            throw new Error(
                `The AI did not return a structured floor-plan analysis (${describeChatResponse(response)}). Please try again.`,
            );
        }
        throw error;
    }
};