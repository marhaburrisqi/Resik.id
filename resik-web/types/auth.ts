export type UserRole = 'warga' | 'bank_sampah' | 'umkm' | 'admin_pemda';

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthState {
  user: UserProfile | null;
  session: any | null;
  loading: boolean;
  error: string | null;
}
