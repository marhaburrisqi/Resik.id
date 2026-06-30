import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';
import { UserProfile } from '../types/auth';
import { normalizeError, AppError } from '../lib/errors';
import { logError } from '../lib/logger';

const PROFILE_CACHE_KEY = 'resik_cached_profile';

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<AppError | null>(null);

  useEffect(() => {
    loadCachedProfile();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      const normalized = normalizeError(err);
      setError(normalized);
      logError('auth_session_fetch', err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        fetchProfile(session.user.id);
      } else {
        clearCache();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  function loadCachedProfile() {
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(PROFILE_CACHE_KEY);
        if (cached) {
          setUser(JSON.parse(cached));
        }
      }
    } catch (err) {
      logError('auth_cache_load', err);
    }
  }

  function cacheProfile(profile: UserProfile) {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
      }
    } catch (err) {
      logError('auth_cache_save', err);
    }
  }

  function clearCache() {
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(PROFILE_CACHE_KEY);
      }
    } catch (err) {
      logError('auth_cache_clear', err);
    }
  }

  async function fetchProfile(userId: string) {
    try {
      setLoading(true);
      setError(null);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;

      const profile = data as UserProfile;
      setUser(profile);
      cacheProfile(profile);
    } catch (err: any) {
      const normalized = normalizeError(err);
      setError(normalized);
      logError('auth_profile_fetch', err);
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    try {
      setLoading(true);
      clearCache();
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err: any) {
      const normalized = normalizeError(err);
      setError(normalized);
      logError('auth_signout', err);
    } finally {
      setLoading(false);
    }
  }

  return {
    user,
    loading,
    error,
    signOut,
  };
}
