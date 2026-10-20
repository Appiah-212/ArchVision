import { useEffect, useState } from "react";
import { Check, RotateCcw, Save } from "lucide-react";
import Button from "./ui/button";
import {
    ARCHITECTURAL_STYLES,
    ARCHITECTURAL_STYLE_PRESETS,
    COLOR_PALETTES,
    FURNITURE_STYLES,
    FLOORING_MATERIALS,
    LIGHTING_OPTIONS,
    WALL_FINISHES,
    VISUALIZATION_PERSPECTIVES,
    applyRenderPreset,
    createDefaultRenderConfiguration,
    validateRenderConfiguration,
    type ArchitecturalStyle,
    type CustomizableDesignField,
    type RenderConfiguration,
} from "../lib/render-configuration";

type ArchitecturalDesignSettingsPanelProps = {
    savedConfiguration?: unknown;
    isOwner: boolean;
    onSave: (configuration: RenderConfiguration) => Promise<RenderConfiguration>;
};

const CUSTOM_LABELS: Record<CustomizableDesignField, string> = {
    architecturalStyle: "Describe your architectural style",
    flooringMaterial: "Describe your custom floor material",
    wallFinish: "Describe your custom wall finish",
    colorPalette: "Describe your custom color palette",
    lighting: "Describe your custom lighting",
    furnitureStyle: "Describe your custom furniture style",
};

const normalizeForComparison = (configuration: RenderConfiguration) => ({
    ...configuration,
    updatedAt: "",
});

const ArchitecturalDesignSettingsPanel = ({
    savedConfiguration,
    isOwner,
    onSave,
}: ArchitecturalDesignSettingsPanelProps) => {
    const [saved, setSaved] = useState<RenderConfiguration | null>(null);
    const [draft, setDraft] = useState(createDefaultRenderConfiguration);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (savedConfiguration === undefined || savedConfiguration === null) {
            setSaved(null);
            setDraft(createDefaultRenderConfiguration());
            setError(null);
            return;
        }
        try {
            const validated = validateRenderConfiguration(savedConfiguration);
            setSaved(validated);
            setDraft(validated);
            setError(null);
        } catch (cause) {
            setSaved(null);
            setDraft(createDefaultRenderConfiguration());
            setError(cause instanceof Error ? cause.message : "Saved design settings are invalid.");
        }
    }, [savedConfiguration]);

    const hasChanges = !saved ||
        JSON.stringify(normalizeForComparison(draft)) !==
        JSON.stringify(normalizeForComparison(saved));

    const update = <K extends keyof RenderConfiguration>(
        field: K,
        value: RenderConfiguration[K],
    ) => {
        setDraft((current) => ({ ...current, [field]: value }));
        setError(null);
    };

    const selectCustomizable = <K extends CustomizableDesignField>(
        field: K,
        value: RenderConfiguration[K],
    ) => {
        setDraft((current) => {
            const customValues = { ...current.customValues };
            if (value !== "Custom") delete customValues[field];
            return { ...current, [field]: value, customValues };
        });
        setError(null);
    };

    const changePreset = (value: string) => {
        if (!ARCHITECTURAL_STYLES.includes(value as ArchitecturalStyle)) return;
        setDraft(applyRenderPreset(value as ArchitecturalStyle));
        setError(null);
    };

    const reset = () => {
        setDraft(createDefaultRenderConfiguration());
        setError(null);
    };

    const save = async () => {
        setIsSaving(true);
        setError(null);
        try {
            const configuration = validateRenderConfiguration({
                ...draft,
                updatedAt: new Date().toISOString(),
            });
            const persisted = await onSave(configuration);
            setSaved(persisted);
            setDraft(persisted);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Unable to save design settings.");
        } finally {
            setIsSaving(false);
        }
    };

    const customInput = (field: CustomizableDesignField) =>
        draft[field] === "Custom" ? (
            <label className="design-custom-field" htmlFor={`design-custom-${field}`}>
                {CUSTOM_LABELS[field]}
                <input
                    id={`design-custom-${field}`}
                    aria-label={CUSTOM_LABELS[field]}
                    value={draft.customValues[field] ?? ""}
                    maxLength={100}
                    disabled={!isOwner || isSaving}
                    aria-required="true"
                    onChange={(event) => setDraft((current) => ({
                        ...current,
                        customValues: {
                            ...current.customValues,
                            [field]: event.target.value,
                        },
                    }))}
                />
                <span>Required when Custom is selected. Maximum 100 characters.</span>
            </label>
        ) : null;

    return (
        <section className="design-settings-panel" aria-labelledby="design-settings-title">
            <div className="design-settings-header">
                <div>
                    <p className="design-settings-eyebrow">Aesthetic configuration</p>
                    <h2 id="design-settings-title">Architectural design settings</h2>
                    <p>
                        Set visual preferences for enhanced generation. Structural findings remain
                        separate and take precedence over aesthetic preferences.
                    </p>
                </div>
                {isOwner && (
                    <div className="design-settings-actions">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={reset}
                            disabled={isSaving}
                        >
                            <RotateCcw className="design-settings-icon" aria-hidden="true" />
                            Reset to defaults
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => void save()}
                            disabled={isSaving || !hasChanges}
                        >
                            {isSaving
                                ? <span className="design-settings-spinner" aria-hidden="true" />
                                : <Save className="design-settings-icon" aria-hidden="true" />}
                            {isSaving ? "Saving..." : "Save settings"}
                        </Button>
                    </div>
                )}
            </div>

            <div className="design-settings-body">
                <p className="design-settings-notice">
                    Preferences are used only when Enhanced generation is selected. Baseline
                    generation continues to use its original fixed prompt.
                </p>
                <p className="design-settings-state" role="status">
                    {hasChanges
                        ? saved ? "Unsaved changes" : "Defaults not saved"
                        : `Saved${saved ? ` · ${new Date(saved.updatedAt).toLocaleString()}` : ""}`}
                </p>
                {error && <p className="design-settings-error" role="alert">{error}</p>}
                {!isOwner && (
                    <p className="design-settings-notice" role="status">
                        Only the project owner can change these settings.
                    </p>
                )}

                <div className="design-settings-grid">
                    <div className="design-control">
                        <label htmlFor="design-style">Architectural style</label>
                        <select
                            id="design-style"
                            value={draft.architecturalStyle}
                            disabled={!isOwner || isSaving}
                            onChange={(event) => changePreset(event.target.value)}
                        >
                            {ARCHITECTURAL_STYLES.map((style) => (
                                <option key={style} value={style}>{style}</option>
                            ))}
                        </select>
                        <p className="design-control-help">
                            {ARCHITECTURAL_STYLE_PRESETS[draft.architecturalStyle].description}
                        </p>
                        {customInput("architecturalStyle")}
                    </div>

                    <DesignSelect
                        id="design-flooring"
                        label="Floor material"
                        value={draft.flooringMaterial}
                        options={FLOORING_MATERIALS}
                        disabled={!isOwner || isSaving}
                        onChange={(value) => selectCustomizable("flooringMaterial", value)}
                    />
                    {customInput("flooringMaterial")}
                    <DesignSelect
                        id="design-wall-finish"
                        label="Wall finish"
                        value={draft.wallFinish}
                        options={WALL_FINISHES}
                        disabled={!isOwner || isSaving}
                        onChange={(value) => selectCustomizable("wallFinish", value)}
                    />
                    {customInput("wallFinish")}
                    <DesignSelect
                        id="design-palette"
                        label="Color palette"
                        value={draft.colorPalette}
                        options={COLOR_PALETTES}
                        disabled={!isOwner || isSaving}
                        onChange={(value) => selectCustomizable("colorPalette", value)}
                    />
                    {customInput("colorPalette")}
                    <DesignSelect
                        id="design-lighting"
                        label="Lighting"
                        value={draft.lighting}
                        options={LIGHTING_OPTIONS}
                        disabled={!isOwner || isSaving}
                        onChange={(value) => selectCustomizable("lighting", value)}
                    />
                    {customInput("lighting")}
                    <DesignSelect
                        id="design-furniture"
                        label="Furniture"
                        value={draft.furnitureStyle}
                        options={FURNITURE_STYLES}
                        disabled={!isOwner || isSaving}
                        onChange={(value) => selectCustomizable("furnitureStyle", value)}
                    />
                    {customInput("furnitureStyle")}
                    <DesignSelect
                        id="design-perspective"
                        label="Visualization perspective"
                        value={draft.perspective}
                        options={VISUALIZATION_PERSPECTIVES}
                        disabled={!isOwner || isSaving}
                        onChange={(value) => update("perspective", value)}
                    />
                </div>

                <label
                    className="design-custom-field design-instructions"
                    htmlFor="design-instructions"
                >
                    Additional design instructions
                    <textarea
                        id="design-instructions"
                        aria-label="Additional design instructions"
                        value={draft.customInstructions}
                        maxLength={500}
                        disabled={!isOwner || isSaving}
                        placeholder="Optional visual preferences for the enhanced visualization."
                        onChange={(event) => update("customInstructions", event.target.value)}
                    />
                    <span>{draft.customInstructions.length}/500 characters. Sent as untrusted visual guidance only for Enhanced generation.</span>
                </label>
                <p className="design-structure-note">
                    Structural observations (rooms, walls, doors, windows, relationships, and
                    approved analysis) remain separate and unchanged by aesthetic settings.
                </p>
            </div>
        </section>
    );
};

const DesignSelect = <T extends string>({
    id,
    label,
    value,
    options,
    disabled,
    onChange,
}: {
    id: string;
    label: string;
    value: T;
    options: readonly T[];
    disabled: boolean;
    onChange: (value: T) => void;
}) => (
    <div className="design-control">
        <label htmlFor={id}>{label}</label>
        <select
            id={id}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value as T)}
        >
            {options.map((option) => (
                <option key={option} value={option}>{option}</option>
            ))}
        </select>
    </div>
);

export default ArchitecturalDesignSettingsPanel;
