import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import GenerationModeSelector from "../components/GenerationModeSelector";

describe("generation mode selection", () => {
    it("shows baseline as a distinct choice and emits enhanced opt-in", () => {
        const onChange = vi.fn();
        render(<GenerationModeSelector value="baseline" onChange={onChange} />);

        expect(screen.getByRole("radio", { name: /baseline/i })).toBeChecked();
        fireEvent.click(screen.getByRole("radio", { name: /enhanced/i }));
        expect(onChange).toHaveBeenCalledWith("enhanced");
    });
});
