import { describe, it, expect } from 'vitest';
import { validateReport } from './validators';

describe('validateReport', () => {
  it('should return no errors for valid data', () => {
    const data = {
      waste_type: 'Plastic',
      estimated_weight: 10,
      location_lat: 45.0,
      location_lng: -90.0,
      address: '123 Main St'
    };
    const errors = validateReport(data);
    expect(errors).toHaveLength(0);
  });

  it('should return error if waste_type is missing', () => {
    const data = {
      estimated_weight: 10,
      location_lat: 45.0,
      location_lng: -90.0
    };
    const errors = validateReport(data);
    expect(errors).toContainEqual({ field: 'waste_type', message: 'Waste type is required' });
  });

  it('should return error if waste_type is empty string', () => {
    const data = {
      waste_type: '   ',
      estimated_weight: 10,
    };
    const errors = validateReport(data);
    expect(errors).toContainEqual({ field: 'waste_type', message: 'Waste type is required' });
  });

  it('should return error if estimated_weight is missing', () => {
    const data = {
      waste_type: 'Plastic',
    };
    const errors = validateReport(data);
    expect(errors).toContainEqual({ field: 'estimated_weight', message: 'Estimated weight is required' });
  });

  it('should return error if estimated_weight is zero or negative', () => {
    const data1 = { waste_type: 'Plastic', estimated_weight: 0 };
    const data2 = { waste_type: 'Plastic', estimated_weight: -5 };

    expect(validateReport(data1)).toContainEqual({ field: 'estimated_weight', message: 'Weight must be greater than 0' });
    expect(validateReport(data2)).toContainEqual({ field: 'estimated_weight', message: 'Weight must be greater than 0' });
  });

  it('should return error if location_lat is out of bounds', () => {
    const data1 = { waste_type: 'Plastic', estimated_weight: 10, location_lat: -91 };
    const data2 = { waste_type: 'Plastic', estimated_weight: 10, location_lat: 91 };

    expect(validateReport(data1)).toContainEqual({ field: 'location_lat', message: 'Latitude must be between -90 and 90' });
    expect(validateReport(data2)).toContainEqual({ field: 'location_lat', message: 'Latitude must be between -90 and 90' });
  });

  it('should return error if location_lng is out of bounds', () => {
    const data1 = { waste_type: 'Plastic', estimated_weight: 10, location_lng: -181 };
    const data2 = { waste_type: 'Plastic', estimated_weight: 10, location_lng: 181 };

    expect(validateReport(data1)).toContainEqual({ field: 'location_lng', message: 'Longitude must be between -180 and 180' });
    expect(validateReport(data2)).toContainEqual({ field: 'location_lng', message: 'Longitude must be between -180 and 180' });
  });

  it('should handle null values correctly', () => {
    const data = {
      waste_type: 'Plastic',
      estimated_weight: 10,
      location_lat: null,
      location_lng: null,
      address: null
    };
    const errors = validateReport(data);
    expect(errors).toHaveLength(0);
  });
});
