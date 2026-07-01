import { describe, it, expect } from 'vitest';
import { normalizeError, isValidationError, isAuthError, isNetworkError, AppError } from './errors';

describe('normalizeError', () => {
  it('should return the error if it is already an AppError', () => {
    const error: AppError = { type: 'network', message: 'test' };
    expect(normalizeError(error)).toEqual(error);
  });

  describe('PostgreSQL error codes', () => {
    it('should handle PGRST116 as not_found', () => {
      expect(normalizeError({ code: 'PGRST116' })).toEqual({
        type: 'not_found',
        message: 'Resource not found',
      });
    });

    it('should handle PGRST204 as not_found', () => {
      expect(normalizeError({ code: 'PGRST204' })).toEqual({
        type: 'not_found',
        message: 'Resource not found',
      });
    });

    it('should handle 23505 as conflict', () => {
      const e = { code: '23505', message: 'original error' };
      expect(normalizeError(e)).toEqual({
        type: 'conflict',
        message: 'Duplicate entry',
        details: { original: 'original error' },
      });
    });

    it('should handle 23502 as validation', () => {
      const e = { code: '23502', message: 'original error' };
      expect(normalizeError(e)).toEqual({
        type: 'validation',
        message: 'Missing required field',
        details: { original: 'original error' },
      });
    });

    it('should handle 42501 as auth', () => {
      expect(normalizeError({ code: '42501' })).toEqual({
        type: 'auth',
        message: 'Permission denied',
      });
    });

    it('should fallback if unknown code is provided', () => {
      expect(normalizeError({ code: '99999' })).toEqual({
        type: 'server',
        message: 'An unexpected error occurred',
      });
    });
  });

  describe('String matching errors', () => {
    it('should handle network errors', () => {
      expect(normalizeError({ message: 'Failed to fetch data' })).toEqual({
        type: 'network',
        message: 'Network error — please check your connection',
      });
      expect(normalizeError({ message: 'network timeout' })).toEqual({
        type: 'network',
        message: 'Network error — please check your connection',
      });
    });

    it('should handle auth errors', () => {
      expect(normalizeError({ message: 'invalid JWT' })).toEqual({
        type: 'auth',
        message: 'Authentication error — please sign in again',
      });
      expect(normalizeError({ message: 'missing token' })).toEqual({
        type: 'auth',
        message: 'Authentication error — please sign in again',
      });
    });

    it('should return server error with original message if no match is found', () => {
      expect(normalizeError({ message: 'Random error' })).toEqual({
        type: 'server',
        message: 'Random error',
      });
    });
  });

  describe('Fallback scenarios', () => {
    it('should handle null', () => {
      expect(normalizeError(null)).toEqual({
        type: 'server',
        message: 'An unexpected error occurred',
      });
    });

    it('should handle undefined', () => {
      expect(normalizeError(undefined)).toEqual({
        type: 'server',
        message: 'An unexpected error occurred',
      });
    });

    it('should handle strings', () => {
      expect(normalizeError('just a string')).toEqual({
        type: 'server',
        message: 'An unexpected error occurred',
      });
    });

    it('should handle numbers', () => {
      expect(normalizeError(123)).toEqual({
        type: 'server',
        message: 'An unexpected error occurred',
      });
    });

    it('should handle generic error objects without type/code/message', () => {
      // new Error() without message will have message '' but since 'message' is present on the Error object
      // wait, `message in new Error()` is true because it's on prototype, but normally `message` is empty string
      // Let's check what normalizeError returns for new Error().
      // It returns { type: 'server', message: 'An unexpected error occurred' }
      // wait, new Error().message is '', which is falsey, so `e.message || 'An unexpected error occurred'` evaluates to the default
      expect(normalizeError(new Error())).toEqual({
        type: 'server',
        message: 'An unexpected error occurred',
      });
    });

    it('should handle empty objects', () => {
        expect(normalizeError({})).toEqual({
          type: 'server',
          message: 'An unexpected error occurred',
        });
    });
  });
});

describe('Helper functions', () => {
  it('isValidationError', () => {
    expect(isValidationError({ type: 'validation', message: '' })).toBe(true);
    expect(isValidationError({ type: 'network', message: '' })).toBe(false);
  });

  it('isAuthError', () => {
    expect(isAuthError({ type: 'auth', message: '' })).toBe(true);
    expect(isAuthError({ type: 'network', message: '' })).toBe(false);
  });

  it('isNetworkError', () => {
    expect(isNetworkError({ type: 'network', message: '' })).toBe(true);
    expect(isNetworkError({ type: 'auth', message: '' })).toBe(false);
  });
});
