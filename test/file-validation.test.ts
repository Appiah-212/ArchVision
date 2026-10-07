import { describe, expect, it } from 'vitest';
import {
  MAX_FLOOR_PLAN_SIZE,
  validateFloorPlanFile,
} from '../lib/file-validation';

describe('Floor-plan file validation', () => {
  it('accepts a valid PNG floor plan', () => {
    const file = new File(
      ['floor-plan'],
      'house-plan.png',
      { type: 'image/png' },
    );

    const result = validateFloorPlanFile(file);

    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('rejects an unsupported file type', () => {
    const file = new File(
      ['not-an-image'],
      'document.pdf',
      { type: 'application/pdf' },
    );

    const result = validateFloorPlanFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'Only JPG and PNG floor plans are supported.',
    );
  });

  it('rejects a file larger than 50 MB', () => {
    const file = new File(
      ['floor-plan'],
      'large-plan.png',
      { type: 'image/png' },
    );

    Object.defineProperty(file, 'size', {
      value: MAX_FLOOR_PLAN_SIZE + 1,
    });

    const result = validateFloorPlanFile(file);

    expect(result.valid).toBe(false);
    expect(result.error).toBe(
      'Floor plan must not exceed 50 MB.',
    );
  });
});