import { describe, it, expect } from 'vitest';
import { validateStatusTransition } from './validators';

describe('validateStatusTransition', () => {
  it('should allow valid transition from pending to processing', () => {
    const errors = validateStatusTransition('pending', 'processing');
    expect(errors).toHaveLength(0);
  });

  it('should allow valid transition from processing to completed', () => {
    const errors = validateStatusTransition('processing', 'completed');
    expect(errors).toHaveLength(0);
  });

  it('should return error for invalid current status', () => {
    const errors = validateStatusTransition('unknown_status', 'processing');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      field: 'status',
      message: 'Invalid current status: unknown_status'
    });
  });

  it('should return error for invalid transition', () => {
    const errors = validateStatusTransition('pending', 'completed');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      field: 'status',
      message: 'Invalid transition: pending → completed'
    });
  });

  it('should return error for invalid transition from completed', () => {
    const errors = validateStatusTransition('completed', 'processing');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      field: 'status',
      message: 'Invalid transition: completed → processing'
    });
  });

  it('should return error for transition to same status if not allowed', () => {
    const errors = validateStatusTransition('pending', 'pending');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      field: 'status',
      message: 'Invalid transition: pending → pending'
    });
  });

  it('should handle empty string as current status', () => {
    const errors = validateStatusTransition('', 'processing');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      field: 'status',
      message: 'Invalid current status: '
    });
  });

  it('should handle empty string as next status', () => {
    const errors = validateStatusTransition('pending', '');
    expect(errors).toHaveLength(1);
    expect(errors[0]).toEqual({
      field: 'status',
      message: 'Invalid transition: pending → '
    });
  });
});
