import { TrashReport } from './citizen';

export interface WasteBankPickup extends TrashReport {
  collector_id?: string;
  actual_weight?: number;
  final_points?: number;
  processed_at?: string;
}
