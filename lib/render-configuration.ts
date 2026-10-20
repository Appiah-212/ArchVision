export const ARCHITECTURAL_STYLES = [
    "Modern",
    "Contemporary",
    "Minimalist",
    "Scandinavian",
    "Industrial",
    "Mediterranean",
    "Traditional",
    "Custom",
] as const;

export const FLOORING_MATERIALS = [
    "Hardwood",
    "Ceramic tile",
    "Marble",
    "Concrete",
    "Vinyl",
    "Custom",
] as const;

export const WALL_FINISHES = [
    "Painted plaster",
    "Exposed brick",
    "Concrete",
    "Wood paneling",
    "Stone",
    "Custom",
] as const;

export const COLOR_PALETTES = [
    "Neutral",
    "Warm earth tones",
    "Cool tones",
    "Monochrome",
    "Natural",
    "Custom",
] as const;

export const LIGHTING_OPTIONS = [
    "Natural daylight",
    "Warm ambient",
    "Bright studio",
    "Evening atmosphere",
    "Custom",
] as const;

export const FURNITURE_STYLES = [
    "Modern",
    "Minimalist",
    "Scandinavian",
    "Traditional",
    "Contemporary",
    "Custom",
] as const;

export const VISUALIZATION_PERSPECTIVES = [
    "Top-down 3D-style view",
    "Isometric view",
    "Angled architectural view",
] as const;

export type ArchitecturalStyle = typeof ARCHITECTURAL_STYLES[number];
export type FlooringMaterial = typeof FLOORING_MATERIALS[number];
export type WallFinish = typeof WALL_FINISHES[number];
export type ColorPalette = typeof COLOR_PALETTES[number];
export type LightingOption = typeof LIGHTING_OPTIONS[number];
export type FurnitureStyle = typeof FURNITURE_STYLES[number];
export type VisualizationPerspective = typeof VISUALIZATION_PERSPECTIVES[number];

export type CustomizableDesignField =
    | "architecturalStyle"
    | "flooringMaterial"
    | "wallFinish"
    | "colorPalette"
    | "lighting"
    | "furnitureStyle";

export interface RenderConfiguration {
    schemaVersion: 1;
    architecturalStyle: ArchitecturalStyle;
    flooringMaterial: FlooringMaterial;
    wallFinish: WallFinish;
    colorPalette: ColorPalette;
    lighting: LightingOption;
    furnitureStyle: FurnitureStyle;
    perspective: VisualizationPerspective;
    customInstructions: string;
    customValues: Partial<Record<CustomizableDesignField, string>>;
    updatedAt: string;
}

export type RenderPreset = Omit<RenderConfiguration, "schemaVersion" | "updatedAt"> & {
    description: string;
};

export const ARCHITECTURAL_STYLE_PRESETS: Record<ArchitecturalStyle, RenderPreset> = {
    Modern: {
        description: "Clean contemporary lines, balanced contrast, and refined natural finishes.",
        architecturalStyle: "Modern",
        flooringMaterial: "Hardwood",
        wallFinish: "Painted plaster",
        colorPalette: "Neutral",
        lighting: "Natural daylight",
        furnitureStyle: "Modern",
        perspective: "Top-down 3D-style view",
        customInstructions: "",
        customValues: {},
    },
    Contemporary: {
        description: "Current, comfortable design with a mix of polished and tactile materials.",
        architecturalStyle: "Contemporary",
        flooringMaterial: "Hardwood",
        wallFinish: "Painted plaster",
        colorPalette: "Warm earth tones",
        lighting: "Natural daylight",
        furnitureStyle: "Contemporary",
        perspective: "Angled architectural view",
        customInstructions: "",
        customValues: {},
    },
    Minimalist: {
        description: "Restrained forms, uncluttered rooms, and a quiet monochrome palette.",
        architecturalStyle: "Minimalist",
        flooringMaterial: "Concrete",
        wallFinish: "Painted plaster",
        colorPalette: "Monochrome",
        lighting: "Bright studio",
        furnitureStyle: "Minimalist",
        perspective: "Top-down 3D-style view",
        customInstructions: "",
        customValues: {},
    },
    Scandinavian: {
        description: "Light timber, soft natural colors, and functional, welcoming furnishings.",
        architecturalStyle: "Scandinavian",
        flooringMaterial: "Hardwood",
        wallFinish: "Painted plaster",
        colorPalette: "Natural",
        lighting: "Natural daylight",
        furnitureStyle: "Scandinavian",
        perspective: "Isometric view",
        customInstructions: "",
        customValues: {},
    },
    Industrial: {
        description: "Expressive structural materials, tactile surfaces, and practical lighting.",
        architecturalStyle: "Industrial",
        flooringMaterial: "Concrete",
        wallFinish: "Exposed brick",
        colorPalette: "Monochrome",
        lighting: "Bright studio",
        furnitureStyle: "Modern",
        perspective: "Angled architectural view",
        customInstructions: "",
        customValues: {},
    },
    Mediterranean: {
        description: "Sun-warmed surfaces, earthy colors, and natural stone accents.",
        architecturalStyle: "Mediterranean",
        flooringMaterial: "Ceramic tile",
        wallFinish: "Stone",
        colorPalette: "Warm earth tones",
        lighting: "Natural daylight",
        furnitureStyle: "Traditional",
        perspective: "Isometric view",
        customInstructions: "",
        customValues: {},
    },
    Traditional: {
        description: "Timeless detailing, warm materials, and familiar, comfortably arranged furniture.",
        architecturalStyle: "Traditional",
        flooringMaterial: "Hardwood",
        wallFinish: "Wood paneling",
        colorPalette: "Warm earth tones",
        lighting: "Warm ambient",
        furnitureStyle: "Traditional",
        perspective: "Angled architectural view",
        customInstructions: "",
        customValues: {},
    },
    Custom: {
        description: "Choose your own style and tailor each material, color, and lighting control.",
        architecturalStyle: "Custom",
        flooringMaterial: "Hardwood",
        wallFinish: "Painted plaster",
        colorPalette: "Neutral",
        lighting: "Natural daylight",
        furnitureStyle: "Modern",
        perspective: "Top-down 3D-style view",
        customInstructions: "",
        customValues: {},
    },
};

export const createDefaultRenderConfiguration = (
    updatedAt = new Date().toISOString(),
): RenderConfiguration => ({
    schemaVersion: 1,
    architecturalStyle: "Modern",
    flooringMaterial: "Hardwood",
    wallFinish: "Painted plaster",
    colorPalette: "Neutral",
    lighting: "Natural daylight",
    furnitureStyle: "Modern",
    perspective: "Top-down 3D-style view",
    customInstructions: "",
    customValues: {},
    updatedAt,
});

export const isRenderConfiguration = (value: unknown): value is RenderConfiguration => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
    const configuration = value as Record<string, unknown>;
    const expectedFields = new Set([
        "schemaVersion",
        "architecturalStyle",
        "flooringMaterial",
        "wallFinish",
        "colorPalette",
        "lighting",
        "furnitureStyle",
        "perspective",
        "customInstructions",
        "customValues",
        "updatedAt",
    ]);
    if (Object.keys(configuration).length !== expectedFields.size ||
        Object.keys(configuration).some((field) => !expectedFields.has(field))) {
        return false;
    }
    const choices = {
        architecturalStyle: ARCHITECTURAL_STYLES,
        flooringMaterial: FLOORING_MATERIALS,
        wallFinish: WALL_FINISHES,
        colorPalette: COLOR_PALETTES,
        lighting: LIGHTING_OPTIONS,
        furnitureStyle: FURNITURE_STYLES,
        perspective: VISUALIZATION_PERSPECTIVES,
    };

    if (configuration.schemaVersion !== 1 ||
        typeof configuration.updatedAt !== "string" ||
        !Number.isFinite(Date.parse(configuration.updatedAt)) ||
        typeof configuration.customInstructions !== "string" ||
        configuration.customInstructions.length > 500) {
        return false;
    }
    for (const [field, options] of Object.entries(choices)) {
        if (!options.includes(configuration[field] as never)) return false;
    }

    const customValues = configuration.customValues;
    if (typeof customValues !== "object" || customValues === null || Array.isArray(customValues)) {
        return false;
    }
    const customValueMap = customValues as Record<string, unknown>;
    const validCustomFields = new Set<CustomizableDesignField>([
        "architecturalStyle",
        "flooringMaterial",
        "wallFinish",
        "colorPalette",
        "lighting",
        "furnitureStyle",
    ]);
    for (const [field, value] of Object.entries(customValues)) {
        if (!validCustomFields.has(field as CustomizableDesignField) ||
            typeof value !== "string" || !value.trim() || value.length > 100) {
            return false;
        }
    }

    return (Object.keys(choices) as CustomizableDesignField[]).every((field) =>
        configuration[field] !== "Custom" ||
        (typeof customValueMap[field] === "string" && customValueMap[field].trim().length > 0),
    );
};

export const validateRenderConfiguration = (value: unknown): RenderConfiguration => {
    if (!isRenderConfiguration(value)) {
        throw new Error("Design settings are invalid. Check custom values and required fields.");
    }
    return {
        schemaVersion: 1,
        architecturalStyle: value.architecturalStyle,
        flooringMaterial: value.flooringMaterial,
        wallFinish: value.wallFinish,
        colorPalette: value.colorPalette,
        lighting: value.lighting,
        furnitureStyle: value.furnitureStyle,
        perspective: value.perspective,
        customInstructions: value.customInstructions,
        customValues: { ...value.customValues },
        updatedAt: value.updatedAt,
    };
};

export const applyRenderPreset = (
    style: ArchitecturalStyle,
    updatedAt = new Date().toISOString(),
): RenderConfiguration => {
    const { description: _description, ...preset } = ARCHITECTURAL_STYLE_PRESETS[style];
    return {
        schemaVersion: 1,
        ...preset,
        updatedAt,
    };
};
