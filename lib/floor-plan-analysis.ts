export interface FloorPlanRoom {
    id: string;
    label: string;
    possibleFunction: string | null;
    confidence: number;
    evidence: string;
}

export interface FloorPlanFinding {
    id: string;
    description: string;
    location: string;
    confidence: number;
    evidence: string;
}

export interface FloorPlanRelationship {
    id: string;
    fromRoomId: string;
    toRoomId: string;
    relationship: string;
    confidence: number;
}

export interface FloorPlanAnalysis {
    schemaVersion: 1;
    model: string;
    analyzedAt: string;
    summary: string;
    rooms: FloorPlanRoom[];
    doors: FloorPlanFinding[];
    windows: FloorPlanFinding[];
    walls: FloorPlanFinding[];
    relationships: FloorPlanRelationship[];
    uncertainties: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === "object" && value !== null && !Array.isArray(value);

const requireText = (value: unknown, field: string, maxLength = 1000): string => {
    if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
        throw new Error(`Floor-plan analysis contains an invalid ${field}.`);
    }
    return value.trim();
};

const requireConfidence = (value: unknown): number => {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
        throw new Error("Floor-plan analysis contains an invalid confidence value.");
    }
    return value;
};

const requireList = (value: unknown, field: string, maxLength: number): unknown[] => {
    if (!Array.isArray(value) || value.length > maxLength) {
        throw new Error(`Floor-plan analysis contains an invalid ${field} list.`);
    }
    return value;
};

export const validateFloorPlanAnalysis = (value: unknown): FloorPlanAnalysis => {
    if (!isRecord(value) || value.schemaVersion !== 1) {
        throw new Error("The AI returned an unsupported floor-plan analysis format.");
    }

    const rooms = requireList(value.rooms, "room", 100).map((room, index): FloorPlanRoom => {
        if (!isRecord(room)) throw new Error("Floor-plan analysis contains an invalid room.");
        const possibleFunction = room.possibleFunction;
        if (possibleFunction !== null && typeof possibleFunction !== "string") {
            throw new Error("Floor-plan analysis contains an invalid possible room function.");
        }
        return {
            id: requireText(room.id, `room ${index + 1} id`, 80),
            label: requireText(room.label, `room ${index + 1} label`, 120),
            possibleFunction: possibleFunction === null
                ? null
                : requireText(possibleFunction, `room ${index + 1} function`, 120),
            confidence: requireConfidence(room.confidence),
            evidence: requireText(room.evidence, `room ${index + 1} evidence`),
        };
    });
    const roomIds = new Set(rooms.map(({ id }) => id));
    if (roomIds.size !== rooms.length) {
        throw new Error("Floor-plan analysis contains duplicate room ids.");
    }

    const findings = (value: unknown, field: string): FloorPlanFinding[] => {
        const parsed = requireList(value, field, 200).map((finding, index) => {
            if (!isRecord(finding)) {
                throw new Error(`Floor-plan analysis contains an invalid ${field} finding.`);
            }
            return {
                id: requireText(finding.id, `${field} ${index + 1} id`, 80),
                description: requireText(finding.description, `${field} ${index + 1} description`),
                location: requireText(finding.location, `${field} ${index + 1} location`, 300),
                confidence: requireConfidence(finding.confidence),
                evidence: requireText(finding.evidence, `${field} ${index + 1} evidence`),
            };
        });
        if (new Set(parsed.map(({ id }) => id)).size !== parsed.length) {
            throw new Error(`Floor-plan analysis contains duplicate ${field} ids.`);
        }
        return parsed;
    };

    const relationships = requireList(value.relationships, "relationship", 300)
        .map((relationship, index): FloorPlanRelationship => {
            if (!isRecord(relationship)) {
                throw new Error("Floor-plan analysis contains an invalid relationship.");
            }
            const fromRoomId = requireText(relationship.fromRoomId, "relationship source room", 80);
            const toRoomId = requireText(relationship.toRoomId, "relationship target room", 80);
            if (!roomIds.has(fromRoomId) || !roomIds.has(toRoomId)) {
                throw new Error("Floor-plan analysis references an unknown room.");
            }
            return {
                id: requireText(relationship.id, `relationship ${index + 1} id`, 80),
                fromRoomId,
                toRoomId,
                relationship: requireText(relationship.relationship, "relationship description", 300),
                confidence: requireConfidence(relationship.confidence),
            };
        });
    if (new Set(relationships.map(({ id }) => id)).size !== relationships.length) {
        throw new Error("Floor-plan analysis contains duplicate relationship ids.");
    }
    const uncertainties = requireList(value.uncertainties, "uncertainty", 100)
        .map((item, index) => requireText(item, `uncertainty ${index + 1}`, 500));

    return {
        schemaVersion: 1,
        model: requireText(value.model, "model", 120),
        analyzedAt: requireText(value.analyzedAt, "analysis timestamp", 80),
        summary: requireText(value.summary, "summary", 2000),
        rooms,
        doors: findings(value.doors, "door"),
        windows: findings(value.windows, "window"),
        walls: findings(value.walls, "wall"),
        relationships,
        uncertainties,
    };
};

export const parseFloorPlanAnalysis = (
    content: string,
    model: string,
    analyzedAt = new Date().toISOString(),
): FloorPlanAnalysis => {
    const findJsonObject = (text: string): string | null => {
        const start = text.indexOf("{");
        if (start < 0) return null;

        let depth = 0;
        let inString = false;
        let escaped = false;
        for (let index = start; index < text.length; index += 1) {
            const character = text[index];
            if (inString) {
                if (escaped) escaped = false;
                else if (character === "\\") escaped = true;
                else if (character === "\"") inString = false;
                continue;
            }
            if (character === "\"") inString = true;
            else if (character === "{") depth += 1;
            else if (character === "}") {
                depth -= 1;
                if (depth === 0) return text.slice(start, index + 1);
            }
        }
        return null;
    };

    const json = findJsonObject(content.replace(/^\uFEFF/, ""));
    if (!json) {
        throw new Error("The AI returned invalid JSON for the floor-plan analysis.");
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(json);
    } catch {
        throw new Error("The AI returned invalid JSON for the floor-plan analysis.");
    }

    if (!isRecord(parsed)) {
        throw new Error("The AI returned an invalid floor-plan analysis.");
    }
    return validateFloorPlanAnalysis({
        ...parsed,
        schemaVersion: 1,
        model,
        analyzedAt,
    });
};
