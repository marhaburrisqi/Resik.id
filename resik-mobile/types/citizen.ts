export type ReportStatus = 'pending' | 'verified' | 'scheduled' | 'picked_up' | 'completed' | 'cancelled' | 'rejected';
export type ReportType = 'trash' | 'illegal';

export interface TrashReport {
  id: string;
  tracking_id?: string;
  idempotency_key: string;
  citizen_id: string;
  trash_type: string;
  estimated_weight: number;
  location_lat: number;
  location_lng: number;
  accuracy: number;
  loc_timestamp: number;
  source?: string;
  address: string;
  photo_url?: string;
  /** Supabase Storage object path: report-photos/{userId}/{reportId}/photo.jpg */
  storage_path?: string;
  status: ReportStatus;
  points_earned?: number;
  created_at: string;
  updated_at: string;
  report_type?: ReportType;
  description?: string;
  pendingSync?: boolean;
}

export interface CreateReportDTO {
  trash_type: string;
  tracking_id?: string;
  estimated_weight: number;
  location_lat: number;
  location_lng: number;
  accuracy: number;
  loc_timestamp: number;
  source?: string;
  address?: string | null;
  photo_url?: string;
  /** Supabase Storage object path persisted alongside the public URL */
  storage_path?: string;
  idempotency_key?: string;
  report_type?: ReportType;
  description?: string;
  pendingSync?: boolean;
}
