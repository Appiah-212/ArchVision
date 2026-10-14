export const MAX_FLOOR_PLAN_SIZE = 50 * 1024 * 1024;

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

const ALLOWED_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

export type FileValidationResult =
  | { valid: true; error: null }
  | { valid: false; error: string };

export const validateFloorPlanFile = (
  file: File | null | undefined,
): FileValidationResult => {
  if (!file) {
    return {
      valid: false,
      error: 'Please select a floor plan.',
    };
  }

  if (
    !ALLOWED_TYPES.includes(file.type) ||
    !ALLOWED_EXTENSIONS.test(file.name)
  ) {
    return {
      valid: false,
      error: 'Only JPG, PNG, and WebP floor plans are supported.',
    };
  }

  if (file.size > MAX_FLOOR_PLAN_SIZE) {
    return {
      valid: false,
      error: 'Floor plan must not exceed 50 MB.',
    };
  }

  return {
    valid: true,
    error: null,
  };
};