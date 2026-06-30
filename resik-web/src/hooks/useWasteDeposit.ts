import { useState, useCallback } from 'react';
import {
  WasteDepositTransactionSchema,
  WasteDepositTransaction,
  calculateTokenReward
} from '../domain/waste';
import { z } from 'zod';

export type DepositState = 'IDLE' | 'VALIDATING' | 'SUBMITTING' | 'SUCCESS' | 'FAILURE';

export interface UseWasteDepositResult {
  state: DepositState;
  submitDeposit: (payload: Omit<WasteDepositTransaction, 'tokenReward' | 'status'>) => Promise<void>;
  error: string | null;
  transaction: WasteDepositTransaction | null;
}

export function useWasteDeposit(): UseWasteDepositResult {
  const [state, setState] = useState<DepositState>('IDLE');
  const [error, setError] = useState<string | null>(null);
  const [transaction, setTransaction] = useState<WasteDepositTransaction | null>(null);

  const submitDeposit = useCallback(async (payload: Omit<WasteDepositTransaction, 'tokenReward' | 'status'>) => {
    setState('VALIDATING');
    setError(null);
    setTransaction(null);

    try {
      const tokenReward = calculateTokenReward(payload.category, payload.weightKg);

      const fullPayload = {
        ...payload,
        tokenReward,
        status: 'PENDING' as const,
      };

      // Validate payload
      const validatedData = WasteDepositTransactionSchema.parse(fullPayload);

      setState('SUBMITTING');

      // Emulate async submission
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          // Simulate 90% success rate
          if (Math.random() > 0.1) {
            resolve(true);
          } else {
            reject(new Error('Network failure'));
          }
        }, 1000);
      });

      const confirmedTransaction: WasteDepositTransaction = {
        ...validatedData,
        status: 'CONFIRMED'
      };

      setTransaction(confirmedTransaction);
      setState('SUCCESS');
    } catch (err) {
      if (err instanceof z.ZodError) {
        setError(`Validation error: ${err.issues.map((e: z.ZodIssue) => e.message).join(', ')}`);
      } else if (err instanceof Error) {
        setError(`Submission error: ${err.message}`);
      } else {
        setError('An unknown error occurred');
      }
      setState('FAILURE');
    }
  }, []);

  return { state, submitDeposit, error, transaction };
}
