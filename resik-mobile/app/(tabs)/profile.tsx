import React, { useState, useMemo, useRef } from 'react';
import { useResikTheme } from '../../hooks/use-theme-color';
import { ResikHeader } from '../../components/ui/ResikHeader';
import { ResikSection } from '../../components/ui/ResikSection';
import { ResikButton } from '../../components/ui/ResikButton';
import { ResikCard } from '../../components/ui/ResikCard';
import { ResikBadge } from '../../components/ui/ResikBadge';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, ScrollView, Text, StyleSheet, TextInput, Alert, Animated, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useAuth } from '../../hooks/use-auth';
import { useRealtimeReports } from '../../hooks/use-realtime-reports';
import { useOfflineSync } from '../../hooks/use-offline-sync';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

export default function ProfileScreen() {
  const { colors, spacing, typography, radius } = useResikTheme();
  const { signOut, user } = useAuth();
  const { reports, balance, refreshData } = useRealtimeReports();
  const { stats, failedCount, isSyncing, retryFailed } = useOfflineSync();
  const [isRetrying, setIsRetrying] = useState(false);

  const [isOfficerMode, setIsOfficerMode] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // QR Simulator state
  const [qrActive, setQrActive] = useState(false);
  const [scannedUser, setScannedUser] = useState<string | null>(null);
  const [scannedWeight, setScannedWeight] = useState('');
  const [isProcessingQr, setIsProcessingQr] = useState(false);

  // Bulk processing state
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [isProcessingBulk, setIsProcessingBulk] = useState(false);

  const completedCount = useMemo(() => {
    return reports.filter(r => r.status === 'completed').length;
  }, [reports]);

  const pendingReports = useMemo(() => {
    return reports.filter(r => r.status !== 'completed' && r.status !== 'cancelled');
  }, [reports]);

  const phoneDisplay = user?.phone_number || '0812-3456-7890';

  // Toggle Mode with Fade Microinteraction
  const handleToggleMode = (mode: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: true,
    }).start(() => {
      setIsOfficerMode(mode);
      // Clear simulations on toggle
      setQrActive(false);
      setScannedUser(null);
      setScannedWeight('');
      setSelectedReports([]);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }).start();
    });
  };

  // QR Scanning Simulation
  const handleScanSimulation = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setQrActive(true);
    setTimeout(() => {
      setScannedUser('Ibu Aminah (RT 03)');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }, 1500);
  };

  const handleSaveQrWeight = async () => {
    if (!scannedWeight || isNaN(Number(scannedWeight))) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Gagal Simpan', 'Harap masukkan berat sampah yang benar (angka).');
      return;
    }
    setIsProcessingQr(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsProcessingQr(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(
      'Timbangan Disimpan! ⚖️',
      `Sampah milik ${scannedUser} seberat ${scannedWeight} kg berhasil diverifikasi. Tabungan poin warga bertambah +${Number(scannedWeight) * 10} Poin.`
    );
    setScannedUser(null);
    setScannedWeight('');
    setQrActive(false);
  };

  // Bulk Processing implementation
  const handleSelectReport = (id: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedReports(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    if (selectedReports.length === pendingReports.length) {
      setSelectedReports([]);
    } else {
      setSelectedReports(pendingReports.map(r => r.id));
    }
  };

  const handleProcessBulk = async () => {
    if (selectedReports.length === 0) return;
    setIsProcessingBulk(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setIsProcessingBulk(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(
      'Setoran Massal Selesai! 🎉',
      `Berhasil menimbang dan menyelesaikan ${selectedReports.length} laporan setoran warga secara massal.`
    );
    setSelectedReports([]);
    refreshData();
  };

  // RENDER OFFICER DASHBOARD
  const renderOfficerMode = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <ResikHeader 
        title="Panel Petugas Desa" 
        subtitle="Menu timbangan warga dan kelola setoran massal." 
      />

      {/* Stats Summary */}
      <View style={styles.summaryRow}>
        <ResikCard variant="elevated" style={[styles.summaryCard, { backgroundColor: colors.primary }]}>
          <Text style={[typography.caption, { color: '#FFFFFF', opacity: 0.8 }]}>Setoran Aktif</Text>
          <Text style={[typography.heading, { color: '#FFFFFF', fontWeight: '800', marginTop: 4 }]}>
            {pendingReports.length} Laporan
          </Text>
        </ResikCard>
      </View>

      {/* P2: SCAN QR CEPAT SIMULATOR */}
      <ResikSection title="Scan Kartu QR Warga">
        <ResikCard variant="outlined" style={styles.qrCard}>
          {!qrActive ? (
            <View style={{ alignItems: 'center' }}>
              <Ionicons name="qr-code-outline" size={48} color={colors.textSecondary} style={{ marginBottom: 12 }} />
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginBottom: 16 }]}>
                Dekatkan HP ke kartu QR warga untuk menimbang langsung
              </Text>
              <ResikButton title="Simulasikan Scan Kartu" onPress={handleScanSimulation} size="sm" />
            </View>
          ) : !scannedUser ? (
            <View style={{ alignItems: 'center', paddingVertical: 12 }}>
              <View style={[styles.scannerViewfinder, { borderColor: colors.primary, borderRadius: radius.md }]}>
                <Ionicons name="scan-outline" size={72} color={colors.primary} />
                <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
              </View>
              <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 12, fontWeight: '700' }]}>
                Membaca kode QR warga...
              </Text>
            </View>
          ) : (
            <View>
              <View style={styles.scannedHeader}>
                <Ionicons name="person-circle-outline" size={24} color={colors.primary} />
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '800', marginLeft: 8 }]}>
                  {scannedUser}
                </Text>
              </View>
              <Text style={[typography.label, { color: colors.textSecondary, marginTop: 12 }]}>MASUKKAN BERAT SAMPAH (KG)</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, borderRadius: radius.md }]}
                keyboardType="numeric"
                placeholder="Contoh: 12"
                value={scannedWeight}
                onChangeText={setScannedWeight}
              />
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <ResikButton 
                  title="Simpan" 
                  loading={isProcessingQr}
                  onPress={handleSaveQrWeight} 
                  style={{ flex: 1 }} 
                  size="sm"
                />
                <ResikButton 
                  title="Batal" 
                  variant="outline" 
                  onPress={() => { setScannedUser(null); setQrActive(false); }} 
                  style={{ flex: 1 }} 
                  size="sm"
                />
              </View>
            </View>
          )}
        </ResikCard>
      </ResikSection>

      {/* P2: BULK PROCESSING SETORAN MASSAL */}
      <ResikSection title="Timbang Masal (Bulk)">
        <ResikCard variant="elevated" style={styles.bulkCard}>
          <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 12 }]}>
            Pilih warga yang ingin ditimbang sekaligus:
          </Text>

          {pendingReports.length === 0 ? (
            <Text style={[typography.body, { color: colors.textMuted, fontStyle: 'italic', paddingVertical: 12 }]}>
              Tidak ada setoran aktif yang perlu ditimbang.
            </Text>
          ) : (
            <View>
              <TouchableOpacity 
                onPress={handleToggleSelectAll} 
                style={styles.selectAllRow}
                activeOpacity={0.8}
              >
                <Ionicons 
                  name={selectedReports.length === pendingReports.length ? 'checkbox' : 'square-outline'} 
                  size={20} 
                  color={colors.primary} 
                />
                <Text style={[typography.body, { color: colors.primary, fontWeight: '700', marginLeft: 8 }]}>
                  {selectedReports.length === pendingReports.length ? 'Batal Pilih Semua' : 'Pilih Semua Setoran'}
                </Text>
              </TouchableOpacity>

              {pendingReports.map(report => {
                const isSelected = selectedReports.includes(report.id);
                return (
                  <TouchableOpacity 
                    key={report.id} 
                    onPress={() => handleSelectReport(report.id)}
                    style={[styles.checkboxRow, { borderBottomColor: colors.border }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons 
                      name={isSelected ? 'checkbox' : 'square-outline'} 
                      size={24} 
                      color={isSelected ? colors.primary : colors.textMuted} 
                    />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700' }]}>
                        {report.address.split(',')[0]}
                      </Text>
                      <Text style={[typography.caption, { color: colors.textSecondary }]}>
                        Kategori: {report.trash_type}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}

              <ResikButton 
                title={`Proses ${selectedReports.length} Setoran Massal`} 
                disabled={selectedReports.length === 0}
                loading={isProcessingBulk}
                onPress={handleProcessBulk}
                style={{ marginTop: 16 }}
                size="sm"
              />
            </View>
          )}
        </ResikCard>
      </ResikSection>

      <ResikButton 
        title="Kembali ke Mode Warga" 
        variant="outline" 
        onPress={() => handleToggleMode(false)} 
        style={{ marginTop: 24, marginBottom: 40 }} 
      />
    </Animated.View>
  );

  // RENDER STANDARD CITIZEN PROFILE
  const renderCitizenMode = () => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <ResikHeader 
        title="Profil Saya" 
        subtitle={phoneDisplay} 
      />

      <ResikSection title="Kontribusi Sampah Anda">
        <ResikCard variant="elevated" style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <View style={styles.statCell}>
              <Ionicons name="wallet-outline" size={28} color={colors.primary} />
              <Text style={[typography.title, { color: colors.textPrimary, fontWeight: '800', marginTop: 6 }]}>
                {balance.toLocaleString('id-ID')}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
                Total Poin
              </Text>
            </View>
            
            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.statCell}>
              <Ionicons name="checkmark-done-circle-outline" size={28} color={colors.success} />
              <Text style={[typography.title, { color: colors.textPrimary, fontWeight: '800', marginTop: 6 }]}>
                {completedCount} Kali
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
                Sampah Diambil
              </Text>
            </View>
          </View>
        </ResikCard>
      </ResikSection>

      <ResikSection title="Menu Khusus Petugas">
        <TouchableOpacity 
          onPress={() => handleToggleMode(true)}
          activeOpacity={0.9}
        >
          <ResikCard variant="elevated" style={[styles.officerCard, { borderColor: colors.primary, borderRadius: radius.lg }]}>
            <View style={styles.officerCardHeader}>
              <View style={[styles.officerIconBg, { backgroundColor: colors.primary + '15', borderRadius: radius.sm }]}>
                <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '800' }]}>Timbangan BUMDes Desa</Text>
                <Text style={[typography.caption, { color: colors.textSecondary }]}>Menu masuk petugas untuk menimbang & verifikasi sampah warga.</Text>
              </View>
              <ResikBadge label="PETUGAS" variant="primary" />
            </View>
            <View style={[styles.officerCardFooter, { backgroundColor: colors.secondary + '30' }]}>
              <Text style={[typography.caption, { color: colors.primary, fontWeight: '700' }]}>Ketuk untuk Masuk Panel Petugas →</Text>
            </View>
          </ResikCard>
        </TouchableOpacity>
      </ResikSection>

      <ResikSection title="Pusat Sinkronisasi">
        <ResikCard variant="elevated" style={styles.syncCenterCard}>
          <View style={styles.syncStatsGrid}>
            <View style={styles.syncStatCell}>
              <Text style={[typography.heading, { color: colors.warning, fontWeight: '800' }]}>
                {stats.pending + stats.syncing}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 2 }]}>
                {'Menunggu\nSinkronisasi'}
              </Text>
            </View>
            <View style={[styles.syncStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.syncStatCell}>
              <Text style={[typography.heading, { color: colors.success, fontWeight: '800' }]}>
                {stats.synced}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 2 }]}>
                {'Berhasil\nTersinkron'}
              </Text>
            </View>
            <View style={[styles.syncStatDivider, { backgroundColor: colors.border }]} />
            <View style={styles.syncStatCell}>
              <Text style={[typography.heading, { color: failedCount > 0 ? colors.danger : colors.textMuted, fontWeight: '800' }]}>
                {stats.failed}
              </Text>
              <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', marginTop: 2 }]}>
                {'Gagal\nTerkirim'}
              </Text>
            </View>
          </View>

          {failedCount > 0 && (
            <ResikButton
              title={isRetrying || isSyncing ? 'Mencoba Ulang...' : `Coba Ulang ${failedCount} Laporan Gagal`}
              loading={isRetrying || isSyncing}
              variant="outline"
              style={{ marginTop: spacing.md }}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                setIsRetrying(true);
                try {
                  await retryFailed();
                } finally {
                  setIsRetrying(false);
                }
              }}
            />
          )}

          {failedCount === 0 && stats.pending === 0 && (
            <View style={styles.syncAllGood}>
              <Ionicons name="checkmark-circle" size={18} color={colors.success} />
              <Text style={[typography.caption, { color: colors.success, fontWeight: '700', marginLeft: 6 }]}>
                Semua laporan sudah tersinkron
              </Text>
            </View>
          )}
        </ResikCard>
      </ResikSection>

      <ResikSection title="Pengaturan Akun">
        <View style={{ gap: spacing.md }}>
          <ResikButton title="Ubah WhatsApp" variant="outline" onPress={() => {}} />
          <ResikButton title="Bantuan & Dukungan" variant="outline" onPress={() => {}} />
        </View>
      </ResikSection>

      <ResikSection title="Aplikasi">
        <View style={{ gap: spacing.md }}>
          <ResikButton title="Tentang RESIK" variant="outline" onPress={() => {}} />
          <ResikButton title="Keluar Akun" variant="danger" onPress={() => signOut()} />
        </View>
      </ResikSection>
    </Animated.View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
        {isOfficerMode ? renderOfficerMode() : renderCitizenMode()}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  statsCard: {
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    width: 1,
    height: '60%',
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCard: {
    padding: 24,
    alignItems: 'stretch',
    minHeight: 180,
  },
  scannedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingBottom: 8,
  },
  input: {
    borderWidth: 1,
    height: 48,
    paddingHorizontal: 12,
    marginTop: 8,
    fontSize: 16,
  },
  bulkCard: {
    padding: 16,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  scannerViewfinder: {
    width: 140,
    height: 140,
    borderWidth: 2,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 8,
  },
  officerCard: {
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  officerCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  officerIconBg: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  officerCardFooter: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'flex-start',
  },
  syncCenterCard: {
    padding: 16,
  },
  syncStatsGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  syncStatCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  syncStatDivider: {
    width: 1,
    height: 48,
  },
  syncAllGood: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
});
