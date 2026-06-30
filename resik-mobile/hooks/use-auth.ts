import { useState, useEffect } from 'react';
import { UserProfile, UserRole } from '../types/auth';
import { supabase } from '../lib/supabase/client';
import { logger } from '../utils/logger';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Helper function to fetch profile information from database
  const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
    try {
      // 1. Fetch user role and points
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('id, email, role, points')
        .eq('id', userId)
        .single();
      
      if (userError || !userData) {
        logger.error('Failed to fetch user credential row', userError);
        return null;
      }

      // 2. Fetch profile details
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, phone_number, address, rt_rw, village_id')
        .eq('id', userId)
        .single();

      if (profileError || !profileData) {
        logger.warn('Failed to fetch user profile row, returning credential projection', profileError);
        return {
          id: userData.id,
          email: userData.email,
          role: userData.role as UserRole,
          full_name: '',
          points: userData.points,
        };
      }

      return {
        id: userData.id,
        email: userData.email,
        role: userData.role as UserRole,
        full_name: profileData.full_name,
        phone_number: profileData.phone_number || undefined,
        points: userData.points,
        address: profileData.address,
        rt_rw: profileData.rt_rw,
        village_id: profileData.village_id,
      };
    } catch (err) {
      logger.error('Error in fetchProfile procedure', err);
      return null;
    }
  };

  useEffect(() => {
    let authSubscription: any = null;

    const initSession = async () => {
      setLoading(true);
      try {
        // Fetch current active session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setUser(profile);
        } else {
          setUser(null);
        }
      } catch (err) {
        logger.error('Error fetching initial session credentials', err);
      } finally {
        setLoading(false);
      }

      // Listen to auth state transitions
      const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        logger.info(`Auth state transition event triggered: ${event}`);
        
        if (session?.user) {
          const profile = await fetchProfile(session.user.id);
          setUser(profile);
        } else {
          setUser(null);
        }
        setLoading(false);
      });
      
      authSubscription = subscription;
    };

    initSession();

    return () => {
      if (authSubscription) {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  async function signIn(email: string, password: string) {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        setLoading(false);
        throw err;
      }
      logger.info('User authenticated successfully');
    } catch (err: any) {
      setError(err?.message || 'Login gagal');
      setLoading(false);
      throw err;
    }
  }

  async function signUp(email: string, password: string, fullName: string, role: 'warga' | 'bank_sampah' | 'umkm') {
    setLoading(true);
    setError(null);
    try {
      // 1. Sign up inside GoTrue
      const { data, error: err } = await supabase.auth.signUp({ email, password });
      if (err || !data.user) {
        setError(err?.message || 'Registrasi gagal');
        setLoading(false);
        throw err || new Error('Registrasi gagal');
      }

      const authUser = data.user;
      logger.info('User created in GoTrue authentication registry', { userId: authUser.id });

      // 2. Insert into users public ledger table
      const { error: userError } = await supabase
        .from('users')
        .insert([{ id: authUser.id, email, role }]);
      
      if (userError) {
        logger.error('Failed to create users row in public table', userError);
        throw userError;
      }

      // 3. Resolve first village reference to satisfy profiles constraints
      let villageId;
      const { data: villageData } = await supabase
        .from('villages')
        .select('id')
        .limit(1);

      if (villageData && villageData.length > 0) {
        villageId = villageData[0].id;
      } else {
        // Fallback: Bootstrap a default village
        const { data: newVillage, error: newVillageError } = await supabase
          .from('villages')
          .insert([{ name: 'Desa Karangduren', subdistrict: 'Pakisaji', regency: 'Malang' }])
          .select('id')
          .single();
        
        if (newVillageError) {
          logger.error('Failed to seed fallback village', newVillageError);
          throw newVillageError;
        }
        villageId = newVillage?.id;
      }

      if (!villageId) throw new Error('Database villages master table contains no records and fallback seed failed.');

      // 4. Create profiles metadata row (PII tables)
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: authUser.id,
          full_name: fullName,
          phone_number: '',
          address: 'Dusun Karangduren, Desa Karangduren',
          rt_rw: '00/00',
          village_id: villageId
        }]);

      if (profileError) {
        logger.error('Failed to insert profiles row in public table', profileError);
        throw profileError;
      }

      logger.info('Public profile rows created successfully');
    } catch (err: any) {
      setError(err?.message || 'Registrasi gagal');
      setLoading(false);
      throw err;
    }
  }

  async function signOut() {
    setLoading(true);
    setError(null);
    try {
      const { error: err } = await supabase.auth.signOut();
      if (err) {
        setError(err.message);
        setLoading(false);
        throw err;
      }
      setUser(null);
      logger.info('User signed out and session cleared');
    } catch (err: any) {
      setError(err?.message || 'Gagal logout');
      setLoading(false);
      throw err;
    } finally {
      setLoading(false);
    }
  }

  return {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    clearError: () => setError(null),
  };
}
