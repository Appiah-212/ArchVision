import type { GenerationMode } from "../lib/generation-types";

type GenerationModeSelectorProps = {
    value: GenerationMode;
    onChange: (mode: GenerationMode) => void;
};

const GenerationModeSelector = ({ value, onChange }: GenerationModeSelectorProps) => (
    <fieldset className="generation-mode-selector">
        <legend>Choose a generation workflow</legend>
        <label>
            <input
                type="radio"
                name="generation-mode"
                value="baseline"
                checked={value === "baseline"}
                onChange={() => onChange("baseline")}
            />
            <span>
                <strong>Baseline</strong>
                <small>Generate automatically with the original fixed prompt.</small>
            </span>
        </label>
        <label>
            <input
                type="radio"
                name="generation-mode"
                value="enhanced"
                checked={value === "enhanced"}
                onChange={() => onChange("enhanced")}
            />
            <span>
                <strong>Enhanced</strong>
                <small>Review the plan and save design preferences before you start generation.</small>
            </span>
        </label>
    </fieldset>
);

export default GenerationModeSelector;
