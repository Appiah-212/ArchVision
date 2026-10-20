import puter from "@heyputer/puter.js";
import { ARCHVISION_RENDER_PROMPT } from "./constants";
import { parseFloorPlanAnalysis, type FloorPlanAnalysis } from "./floor-plan-analysis";
import { buildEnhancedGenerationPrompt, ENHANCED_PROMPT_TEMPLATE_VERSION } from "./generation-prompt";
import { validateRenderConfiguration, type RenderConfiguration } from "./render-configuration";
import { normalizeGenerationMode } from "./generation-workflow";
import type { GenerationMetadata } from "./generation-types";

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

Return a compact but structured interpretation of the plan. Focus on the major architectural signal: the most likely rooms, key openings, major wall arrangements, adjacency, and meaningful uncertainty. Use confidence from 0 to 1. Keep evidence brief and do not invent geometry or room functions.

Hard limits for this pass:
- rooms: no more than 12
- doors: no more than 12
- windows: no more than 12
- walls: no more than 20
- relationships: no more than 12
- uncertainties: no more than 10
Group continuous wall segments rather than listing every line fragment.

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

const FLOOR_PLAN_ANALYSIS_DETAIL_PROMPT = (analysis: FloorPlanAnalysis) => `Review the compact floor-plan interpretation below and add only missing or ambiguous details that are directly supported by the same image. Preserve the original room IDs and do not invent unsupported geometry or functions.

Current summary:
${JSON.stringify({ summary: analysis.summary, rooms: analysis.rooms.slice(0, 8), walls: analysis.walls.slice(0, 12), doors: analysis.doors.slice(0, 8), windows: analysis.windows.slice(0, 8), relationships: analysis.relationships.slice(0, 8), uncertainties: analysis.uncertainties.slice(0, 8) }, null, 2)}

Keep this second-pass result compact. Add only the missing detail needed to complete the structural interpretation. Use the same schema and the same rules, but stay under the same limits and do not duplicate the same findings. Return only valid JSON for the submit_floor_plan_analysis function.`;

const FLOOR_PLAN_ANALYSIS_MINIMAL_PROMPT = `Analyze the supplied architectural floor-plan image and return only a minimal, safe structural summary. Be conservative and do not invent unsupported geometry or room functions.

Return a compact JSON object with:
- summary: brief evidence-based overview
- rooms: 0 to 4 rooms only, each with id, label, possibleFunction, confidence, evidence
- doors: 0 to 4 door/opening findings
- windows: 0 to 4 window findings
- walls: 0 to 8 wall findings
- relationships: 0 to 4 relationships
- uncertainties: 0 to 6 uncertainty notes

Use empty arrays when uncertain. Keep the output extremely short and valid JSON only.`;

const createFallbackFloorPlanAnalysis = (model: string): FloorPlanAnalysis => ({
    schemaVersion: 1,
    model,
    analyzedAt: new Date().toISOString(),
    summary: "The floor-plan analysis was simplified because the model reached its output limit; only conservative, evidence-based structure is reported.",
    rooms: [],
    doors: [],
    windows: [],
    walls: [],
    relationships: [],
    uncertainties: ["The full plan could not be extracted in one pass because the model hit its output limit; the summary is intentionally conservative."],
});

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

const normalizeStopReason = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const normalized = value.trim().toLowerCase().replace(/[_\s-]+/g, "_");
    return normalized || undefined;
};

const getStopReason = (response: unknown): string | undefined => {
    if (!isRecord(response)) return undefined;
    const candidates = [
        response.stopReason,
        response.stop_reason,
        response.finishReason,
        response.finish_reason,
    ];
    if (isRecord(response.message)) {
        candidates.push(
            response.message.stopReason,
            response.message.stop_reason,
            response.message.finishReason,
            response.message.finish_reason,
        );
    }
    for (const candidate of candidates) {
        const normalized = normalizeStopReason(candidate);
        if (normalized) return normalized;
    }
    return undefined;
};

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

export const GENERATION_MODEL_IDENTIFIER = "gemini-3.1-flash-image-preview";
const BASELINE_PROMPT_TEMPLATE_VERSION = "archvision-baseline-v1";

export const generate3DView = async ({
    sourceImage,
    generationMode: untrustedMode,
    analysis,
    configuration: untrustedConfiguration,
    approvedAnalysisRevision,
    generationTimestamp,
}: Generate3DViewParams): Promise<{
    renderedImage: string;
    renderedPath: undefined;
    generationMetadata: GenerationMetadata;
}> => {
    const generationMode = normalizeGenerationMode(untrustedMode);
    let prompt = ARCHVISION_RENDER_PROMPT;
    let configurationSnapshot: RenderConfiguration | null = null;
    let revision: number | null = null;

    if (generationMode === "enhanced") {
        if (!analysis) throw new Error("Enhanced generation requires approved floor-plan analysis.");
        if (!untrustedConfiguration) throw new Error("Enhanced generation requires saved design settings.");
        if (!Number.isSafeInteger(approvedAnalysisRevision) || (approvedAnalysisRevision ?? 0) < 1) {
            throw new Error("Enhanced generation requires a current approved analysis revision.");
        }
        configurationSnapshot = validateRenderConfiguration(untrustedConfiguration);
        prompt = buildEnhancedGenerationPrompt(analysis, configurationSnapshot);
        revision = approvedAnalysisRevision!;
    }

    const dataUrl = sourceImage.startsWith('data:')
        ? sourceImage
        : await fetchAsDataUrl(sourceImage);

    const base64Data = dataUrl.split(',')[1];
    const mimeType = dataUrl.split(';')[0].split(':')[1];

    if(!mimeType || !base64Data) throw new Error('Invalid source image payload');

    const startTime = Date.now();
    const response = await puter.ai.txt2img(prompt,{
        provider: "gemini",
        model: GENERATION_MODEL_IDENTIFIER,
        input_image: base64Data,
        input_image_mime_type: mimeType,
        ratio: { w: 1024, h: 1024},
    });

    const rawImageUrl = response?.src;

    if (!rawImageUrl) throw new Error("Gemini image generation returned no image");

    const renderedImage = rawImageUrl.startsWith('data:')
    ? rawImageUrl : await fetchAsDataUrl(rawImageUrl);

    const metadata: GenerationMetadata = {
        generationMode,
        modelIdentifier: GENERATION_MODEL_IDENTIFIER,
        promptTemplateVersion: generationMode === "baseline"
            ? BASELINE_PROMPT_TEMPLATE_VERSION
            : ENHANCED_PROMPT_TEMPLATE_VERSION,
        configurationSnapshot,
        approvedAnalysisRevision: revision,
        generationTimestamp: generationTimestamp ?? new Date().toISOString(),
        generationStatus: "complete",
        generationLatencyMs: Math.max(0, Date.now() - startTime),
    };
    return { renderedImage, renderedPath: undefined, generationMetadata: metadata };
}

const mergeFloorPlanAnalysis = (base: FloorPlanAnalysis, extra: FloorPlanAnalysis): FloorPlanAnalysis => {
    const roomMap = new Map(base.rooms.map((room) => [room.id, room]));
    const doorMap = new Map(base.doors.map((door) => [door.id, door]));
    const windowMap = new Map(base.windows.map((window) => [window.id, window]));
    const wallMap = new Map(base.walls.map((wall) => [wall.id, wall]));
    const relationshipMap = new Map(base.relationships.map((relationship) => [relationship.id, relationship]));
    const uncertaintySet = new Set(base.uncertainties);

    for (const room of extra.rooms) {
        if (!roomMap.has(room.id)) roomMap.set(room.id, room);
    }
    for (const door of extra.doors) {
        if (!doorMap.has(door.id)) doorMap.set(door.id, door);
    }
    for (const window of extra.windows) {
        if (!windowMap.has(window.id)) windowMap.set(window.id, window);
    }
    for (const wall of extra.walls) {
        if (!wallMap.has(wall.id)) wallMap.set(wall.id, wall);
    }
    for (const relationship of extra.relationships) {
        if (!relationshipMap.has(relationship.id)) relationshipMap.set(relationship.id, relationship);
    }
    for (const uncertainty of extra.uncertainties) {
        uncertaintySet.add(uncertainty);
    }

    return {
        schemaVersion: 1,
        model: base.model,
        analyzedAt: base.analyzedAt,
        summary: base.summary || extra.summary,
        rooms: Array.from(roomMap.values()),
        doors: Array.from(doorMap.values()),
        windows: Array.from(windowMap.values()),
        walls: Array.from(wallMap.values()),
        relationships: Array.from(relationshipMap.values()),
        uncertainties: Array.from(uncertaintySet),
    };
};

const shouldExpandFloorPlanAnalysis = (analysis: FloorPlanAnalysis): boolean => {
    const totalFindings = analysis.rooms.length + analysis.doors.length + analysis.windows.length + analysis.walls.length + analysis.relationships.length;
    return totalFindings >= 20 || analysis.uncertainties.length >= 6;
};

const runFloorPlanAnalysisRequest = async (
    sourceImage: string,
    prompt: string,
): Promise<string> => {
    const response = await puter.ai.chat(
        prompt,
        sourceImage,
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
    const responseRecord = isRecord(response) ? response : {};
    const messageRecord = isRecord(responseRecord.message) ? responseRecord.message as Record<string, unknown> : {};
    const normalizedFinishReason = normalizeStopReason(
        typeof responseRecord.finish_reason === "string" ? responseRecord.finish_reason :
            typeof messageRecord.finish_reason === "string" ? String(messageRecord.finish_reason) :
                undefined,
    );
    const isOutputLimit = normalizedFinishReason === "length"
        || normalizedFinishReason === "max_tokens"
        || stopReason === "length"
        || stopReason === "max_tokens";
    if (isOutputLimit) {
        return "";
    }
    if (!content.trim()) {
        throw new Error(`The AI returned no floor-plan analysis (${describeChatResponse(response)}).`);
    }
    return content;
};

export const analyzeFloorPlan = async (sourceImage: string): Promise<FloorPlanAnalysis> => {
    if (!sourceImage) throw new Error("The project source image is unavailable.");
    const imageDataUrl = sourceImage.startsWith("data:")
        ? sourceImage
        : await fetchAsDataUrl(sourceImage);

    try {
        const compactAnalysisText = await runFloorPlanAnalysisRequest(imageDataUrl, FLOOR_PLAN_ANALYSIS_PROMPT);
        if (!compactAnalysisText.trim()) {
            return createFallbackFloorPlanAnalysis(FLOOR_PLAN_ANALYSIS_MODEL);
        }
        if (!compactAnalysisText.includes("{")) {
            throw new Error("The AI did not return a structured floor-plan analysis.");
        }

        const compactAnalysis = parseFloorPlanAnalysis(compactAnalysisText, FLOOR_PLAN_ANALYSIS_MODEL);

        if (!shouldExpandFloorPlanAnalysis(compactAnalysis)) {
            return compactAnalysis;
        }

        try {
            const detailedAnalysisText = await runFloorPlanAnalysisRequest(
                imageDataUrl,
                FLOOR_PLAN_ANALYSIS_DETAIL_PROMPT(compactAnalysis),
            );
            if (!detailedAnalysisText.trim() || !detailedAnalysisText.includes("{")) {
                return compactAnalysis;
            }

            const detailedAnalysis = parseFloorPlanAnalysis(detailedAnalysisText, FLOOR_PLAN_ANALYSIS_MODEL);
            return mergeFloorPlanAnalysis(compactAnalysis, detailedAnalysis);
        } catch (detailError) {
            const detailMessage = detailError instanceof Error ? detailError.message : String(detailError);
            if (detailMessage.includes("output limit") || detailMessage.includes("output_limit")) {
                return compactAnalysis;
            }
            throw detailError;
        }
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message.includes("finish reason: stop") && message.includes("content type: object")) {
            throw error;
        }
        if (message.includes("output limit") ||
            message.includes("output_limit") ||
            message.includes("The AI did not return a structured floor-plan analysis") ||
            message.includes("The AI returned no floor-plan analysis") ||
            message.includes("The AI returned invalid JSON for the floor-plan analysis") ||
            message.includes("The AI returned an invalid floor-plan analysis") ||
            message.includes("unsupported floor-plan analysis format")) {
            return createFallbackFloorPlanAnalysis(FLOOR_PLAN_ANALYSIS_MODEL);
        }
        return createFallbackFloorPlanAnalysis(FLOOR_PLAN_ANALYSIS_MODEL);
    }
};