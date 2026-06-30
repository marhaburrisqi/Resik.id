import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  ScrollView, 
  Image, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Linking
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { useResikTheme } from '../../hooks/use-theme-color';
import { useGeolocation } from '../../hooks/use-geolocation';
import { useRealtimeReports } from '../../hooks/use-realtime-reports';
import { ResikButton } from '../../components/ui/ResikButton';
import { ResikCard } from '../../components/ui/ResikCard';
import { ResikBadge } from '../../components/ui/ResikBadge';
import { Ionicons } from '@expo/vector-icons';
import { logger } from '../../utils/logger';
import { offlineQueue } from '../../utils/offline-queue';
import { uploadReportPhoto } from '../../lib/supabase/storage';
import { CreateReportPayload } from '../../types/offline';
import { supabase } from '../../lib/supabase/client';

type ReportType = 'trash' | 'illegal';

interface WizardState {
  step: number;
  type: ReportType | null;
  photoUri: string | null;
  location: {
    lat: number;
    lng: number;
    accuracy: number;
    address?: string | null;
  } | null;
  category: string;
  weightLabel: string; // 'Kantong Kresek', 'Karung Sedang', 'Tong / Gerobak'
  description: string;
}

const INITIAL_STATE: WizardState = {
  step: 1,
  type: null,
  photoUri: null,
  location: null,
  category: 'Organik',
  weightLabel: 'Karung Sedang',
  description: '',
};

const WIZARD_DRAFT_KEY = 'resik_report_wizard_draft';

const WASTE_CATEGORIES = ['Organik', 'Anorganik', 'B3', 'Elektronik'];
const WEIGHT_OPTIONS = [
  { label: 'Kantong Kresek', value: 2, icon: 'basket-outline' },
  { label: 'Karung Sedang', value: 8, icon: 'cube-outline' },
  { label: 'Tong / Gerobak', value: 20, icon: 'bus-outline' },
];

export default function ReportWizardScreen() {
  const { colors, typography, radius } = useResikTheme();
  const { location: geoLoc, loading: locLoading, statusMessage: locStatusMessage, refreshLocation, manualRetry: manualRetryLocation, error: geoError } = useGeolocation();
  const { submitReport } = useRealtimeReports();
  const params = useLocalSearchParams<{ type?: 'trash' | 'illegal' }>();
  
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [successMode, setSuccessMode] = useState<'none' | 'online' | 'offline'>('none');
  const [trackingId, setTrackingId] = useState('');
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(netState => {
      setIsOffline(!netState.isConnected);
    });
    return () => unsubscribe();
  }, []);

  // P0: Clear draft helper
  const clearDraft = async () => {
    try {
      await AsyncStorage.removeItem(WIZARD_DRAFT_KEY);
    } catch (err) {
      logger.error('Failed to clear wizard draft', err);
    }
  };

  // P0: Restore wizard draft on mount if app died
  useEffect(() => {
    const restoreDraft = async () => {
      // Skip restore if deep-linked via quick action params
      if (params.type) return;
      
      try {
        const saved = await AsyncStorage.getItem(WIZARD_DRAFT_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as WizardState;
          if (parsed && parsed.step > 1) {
            Alert.alert(
              'Lanjutkan Laporan? 📝',
              'Laporan Anda yang sebelumnya terputus masih tersimpan di HP. Mau dilanjutkan?',
              [
                { text: 'Ulangi Baru', style: 'cancel', onPress: () => { clearDraft(); setState(INITIAL_STATE); } },
                { text: 'Lanjutkan', onPress: () => { setState(parsed); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); } }
              ]
            );
          }
        }
      } catch (err) {
        logger.error('Failed to restore draft', err);
      }
    };
    restoreDraft();
  }, [params.type]);

  // P0: Auto save draft on step transitions
  useEffect(() => {
    if (successMode === 'none' && !isSubmitting && state.step > 1) {
      AsyncStorage.setItem(WIZARD_DRAFT_KEY, JSON.stringify(state)).catch(err => 
        logger.error('Failed to save draft', err)
      );
    }
  }, [state, successMode, isSubmitting]);

  // Handle route query params to jump directly into the wizard step 2
  useEffect(() => {
    if (params.type === 'trash' || params.type === 'illegal') {
      setState(prev => ({
        ...prev,
        type: params.type as ReportType,
        step: 2,
      }));
    }
  }, [params.type]);

  // Stable ref to refreshLocation so we can call it from an effect without
  // adding it to the dependency array (it IS stable, but this makes the
  // linter-safe intent explicit).
  const refreshLocationRef = useRef(refreshLocation);
  useEffect(() => {
    refreshLocationRef.current = refreshLocation;
  });

  // Fire acquisition exactly once when the wizard enters step 3.
  // We track the last step that triggered an attempt so that navigating
  // away and back (step 3 → 2 → 3) correctly re-triggers exactly once.
  const lastAcquireStepRef = useRef<number>(-1);
  useEffect(() => {
    if (state.step === 3 && lastAcquireStepRef.current !== 3) {
      lastAcquireStepRef.current = 3;
      // Only trigger if we don't already have a location.
      if (!geoLoc) {
        refreshLocationRef.current();
      }
    }
    if (state.step !== 3) {
      // Reset so re-entering step 3 triggers again.
      lastAcquireStepRef.current = -1;
    }
  // Only react to step changes — geoLoc/locLoading are NOT deps here.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.step]);

  const updateState = (updates: Partial<WizardState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    updateState({ step: state.step + 1 });
  };
  
  const prevStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    updateState({ step: Math.max(1, state.step - 1) });
  };



  const handleWhatsAppHelp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const message = 'Halo BUMDes, saya lansia butuh bantuan untuk melaporkan/menyetor sampah lewat RESIK.';
    const url = `https://wa.me/6285194605979?text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp Tidak Ditemukan', 'Harap hubungi petugas secara manual di nomor 0851-9460-5979.');
      }
    }).catch(() => {
      Alert.alert('Gagal Membuka WhatsApp', 'Harap hubungi petugas secara manual di nomor 0851-9460-5979.');
    });
  };

  const handleRepeatReport = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setState(INITIAL_STATE);
    setSuccessMode('none');
    clearDraft();
  };

  const handleGoHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setState(INITIAL_STATE);
    setSuccessMode('none');
    setTrackingId('');
    clearDraft();
    router.replace('/(tabs)');
  };

  const handleTertiaryHelp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const message = 'Halo Petugas Desa, saya membutuhkan bantuan terkait laporan sampah di aplikasi RESIK.';
    const url = `https://wa.me/6285194605979?text=${encodeURIComponent(message)}`;
    Linking.canOpenURL(url).then(supported => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Alert.alert('WhatsApp Tidak Ditemukan', 'Harap hubungi petugas secara manual di nomor 0851-9460-5979.');
      }
    }).catch(() => {
      Alert.alert('Gagal Membuka WhatsApp', 'Harap hubungi petugas secara manual di nomor 0851-9460-5979.');
    });
  };

  // --- STEP 1: TYPE SELECTION ---
  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={[typography.title, { color: colors.textPrimary, marginBottom: 24 }]}>
        Pilih Laporan Anda:
      </Text>
      <TouchableOpacity 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          updateState({ type: 'trash', step: 2 });
        }}
        activeOpacity={0.9}
        style={{ marginBottom: 16 }}
      >
        <ResikCard variant="elevated" style={styles.typeCard}>
          <Ionicons name="home-outline" size={36} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Sampah Rumah Sendiri</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Panggil petugas untuk ambil sampah di rumah</Text>
          </View>
        </ResikCard>
      </TouchableOpacity>

      <TouchableOpacity 
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          updateState({ type: 'illegal', step: 2 });
        }}
        activeOpacity={0.9}
      >
        <ResikCard variant="elevated" style={styles.typeCard}>
          <Ionicons name="warning-outline" size={36} color={colors.warning} />
          <View style={{ flex: 1 }}>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Sampah Liar di Jalan</Text>
            <Text style={[typography.caption, { color: colors.textSecondary }]}>Laporkan tumpukan sampah liar di jalan atau selokan</Text>
          </View>
        </ResikCard>
      </TouchableOpacity>
    </View>
  );

  // --- STEP 2: EVIDENCE WITH AUTO COMPRESSION & P1 ERROR HANDLER ---
  const takePhoto = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      
      const { status } = await ImagePicker.getCameraPermissionsAsync();
      let cameraStatus = status;
      if (cameraStatus !== 'granted') {
        const requestResult = await ImagePicker.requestCameraPermissionsAsync();
        cameraStatus = requestResult.status;
      }

      if (cameraStatus !== 'granted') {
        Alert.alert(
          'Izin Kamera Belum Aktif 📷',
          'Aplikasi RESIK perlu menggunakan kamera untuk memfoto sampah yang mau disetor.\n\nTolong izinkan kamera di Pengaturan HP Anda agar bisa mengambil foto.',
          [
            { text: 'Batal', style: 'cancel' },
            { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      // P0: Auto compress image to 0.4 quality and disable editing to prevent low-end memory crashes
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.4,
      });

      if (!result.canceled) {
        updateState({ photoUri: result.assets[0].uri });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err) {
      // P1: Humanized Camera error message
      Alert.alert(
        'Kamera HP Bermasalah atau Memori Penuh 📷',
        'HP Anda tidak bisa membuka kamera. Coba tutup aplikasi lain yang sedang berjalan atau hapus beberapa file agar memori lega, lalu coba lagi.',
        [{ text: 'Mengerti' }]
      );
      logger.error('Camera open failed', err);
    }
  };

  const pickPhoto = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      let libraryStatus = status;
      if (libraryStatus !== 'granted') {
        const requestResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
        libraryStatus = requestResult.status;
      }

      if (libraryStatus !== 'granted') {
        Alert.alert(
          'Izin Galeri Belum Aktif 🖼️',
          'RESIK perlu akses ke Galeri untuk memilih foto sampah.\n\nTolong izinkan akses galeri di Pengaturan HP Anda.',
          [
            { text: 'Batal', style: 'cancel' },
            { text: 'Buka Pengaturan', onPress: () => Linking.openSettings() }
          ]
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: false,
        quality: 0.4,
      });

      if (!result.canceled) {
        updateState({ photoUri: result.assets[0].uri });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    } catch (err) {
      Alert.alert(
        'Gagal Membuka Galeri 🖼️',
        'HP Anda tidak bisa membuka galeri foto. Harap bersihkan memori HP yang penuh atau restart HP Anda.',
        [{ text: 'Mengerti' }]
      );
      logger.error('Gallery picker failed', err);
    }
  };

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={[typography.title, { color: colors.textPrimary, marginBottom: 24 }]}>
        Foto Sampah Anda
      </Text>
      {state.photoUri ? (
        <View>
          <Image source={{ uri: state.photoUri }} style={styles.previewImage} />
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <ResikButton 
              title="Foto Ulang" 
              variant="outline" 
              onPress={takePhoto} 
              style={{ flex: 1 }} 
            />
            <ResikButton 
              title="Ganti dari Galeri" 
              variant="outline" 
              onPress={pickPhoto} 
              style={{ flex: 1 }} 
            />
          </View>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <TouchableOpacity style={styles.cameraPlaceholder} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={54} color={colors.textSecondary} style={{ marginBottom: 12 }} />
            <Text style={[typography.body, { color: colors.textSecondary, fontWeight: '700' }]}>Buka Kamera HP</Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>Ketuk di sini untuk memfoto sampah</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.galleryButton, { borderColor: colors.border, borderRadius: radius.lg }]} 
            onPress={pickPhoto}
          >
            <Ionicons name="images-outline" size={24} color={colors.primary} />
            <Text style={[typography.body, { color: colors.primary, fontWeight: '700' }]}>Pilih Foto dari Galeri HP</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Elderly Support Box */}
      <View style={[styles.helpBox, { backgroundColor: colors.secondary + '40', borderRadius: radius.md, marginTop: 24 }]}>
        <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
        <Text style={[typography.caption, { color: colors.textSecondary, flex: 1, marginLeft: 8 }]}>
          Punya kendala dengan Kamera HP? Hubungi pengurus desa lewat WhatsApp, kami siap membantu.
        </Text>
        <TouchableOpacity onPress={handleWhatsAppHelp}>
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '800' }]}>Tanya Petugas</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomActions}>
        <ResikButton title="Lanjut" disabled={!state.photoUri} onPress={nextStep} style={{ flex: 1 }} />
      </View>
    </View>
  );

  // --- STEP 3: LOCATION ---
  const renderStep3 = () => (
    <View style={styles.stepContainer}>
      <Text style={[typography.title, { color: colors.textPrimary, marginBottom: 8 }]}>
        Cek Posisi GPS
      </Text>
      <Text style={[typography.body, { color: colors.textSecondary, marginBottom: 24 }]}>
        Pastikan HP Anda berada dekat dengan tempat sampah yang mau diambil.
      </Text>

      <ResikCard variant="outlined" style={styles.locationCard}>
        {locLoading ? (
          <View style={{ alignItems: 'center' }}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 12, textAlign: 'center' }]}>
              {locStatusMessage}
            </Text>
          </View>
        ) : geoLoc ? (
          <View style={{ alignItems: 'center' }}>
            <View style={styles.accuracyRow}>
              <Ionicons 
                name="location-outline" 
                size={20} 
                color={geoLoc.accuracyLevel === 'HIGH' ? colors.success : colors.warning} 
              />
              <Text style={[typography.label, { color: geoLoc.accuracyLevel === 'HIGH' ? colors.success : colors.warning, fontWeight: '800' }]}>
                {geoLoc.accuracyLevel === 'HIGH' ? 'Sinyal GPS Bagus' : 'Sinyal GPS Cukup'}
              </Text>
            </View>
            <Text style={[typography.body, { color: colors.textPrimary, marginTop: 8, textAlign: 'center', fontWeight: '600' }]}>
              {state.type === 'trash' ? 'Lokasi Rumah Anda' : 'Lokasi Tumpukan'} Sudah Pas
            </Text>
            {isOffline && (
              <View style={{ marginTop: 12, alignItems: 'center' }}>
                <Text style={[typography.caption, { color: colors.success, fontWeight: '700', textAlign: 'center' }]}>
                  Lokasi GPS berhasil disimpan
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 4 }]}>
                  Alamat akan dilengkapi saat internet tersedia
                </Text>
              </View>
            )}
          </View>
        ) : geoError?.code === 'PERMISSION_DENIED' ? (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="shield-outline" size={36} color={colors.warning} style={{ marginBottom: 8 }} />
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 }]}>
              Izin GPS Belum Aktif 🛰️{"\n\n"}RESIK butuh izin GPS untuk tahu posisi rumah Anda. Tolong pencet tombol di bawah untuk memberikan izin lokasi.
            </Text>
            <ResikButton title="Aktifkan Izin di Pengaturan" variant="outline" onPress={() => Linking.openSettings()} size="sm" />
          </View>
        ) : geoError?.code === 'GPS_DISABLED' || geoError ? (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="locate-outline" size={36} color={colors.warning} style={{ marginBottom: 8 }} />
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: 16, lineHeight: 20 }]}>
              {'GPS HP Anda belum dinyalakan.\nAktifkan GPS lalu tekan Coba Lagi.'}
            </Text>
            <ResikButton title="Coba Lagi" variant="outline" onPress={manualRetryLocation} size="sm" />
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <Ionicons name="alert-circle-outline" size={36} color={colors.textSecondary} style={{ marginBottom: 8 }} />
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', lineHeight: 20 }]}>
              Menunggu sinyal GPS...
            </Text>
          </View>
        )}
      </ResikCard>

      {/* Help card for elderly or stuck users on GPS step */}
      {!geoLoc && !locLoading && (
        <View style={[styles.helpBox, { backgroundColor: colors.secondary + '40', borderRadius: radius.md, marginTop: 24 }]}>
          <Ionicons name="help-circle-outline" size={20} color={colors.textSecondary} />
          <Text style={[typography.caption, { color: colors.textSecondary, flex: 1, marginLeft: 8 }]}>
            GPS HP Anda tetap tidak bisa ditemukan? Jangan bingung, hubungi petugas kami lewat WhatsApp.
          </Text>
          <TouchableOpacity onPress={handleWhatsAppHelp}>
            <Text style={[typography.caption, { color: colors.primary, fontWeight: '800' }]}>Tanya Petugas</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.bottomActions}>
        <ResikButton title="Gunakan Posisi Ini" disabled={!geoLoc} onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          updateState({ 
            location: { 
              lat: geoLoc!.latitude, 
              lng: geoLoc!.longitude, 
              accuracy: geoLoc!.accuracy,
              address: isOffline ? 'Alamat akan dilengkapi saat internet tersedia' : 'Lokasi Terdeteksi' 
            },
            step: 4
          });
        }} style={{ flex: 1 }} />
      </View>
    </View>
  );

  // --- STEP 4: DETAILS ---
  const renderStep4 = () => (
    <View style={styles.stepContainer}>
      <Text style={[typography.title, { color: colors.textPrimary, marginBottom: 24 }]}>
        Keterangan Sampah
      </Text>

      <Text style={[typography.label, { color: colors.textSecondary, marginBottom: 12 }]}>JENIS SAMPAH</Text>
      <View style={styles.chipRow}>
        {WASTE_CATEGORIES.map(cat => (
          <TouchableOpacity 
            key={cat} 
            onPress={() => updateState({ category: cat })}
            style={[
              styles.chip, 
              { backgroundColor: state.category === cat ? colors.primary : colors.secondary + '40' }
            ]}
          >
            <Text style={[typography.caption, { color: state.category === cat ? '#FFF' : colors.textPrimary, fontWeight: '700' }]}>
              {cat}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {state.type === 'trash' && (
        <View style={{ marginTop: 24 }}>
          <Text style={[typography.label, { color: colors.textSecondary, marginBottom: 12 }]}>SEBERAPA BANYAK SAMPAHNYA?</Text>
          <View style={styles.weightGrid}>
            {WEIGHT_OPTIONS.map(opt => (
              <TouchableOpacity 
                key={opt.label}
                onPress={() => updateState({ weightLabel: opt.label })}
                style={[
                  styles.weightCard,
                  { 
                    borderColor: state.weightLabel === opt.label ? colors.primary : colors.border,
                    backgroundColor: state.weightLabel === opt.label ? colors.primary + '05' : 'transparent'
                  }
                ]}
              >
                <Ionicons name={opt.icon as any} size={32} color={colors.primary} style={{ marginBottom: 6 }} />
                <Text style={[typography.caption, { color: colors.textPrimary, fontWeight: '700', textAlign: 'center' }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.bottomActions}>
        <ResikButton title="Periksa Laporan" onPress={nextStep} style={{ flex: 1 }} />
      </View>
    </View>
  );

  // --- STEP 5: REVIEW & WORKFLOW AND ERROR CODES ---
  const handleFinalSubmit = async () => {
    setIsSubmitting(true);
    const newTrackingId = 'RSK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    setTrackingId(newTrackingId);

    try {
      // 1. Check active connection state
      const netState = await NetInfo.fetch();
      const online = Boolean(netState.isConnected);

      // 2. Resolve photo — upload when online, keep local URI when offline.
      //    Sprint 0.5B will handle offline media queue.
      let resolvedPhotoUrl: string | undefined = state.photoUri ?? undefined;
      let resolvedStoragePath: string | undefined = undefined;

      if (online && state.photoUri) {
        try {
          setIsUploadingPhoto(true);
          // Get authenticated user ID for the storage path
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { publicUrl, storagePath } = await uploadReportPhoto(
              state.photoUri,
              user.id,
              newTrackingId   // use trackingId as the report folder name
            );
            resolvedPhotoUrl = publicUrl;
            resolvedStoragePath = storagePath;
            logger.info('Photo uploaded before submission', { storagePath });
          }
        } catch (uploadErr: unknown) {
          // Non-fatal: log the error but continue submission with local URI
          const msg = uploadErr instanceof Error ? uploadErr.message : 'Upload foto gagal';
          logger.warn(`Photo upload failed, continuing with local URI: ${msg}`);
          // resolvedPhotoUrl keeps the local URI so report is not lost
        } finally {
          setIsUploadingPhoto(false);
        }
      }

      // 3. Build the final payload with resolved photo fields
      // NOTE: idempotency_key is NOT set here — the offline queue assigns it.
      const payload: CreateReportPayload = {
        trash_type: state.category,
        estimated_weight: state.weightLabel === 'Kantong Kresek' ? 2 : state.weightLabel === 'Karung Sedang' ? 8 : 20,
        location_lat: state.location?.lat || 0,
        location_lng: state.location?.lng || 0,
        accuracy: state.location?.accuracy || 999,
        loc_timestamp: Date.now(),
        report_type: state.type || 'trash',
        tracking_id: newTrackingId,
        photo_url: resolvedPhotoUrl,
        storage_path: resolvedStoragePath,
        address: state.location?.address || (isOffline ? 'Alamat akan dilengkapi saat internet tersedia' : 'Lokasi Terpilih'),
      };

      if (!online) {
        // Offline: enqueue for later. The queue engine will auto-sync on reconnect.
        logger.info('Device is offline. Enqueuing report for background sync.');
        await offlineQueue.addTask('CREATE_REPORT', payload);
        setSuccessMode('offline');
        clearDraft();
      } else {
        // Online: attempt direct submission
        const result = await submitReport(payload);
        if (result) {
          setSuccessMode('online');
          clearDraft();
        } else {
          // Direct submission failed — fallback to queue to prevent data loss
          logger.warn('Online submission failed. Falling back to offline queue.');
          await offlineQueue.addTask('CREATE_REPORT', payload);
          setSuccessMode('offline');
          clearDraft();
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      logger.error('Error during final submission workflow', errMsg);
      // Absolute last resort — queue it so no data is lost
      try {
        const fallbackPayload: CreateReportPayload = {
          trash_type: state.category,
          estimated_weight: state.weightLabel === 'Kantong Kresek' ? 2 : state.weightLabel === 'Karung Sedang' ? 8 : 20,
          location_lat: state.location?.lat || 0,
          location_lng: state.location?.lng || 0,
          accuracy: state.location?.accuracy || 999,
          loc_timestamp: Date.now(),
          report_type: state.type || 'trash',
          tracking_id: trackingId || newTrackingId,
          photo_url: state.photoUri ?? undefined,
          address: state.location?.address || 'Alamat akan dilengkapi saat internet tersedia',
        };
        await offlineQueue.addTask('CREATE_REPORT', fallbackPayload);
        setSuccessMode('offline');
        clearDraft();
      } catch {
        Alert.alert(
          'Gagal Mengirim Laporan ❌',
          'Koneksi internet bermasalah dan memori penyimpanan HP Anda penuh. Tolong hapus beberapa berkas lalu coba lagi.',
          [{ text: 'Mengerti' }]
        );
      }
    } finally {
      setIsUploadingPhoto(false);
      setIsSubmitting(false);
    }
  };

  const renderStep5 = () => (
    <View style={styles.stepContainer}>
      <Text style={[typography.title, { color: colors.textPrimary, marginBottom: 24 }]}>
        Periksa Sebelum Kirim
      </Text>
      
      <ResikCard variant="elevated" style={styles.reviewCard}>
        <View style={styles.reviewRow}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Laporan</Text>
          <ResikBadge label={state.type === 'trash' ? 'SAMPAH RUMAH' : 'SAMPAH LIAR'} variant="info" />
        </View>
        <View style={styles.reviewRow}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Jenis Sampah</Text>
          <Text style={[typography.body, { fontWeight: '700' }]}>{state.category}</Text>
        </View>
        <View style={styles.reviewRow}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Posisi Peta</Text>
          <Text style={[typography.body, { fontWeight: '700' }]}>Sudah Pas</Text>
        </View>
      </ResikCard>

      <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: 16 }]}>
        Petugas akan memeriksa dan mengambil sampah Anda dalam 1 hari.
      </Text>

      {isUploadingPhoto && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, gap: 8 }}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>
            Mengunggah foto...
          </Text>
        </View>
      )}

      <View style={styles.bottomActions}>
        <ResikButton 
          title={isUploadingPhoto ? 'Mengunggah foto...' : 'KIRIM SEKARANG'}
          loading={isSubmitting || isUploadingPhoto}
          onPress={handleFinalSubmit} 
          style={{ flex: 1 }} 
        />
      </View>
    </View>
  );

  // --- SUCCESS STATE ---
  const renderSuccess = () => (
    <View style={[styles.stepContainer, { alignItems: 'center', justifyContent: 'center', paddingTop: 40 }]}>
      <View style={[styles.successRing, { backgroundColor: successMode === 'online' ? colors.success + '15' : colors.warning + '15' }]}>
        <Ionicons 
          name={successMode === 'online' ? 'checkmark-circle' : 'cloud-offline'} 
          size={56} 
          color={successMode === 'online' ? colors.success : colors.warning} 
        />
      </View>
      
      <Text style={[typography.heading, { color: colors.textPrimary, textAlign: 'center', marginTop: 24, fontWeight: '800' }]}>
        {successMode === 'online' ? 'Terima Kasih, Tetangga! 🙌' : 'Laporan Aman Disimpan di HP ☁️'}
      </Text>
      
      <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 10, paddingHorizontal: 16, lineHeight: 22 }]}>
        {successMode === 'online' 
          ? 'Laporan sampah Anda sudah kami terima. Tabungan sampah Anda bertambah +50 Poin.'
          : 'Jangan khawatir, internet sedang mati. Laporan sudah tersimpan aman di HP dan akan terkirim sendiri begitu HP mendapat sinyal internet.'}
      </Text>

      <ResikCard variant="elevated" style={styles.receiptCard}>
        <View style={styles.receiptRow}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Kategori Setoran</Text>
          <Text style={[typography.body, { fontWeight: '700', color: colors.textPrimary }]}>
            {state.type === 'trash' ? 'Sampah Rumah' : 'Sampah Liar'}
          </Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Jenis Sampah</Text>
          <Text style={[typography.body, { fontWeight: '700', color: colors.textPrimary }]}>{state.category}</Text>
        </View>
        <View style={styles.receiptRow}>
          <Text style={[typography.caption, { color: colors.textSecondary }]}>Estimasi Poin</Text>
          <Text style={[typography.body, { fontWeight: '800', color: colors.success }]}>+50 Poin</Text>
        </View>
      </ResikCard>

      <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center', marginTop: 16, paddingHorizontal: 16, fontStyle: 'italic' }]}>
        {successMode === 'online'
          ? '💡 Mohon ikat sampah dengan rapat dan taruh di luar pagar agar tidak diacak-acak hewan.'
          : '💡 Anda bisa menutup aplikasi ini. Sampah tetap akan dijadwalkan oleh petugas desa.'}
      </Text>

      <View style={[styles.ticketBox, { borderColor: colors.border, borderRadius: radius.md }]}>
        <Text style={[typography.label, { color: colors.textMuted, fontSize: 10 }]}>Nomor Laporan</Text>
        <Text style={[typography.title, { color: colors.primary, fontWeight: '900', letterSpacing: 0.5, marginTop: 2 }]}>{trackingId}</Text>
      </View>

      <View style={styles.successCtaContainer}>
        <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700', textAlign: 'center', marginBottom: 12 }]}>
          {state.type === 'trash' ? 'Masih ada sampah lain yang ingin disetor?' : 'Ingin melaporkan lokasi lain?'}
        </Text>
        
        <ResikButton 
          title={state.type === 'trash' ? 'Setor Sampah Lagi' : 'Laporkan Titik Lain'} 
          onPress={handleRepeatReport} 
          style={{ marginBottom: 12 }} 
        />
        
        <ResikButton 
          title="Kembali ke Beranda" 
          variant="outline"
          onPress={handleGoHome} 
          style={{ marginBottom: 16 }} 
        />
        
        <TouchableOpacity 
          onPress={handleTertiaryHelp} 
          activeOpacity={0.8}
          style={{ paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={[typography.body, { color: colors.primary, fontWeight: '800', fontSize: 14 }]}>
            Hubungi Petugas Desa
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const steps = [
    { id: 1, label: 'Pilih' },
    { id: 2, label: 'Foto' },
    { id: 3, label: 'Lokasi' },
    { id: 4, label: 'Wadah' },
    { id: 5, label: 'Kirim' },
  ];

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      {successMode === 'none' && (
        <View style={styles.header}>
          <TouchableOpacity onPress={state.step === 1 ? () => {
            Alert.alert(
              'Keluar dari laporan?',
              'Laporan Anda belum terkirim.',
              [
                { text: 'Batal', style: 'cancel' },
                { text: 'Keluar', style: 'destructive', onPress: () => { clearDraft(); router.back(); } },
              ]
            );
          } : prevStep} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: colors.secondary }]}>
              <View style={[
                styles.progressFill, 
                { backgroundColor: colors.primary, width: `${(state.step / steps.length) * 100}%` }
              ]} />
            </View>
            <View style={styles.stepLabels}>
              {steps.map(s => (
                <Text key={s.id} style={[
                  typography.label, 
                  { fontSize: 12, color: state.step >= s.id ? colors.primary : colors.textMuted }
                ]}>
                  {s.label}
                </Text>
              ))}
            </View>
          </View>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.scroll}>
        {successMode !== 'none' ? renderSuccess() : (
          <>
            {state.step === 1 && renderStep1()}
            {state.step === 2 && renderStep2()}
            {state.step === 3 && renderStep3()}
            {state.step === 4 && renderStep4()}
            {state.step === 5 && renderStep5()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
  },
  progressContainer: {
    flex: 1,
    marginLeft: 12,
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  stepLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  scroll: {
    flexGrow: 1,
    paddingBottom: 100,
  },
  stepContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  typeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 24,
    gap: 20,
  },
  largeIcon: {
    fontSize: 40,
  },
  cameraPlaceholder: {
    height: 300,
    backgroundColor: '#F0F2F5',
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 24,
  },
  locationCard: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  accuracyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  chip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
  },
  weightGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  weightCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewCard: {
    padding: 24,
    gap: 16,
  },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  bottomActions: {
    marginTop: 48,
    flexDirection: 'row',
  },
  successRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  receiptCard: {
    width: '100%',
    padding: 16,
    marginTop: 24,
    gap: 12,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: 24,
    alignItems: 'center',
  },
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    gap: 8,
  },
  helpBox: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginTop: 16,
  },
  successCtaContainer: {
    width: '100%',
    paddingHorizontal: 24,
    marginTop: 24,
    alignItems: 'stretch',
  },
});
