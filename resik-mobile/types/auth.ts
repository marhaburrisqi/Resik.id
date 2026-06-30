export type UserRole = 'warga' | 'bank_sampah' | 'umkm' | 'admin_pemda';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone_number?: string;
  points?: number;
  created_at?: string;
  updated_at?: string;
  address?: string;
  rt_rw?: string;
  village_id?: string;
}

export interface AuthState {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  error: string | null;
}
