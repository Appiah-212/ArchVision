import type { GenerationMode } from "../lib/generation-types";

type GenerationModeSelectorProps = {
    value: GenerationMode;
    onChange: (mode: GenerationMode) => void;
};

const GenerationModeSelector = ({ value, onChange }: GenerationModeSelectorProps) => (
    <fieldset className="generation-mode-selector">
        <legend>Choose a render workflow</legend>
        <label className="generation-mode-option">
            <input
                type="radio"
                name="generation-mode"
                value="baseline"
                checked={value === "baseline"}
                onChange={() => onChange("baseline")}
            />
            <span className="generation-mode-option__copy">
                <strong>Baseline</strong>
                <small>Generate with ArchVision's original prompt.</small>
            </span>
        </label>
        <label className="generation-mode-option">
            <input
                type="radio"
                name="generation-mode"
                value="enhanced"
                checked={value === "enhanced"}
                onChange={() => onChange("enhanced")}
            />
            <span className="generation-mode-option__copy">
                <strong>Enhanced</strong>
                <small>Review the floor plan and set design preferences first.</small>
            </span>
        </label>
    </fieldset>
);

export default GenerationModeSelector;
