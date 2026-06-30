export type ErrorType = 'network' | 'validation' | 'auth' | 'not_found' | 'conflict' | 'server';

export interface AppError {
  type: ErrorType;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export function normalizeError(err: unknown): AppError {
  if (err && typeof err === 'object' && 'type' in err && 'message' in err) {
    return err as AppError;
  }

  if (err && typeof err === 'object' && 'code' in err) {
    const e = err as any;
    if (e.code === 'PGRST116' || e.code === 'PGRST204') return { type: 'not_found', message: 'Resource not found' };
    if (e.code === '23505') return { type: 'conflict', message: 'Duplicate entry', details: { original: e.message } };
    if (e.code === '23502') return { type: 'validation', message: 'Missing required field', details: { original: e.message } };
    if (e.code === '42501') return { type: 'auth', message: 'Permission denied' };
  }

  if (err && typeof err === 'object' && 'message' in err) {
    const e = err as any;
    if (e.message?.includes('Failed to fetch') || e.message?.includes('network')) {
      return { type: 'network', message: 'Network error — please check your connection' };
    }
    if (e.message?.includes('JWT') || e.message?.includes('token')) {
      return { type: 'auth', message: 'Authentication error — please sign in again' };
    }
    return { type: 'server', message: e.message || 'An unexpected error occurred' };
  }

  return { type: 'server', message: 'An unexpected error occurred' };
}

export function isValidationError(err: AppError): boolean {
  return err.type === 'validation';
}

export function isAuthError(err: AppError): boolean {
  return err.type === 'auth';
}

export function isNetworkError(err: AppError): boolean {
  return err.type === 'network';
}
