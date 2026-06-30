import { z } from 'zod';

export const WasteCategorySchema = z.enum(['PLASTIC', 'PAPER', 'METAL', 'ORGANIC']);
export type WasteCategory = z.infer<typeof WasteCategorySchema>;

export const WasteStatusSchema = z.enum(['PENDING', 'CONFIRMED', 'FAILED']);
export type WasteStatus = z.infer<typeof WasteStatusSchema>;

export type WeightKg = number & { readonly __brand: unique symbol };
export type TokenAmount = number & { readonly __brand: unique symbol };

export interface WasteDeposit {
  readonly id: string;
  readonly villageId: string;
  readonly category: WasteCategory;
  readonly weightKg: WeightKg;
  readonly tokenReward: TokenAmount;
  readonly timestamp: number;
}

export const WasteDepositTransactionSchema = z.object({
  id: z.string(),
  villageId: z.string(),
  contributorId: z.string(),
  category: WasteCategorySchema,
  weightKg: z.number().positive() as unknown as z.ZodType<WeightKg>,
  tokenReward: z.number().int().nonnegative() as unknown as z.ZodType<TokenAmount>,
  timestamp: z.date(),
  status: WasteStatusSchema,
});

export type WasteDepositTransaction = z.infer<typeof WasteDepositTransactionSchema>;

const TOKEN_RATES: Record<WasteCategory, number> = {
  PLASTIC: 500,
  PAPER: 300,
  METAL: 800,
  ORGANIC: 100,
};

export function calculateTokenReward(category: WasteCategory, weightKg: number): TokenAmount {
  if (weightKg <= 0) return 0 as TokenAmount;
  const rate = TOKEN_RATES[category];
  return Math.floor(weightKg * rate) as TokenAmount;
}
