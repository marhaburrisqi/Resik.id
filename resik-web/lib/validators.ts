export interface ValidationError {
  field: string;
  message: string;
}

export function validateReport(data: {
  waste_type?: string;
  estimated_weight?: number;
  location_lat?: number | null;
  location_lng?: number | null;
  address?: string | null;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.waste_type || data.waste_type.trim() === '') {
    errors.push({ field: 'waste_type', message: 'Waste type is required' });
  }

  if (data.estimated_weight === undefined || data.estimated_weight === null) {
    errors.push({ field: 'estimated_weight', message: 'Estimated weight is required' });
  } else if (data.estimated_weight <= 0) {
    errors.push({ field: 'estimated_weight', message: 'Weight must be greater than 0' });
  }

  if (data.location_lat !== null && data.location_lat !== undefined) {
    if (data.location_lat < -90 || data.location_lat > 90) {
      errors.push({ field: 'location_lat', message: 'Latitude must be between -90 and 90' });
    }
  }

  if (data.location_lng !== null && data.location_lng !== undefined) {
    if (data.location_lng < -180 || data.location_lng > 180) {
      errors.push({ field: 'location_lng', message: 'Longitude must be between -180 and 180' });
    }
  }

  return errors;
}

export function validatePickup(data: {
  actual_weight?: number | null;
  status?: string;
}): ValidationError[] {
  const errors: ValidationError[] = [];

  if (data.actual_weight !== null && data.actual_weight !== undefined && data.actual_weight <= 0) {
    errors.push({ field: 'actual_weight', message: 'Weight must be greater than 0' });
  }

  return errors;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing'],
  processing: ['completed'],
  completed: [],
};

export function validateStatusTransition(current: string, next: string): ValidationError[] {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed) return [{ field: 'status', message: `Invalid current status: ${current}` }];
  if (!allowed.includes(next)) {
    return [{ field: 'status', message: `Invalid transition: ${current} → ${next}` }];
  }
  return [];
}
