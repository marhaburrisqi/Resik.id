export interface Report {
  id: string;
  user_id: string;
  waste_type: string;
  estimated_weight: number;
  location_lat: number | null;
  location_lng: number | null;
  address: string | null;
  status: 'pending' | 'processing' | 'completed';
  created_at: string;
}

export interface Pickup {
  id: string;
  report_id: string;
  collector_id: string;
  actual_weight: number | null;
  status: string;
  created_at: string;
}

export interface Trend {
  value: number;   // percentage change
  label: string;  // e.g. "vs last week"
}

export interface DashboardStats {
  totalReports: number;
  totalWasteKg: number;
  activeUsers: number;
  statusCounts: {
    pending: number;
    processing: number;
    completed: number;
  };
  trends?: {
    totalReports: Trend;
    totalWasteKg: Trend;
    activeUsers: Trend;
  };
}

export type Severity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface Insight {
  severity: Severity;
  message: string;
  action: string;
  count?: number;
}

export interface SystemHealth {
  status: 'Healthy' | 'Warning' | 'Critical';
  reason?: string;
}
