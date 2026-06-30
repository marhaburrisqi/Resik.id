import { useState, useCallback, useRef, useEffect, MutableRefObject } from 'react';
import * as Location from 'expo-location';
import { Alert, Linking } from 'react-native';
import { logger } from '../utils/logger';

export type AccuracyLevel = 'HIGH' | 'MEDIUM' | 'POOR' | 'NONE';

export interface LocationState {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  source: string;
  isMocked: boolean;
  accuracyLevel: AccuracyLevel;
}

const MAX_AUTO_RETRIES = 1;

function getAccuracyLevel(accuracy: number): AccuracyLevel {
  if (accuracy <= 15) return 'HIGH';
  if (accuracy <= 50) return 'MEDIUM';
  if (accuracy <= 100) return 'POOR';
  return 'NONE';
}

async function tryGetPosition(
  accuracy: Location.LocationAccuracy,
  timeoutMs: number,
  activeTimers: Set<ReturnType<typeof setTimeout>>,
  cancelled: MutableRefObject<boolean>
): Promise<Location.LocationObject | null> {
  if (cancelled.current) return null;

  return new Promise<Location.LocationObject | null>((resolve) => {
    const tid = setTimeout(() => {
      activeTimers.delete(tid);
      resolve(null);
    }, timeoutMs);
    activeTimers.add(tid);

    Location.getCurrentPositionAsync({ accuracy })
      .then((pos) => {
        clearTimeout(tid);
        activeTimers.delete(tid);
        resolve(cancelled.current ? null : pos);
      })
      .catch(() => {
        clearTimeout(tid);
        activeTimers.delete(tid);
        resolve(null);
      });
  });
}

export function useGeolocation() {
  const [location, setLocation] = useState<LocationState | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>('Mencari sinyal GPS...');
  const [error, setError] = useState<{ message: string; code: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Refs that must NOT be in dependency arrays — they never change identity.
  const cancelledRef = useRef(false);
  const retryCountRef = useRef(0);
  const activeTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const isRunning = useRef(false);

  // Clear all timers and mark as cancelled on unmount.
  useEffect(() => {
    cancelledRef.current = false;
    return () => {
      cancelledRef.current = true;
      activeTimers.current.forEach(clearTimeout);
      activeTimers.current.clear();
    };
  }, []);

  const showPermissionDeniedAlert = useCallback(() => {
    Alert.alert(
      'Izin Lokasi Diperlukan',
      'RESIK memerlukan akses lokasi untuk menandai titik pengambilan sampah. Silakan aktifkan di Pengaturan.',
      [
        { text: 'Batal', style: 'cancel' },
        { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() },
      ]
    );
  }, []);

  const acquire = useCallback(async () => {
    // Guard: do not start a second acquisition while one is in progress.
    if (isRunning.current) return;

    if (retryCountRef.current > MAX_AUTO_RETRIES) {
      logger.warn('Max auto-retries reached, stopping acquisition');
      return;
    }

    isRunning.current = true;
    if (!cancelledRef.current) {
      setLoading(true);
      setError(null);
    }

    try {
      // --- 1. GPS hardware services check (fast, no network needed) ---
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        if (!cancelledRef.current) {
          setError({
            message: 'GPS HP Anda belum dinyalakan. Aktifkan GPS lalu tekan Coba Lagi.',
            code: 'GPS_DISABLED',
          });
          logger.warn('GPS services are disabled');
        }
        return;
      }

      // --- 2. Permission gate ---
      const { status: currentStatus } = await Location.getForegroundPermissionsAsync();
      if (currentStatus !== 'granted') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          if (!cancelledRef.current) {
            setError({
              message: 'Izin lokasi ditolak. Aktifkan di Pengaturan untuk melanjutkan.',
              code: 'PERMISSION_DENIED',
            });
            showPermissionDeniedAlert();
          }
          return;
        }
      }

      let result: Location.LocationObject | null = null;

      if (!cancelledRef.current) setStatusMessage('Mencari sinyal GPS...');
      logger.info('Acquiring: High accuracy (10s)');
      result = await tryGetPosition(
        Location.Accuracy.High, 10_000, activeTimers.current, cancelledRef
      );

      if (!result && !cancelledRef.current) {
        setStatusMessage('Mencoba sinyal jaringan...');
        logger.warn('High failed → Balanced (15s)');
        result = await tryGetPosition(
          Location.Accuracy.Balanced, 15_000, activeTimers.current, cancelledRef
        );
      }

      if (!result && !cancelledRef.current) {
        setStatusMessage('Menunggu satelit GPS...');
        logger.warn('Balanced failed → Low (20s)');
        result = await tryGetPosition(
          Location.Accuracy.Low, 20_000, activeTimers.current, cancelledRef
        );
      }

      // --- 4. Last-known position fallback ---
      if (!result && !cancelledRef.current) {
        logger.warn('All live attempts failed → getLastKnownPositionAsync');
        result = await Location.getLastKnownPositionAsync({
          maxAge: 5 * 60 * 1000, // accept positions up to 5 min old
          requiredAccuracy: 200,  // accept up to 200 m accuracy
        }).catch(() => null);
      }

      if (cancelledRef.current) return;

      // --- 5. Hard failure ---
      if (!result) {
        const currentRetry = retryCountRef.current + 1;
        retryCountRef.current = currentRetry;
        setRetryCount(currentRetry);
        setError({
          message: 'GPS HP Anda belum dinyalakan. Aktifkan GPS lalu tekan Coba Lagi.',
          code: 'GPS_DISABLED',
        });
        logger.error('Location acquisition failed after full cascade', { retry: currentRetry });
        return;
      }

      // --- 6. Success ---
      const accuracyMeters = result.coords.accuracy ?? 999;
      const locState: LocationState = {
        latitude: result.coords.latitude,
        longitude: result.coords.longitude,
        accuracy: accuracyMeters,
        timestamp: result.timestamp,
        source: 'device',
        isMocked: false,
        accuracyLevel: getAccuracyLevel(accuracyMeters),
      };

      retryCountRef.current = 0;
      setRetryCount(0);
      setLocation(locState);
      logger.info('Location acquired', { accuracy: accuracyMeters, level: locState.accuracyLevel });
    } catch (err: unknown) {
      if (cancelledRef.current) return;
      const currentRetry = retryCountRef.current + 1;
      retryCountRef.current = currentRetry;
      setRetryCount(currentRetry);
      const errorMessage = err instanceof Error ? err.message : 'Gagal mendapatkan lokasi';
      setError({ message: errorMessage, code: 'ACQUISITION_FAILED' });
      logger.error('Location acquisition failed (exception)', { error: errorMessage, retry: currentRetry });
    } finally {
      isRunning.current = false;
      if (!cancelledRef.current) setLoading(false);
    }
    // Stable deps only — showPermissionDeniedAlert is itself stable (no deps).
    // Do NOT add retryCount (state) here — we use retryCountRef instead.
  }, [showPermissionDeniedAlert]);

  const manualRetry = useCallback(() => {
    retryCountRef.current = 0;
    setRetryCount(0);
    acquire();
  }, [acquire]);

  return {
    location,
    loading,
    statusMessage,
    error,
    retryCount,
    refreshLocation: acquire,
    manualRetry,
    clearLocation: () => setLocation(null),
  };
}
