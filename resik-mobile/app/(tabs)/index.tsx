import React, { useMemo, useEffect, useRef } from 'react';
import { StyleSheet, View, ScrollView, Text, RefreshControl, Dimensions, Animated, TouchableOpacity, Linking, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthContext } from '../../hooks/auth-context';
import { useRealtimeReports } from '../../hooks/use-realtime-reports';
import { useResikTheme } from '../../hooks/use-theme-color';
import { useOfflineSync } from '../../hooks/use-offline-sync';
import { ResikHeader } from '../../components/ui/ResikHeader';
import { ResikSection } from '../../components/ui/ResikSection';
import { ResikCard } from '../../components/ui/ResikCard';
import { ResikStatusTimeline } from '../../components/ui/ResikStatusTimeline';
import { ResikBadge } from '../../components/ui/ResikBadge';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

// Realistic rewards data mapping to unique category colors (reducing green and improving visual scanning)
const MOCK_REWARDS = [
  { id: '1', name: 'Minyak Goreng 1 Liter', points: 17000, icon: 'water-outline', color: '#3B82F6', kiosk: 'Kios Kelontong Bu Ipah' },
  { id: '2', name: 'Pulsa Token Listrik 20rb', points: 21000, icon: 'flash-outline', color: '#D97706', kiosk: 'Tukar Otomatis' },
  { id: '3', name: 'Beras Sembako 5 kg', points: 70000, icon: 'leaf-outline', color: '#10B981', kiosk: 'Kios Kelontong Bu Ipah' },
  { id: '4', name: 'Paket Sembako Murah', points: 45000, icon: 'gift-outline', color: '#EF4444', kiosk: 'Warung Pak Slamet' },
];

export default function HomeHubScreen() {
  const { user } = useAuthContext();
  const { reports, balance, loading, refreshData } = useRealtimeReports();
  const { colors, spacing, typography, radius } = useResikTheme();
  const { count, isSyncing, isConnected, failedCount } = useOfflineSync();

  const pulseAnim = useRef(new Animated.Value(0.4)).current;

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

  // Pulse animation for skeleton loading
  useEffect(() => {
    if (loading) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.8,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [loading, pulseAnim]);

  // Find active report (pending or scheduled)
  const activeReport = useMemo(() => {
    return reports.find(r => r.status !== 'completed' && r.status !== 'cancelled');
  }, [reports]);

  // Determine next milestone
  const nextMilestone = useMemo(() => {
    const sorted = [...MOCK_REWARDS].sort((a, b) => a.points - b.points);
    const target = sorted.find(r => r.points > balance) || sorted[sorted.length - 1];
    const pointsNeeded = Math.max(0, target.points - balance);
    const progress = Math.min(1, balance / target.points);
    return {
      name: target.name,
      targetPoints: target.points,
      needed: pointsNeeded,
      progressPercentage: progress * 100,
    };
  }, [balance]);

  const firstName = user?.full_name?.split(' ')[0] || 'Warga';
  const rupiahEquivalent = balance.toLocaleString('id-ID');

  // Skeleton loading screen
  if (loading && reports.length === 0) {
    return (
      <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          <Animated.View style={[styles.skeleton, { width: 140, height: 28, marginBottom: 8, opacity: pulseAnim }]} />
          <Animated.View style={[styles.skeleton, { width: 220, height: 16, marginBottom: 24, opacity: pulseAnim }]} />
          <Animated.View style={[styles.skeleton, { height: 180, marginBottom: 24, borderRadius: radius.xl, opacity: pulseAnim }]} />
          
          <Animated.View style={[styles.skeleton, { height: 120, marginBottom: 12, borderRadius: radius.xl, opacity: pulseAnim }]} />
          <Animated.View style={[styles.skeleton, { height: 64, marginBottom: 24, borderRadius: radius.xl, opacity: pulseAnim }]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView 
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refreshData} tintColor={colors.primary} />
        }
      >
        <ResikHeader 
          title={`Halo, ${firstName} 👋`}
          subtitle="Selamat datang di Tabungan Sampah Desa."
        />

        {/* 1. PREMIUM SLATE WALLET CARD (Reduces green color by 30% on home screen) */}
        <ResikCard variant="elevated" style={[styles.walletCard, { backgroundColor: '#0F172A' }]}>
          <View style={styles.walletHeader}>
            <Text style={[typography.caption, { color: '#94A3B8', fontWeight: '700', letterSpacing: 1 }]}>
              TABUNGAN SAMPAH DESA
            </Text>
            <ResikBadge label="AKTIF" variant="success" style={{ backgroundColor: 'rgba(16,185,129,0.2)' }} />
          </View>
          
          <View style={styles.walletBalanceRow}>
            <View>
              <Text style={[typography.display, { color: '#FFFFFF', fontWeight: '800' }]}>
                {balance.toLocaleString('id-ID')} <Text style={{ fontSize: 18, fontWeight: '400', color: '#94A3B8' }}>Poin</Text>
              </Text>
              <Text style={[typography.body, { color: '#94A3B8', marginTop: 2, fontWeight: '600' }]}>
                Bisa ditukar sembako setara Rp{rupiahEquivalent}
              </Text>
            </View>
            <Ionicons name="wallet-outline" size={40} color="#94A3B8" />
          </View>

          {/* Goal Milestone */}
          <View style={[styles.progressContainer, { marginTop: spacing.md }]}>
            <View style={styles.progressLabelRow}>
              <Text style={[typography.caption, { color: '#FFFFFF', fontWeight: '700' }]}>
                Target Tukar Hadiah
              </Text>
              <Text style={[typography.caption, { color: '#94A3B8', fontWeight: '700' }]}>
                {Math.round(nextMilestone.progressPercentage)}%
              </Text>
            </View>
            <View style={[styles.progressBarBg, { backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: radius.sm }]}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { 
                    backgroundColor: colors.warning, 
                    width: `${nextMilestone.progressPercentage}%`,
                    borderRadius: radius.sm 
                  }
                ]} 
              />
            </View>
            <Text style={[typography.caption, { color: '#94A3B8', marginTop: 6, fontStyle: 'italic' }]}>
              {nextMilestone.needed > 0 
                ? `Kurang ${nextMilestone.needed.toLocaleString('id-ID')} poin lagi untuk ditukar ${nextMilestone.name}`
                : `Poin Anda cukup untuk ditukar ${nextMilestone.name}`}
            </Text>
          </View>
        </ResikCard>

        {/* 2. COMPRESSED ACTIVE REPORT TRACKER */}
        {activeReport && (
          <ResikSection title="Status Setoran Anda">
            <ResikCard variant="elevated" style={styles.timelineCard}>
              <View style={styles.timelineHeader}>
                <View>
                  <Text style={[typography.title, { color: colors.textPrimary, fontWeight: '800' }]}>
                    {activeReport.trash_type}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    Kategori: {activeReport.report_type === 'illegal' ? 'Sampah Liar di Jalan ⚠️' : 'Setor Sampah Rumah 🏠'}
                  </Text>
                </View>
                <Text style={[typography.caption, { color: colors.textMuted }]}>
                  {new Date(activeReport.created_at).toLocaleDateString('id-ID')}
                </Text>
              </View>
              <ResikStatusTimeline currentStatus={activeReport.status as any} />
            </ResikCard>
          </ResikSection>
        )}

        {/* 3. CLARIFIED PRIMARY CTA & SECONDARY ACTION HIERARCHY */}
        <ResikSection title="Layanan Sampah Desa">
          <View style={{ gap: 12 }}>
            {/* Primary Action Card: Setor Sampah Rumah */}
            <TouchableOpacity onPress={() => router.push('/report?type=trash')} activeOpacity={0.9}>
              <ResikCard variant="elevated" style={[styles.primaryCtaCard, { borderColor: colors.primary }]}>
                <View style={styles.ctaHeader}>
                  <View style={[styles.ctaIconBg, { backgroundColor: colors.primary + '15' }]}>
                    <Ionicons name="basket-outline" size={28} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[typography.title, { color: colors.textPrimary, fontWeight: '800' }]}>Setor Sampah Rumah</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, fontSize: 13 }]}>Panggil petugas ke rumah untuk menimbang sampah Anda</Text>
                  </View>
                </View>
                <View style={[styles.ctaButton, { backgroundColor: colors.primary, borderRadius: radius.pill }]}>
                  <Text style={[typography.body, { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }]}>Mulai Setor Sekarang</Text>
                </View>
              </ResikCard>
            </TouchableOpacity>

            {/* Secondary Action Link: Lapor Sampah Liar */}
            <TouchableOpacity onPress={() => router.push('/report?type=illegal')} activeOpacity={0.9}>
              <ResikCard variant="outlined" style={styles.secondaryCtaCard}>
                <View style={styles.secondaryCtaHeader}>
                  <Ionicons name="warning-outline" size={22} color={colors.warning} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700', fontSize: 15 }]}>Lapor Sampah Liar di Jalan</Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, fontSize: 12 }]}>Foto & laporkan tumpukan sampah liar di jalan/selokan</Text>
                  </View>
                  <Ionicons name="chevron-forward-outline" size={18} color={colors.textMuted} />
                </View>
              </ResikCard>
            </TouchableOpacity>

            {/* Elderly Support Help Path */}
            <TouchableOpacity onPress={handleWhatsAppHelp} activeOpacity={0.9}>
              <ResikCard variant="elevated" style={[styles.elderlyHelpCard, { backgroundColor: '#10B98115', borderColor: '#10B98130', borderWidth: 1 }]}>
                <View style={styles.elderlyHelpHeader}>
                  <Ionicons name="logo-whatsapp" size={24} color="#10B981" />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '800', fontSize: 14 }]}>
                      Butuh Bantuan Setor Sampah? 👵👴
                    </Text>
                    <Text style={[typography.caption, { color: colors.textSecondary, fontSize: 12 }]}>
                      Bingung pakai HP? Hubungi pengurus desa lewat WhatsApp, kami siap bantu ke rumah.
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward-outline" size={18} color="#10B981" />
                </View>
              </ResikCard>
            </TouchableOpacity>
          </View>
        </ResikSection>

        {/* 4. REWARD CAROUSEL (DIVERSE ACCENT COLORS TO REDUCE GREEN OVERLOAD) */}
        <ResikSection title="Katalog Penukaran Sembako">
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            contentContainerStyle={styles.carouselContainer}
          >
            {MOCK_REWARDS.map(reward => (
              <ResikCard key={reward.id} variant="outlined" style={styles.carouselCard}>
                <View style={[styles.rewardIconContainer, { backgroundColor: reward.color + '15', borderRadius: radius.md }]}>
                  <Ionicons name={reward.icon as any} size={32} color={reward.color} />
                </View>
                <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700', marginTop: 10, height: 40 }]} numberOfLines={2}>
                  {reward.name}
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, marginBottom: 8 }]}>
                  📍 {reward.kiosk}
                </Text>
                <ResikBadge 
                  label={`${reward.points.toLocaleString('id-ID')} POIN`} 
                  variant="primary" 
                  style={{ alignSelf: 'stretch', alignItems: 'center' }} 
                />
              </ResikCard>
            ))}
          </ScrollView>
        </ResikSection>

        {/* 5. COMMUNITY IMPACT CARD (SLATE NEUTRAL ICONS) */}
        <ResikSection title="Dampak Gotong Royong Desa Kita">
          <ResikCard variant="elevated" style={styles.impactCard}>
            <View style={styles.impactGrid}>
              <View style={styles.impactCell}>
                <Ionicons name="leaf-outline" size={24} color={colors.icon} style={{ marginBottom: 4 }} />
                <Text style={[typography.title, { color: colors.textPrimary, fontWeight: '800' }]}>
                  312 kg
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', fontSize: 12 }]}>
                  Sampah Terkumpul
                </Text>
              </View>
              <View style={[styles.impactDivider, { backgroundColor: colors.border }]} />
              
              <View style={styles.impactCell}>
                <Ionicons name="people-outline" size={24} color={colors.icon} style={{ marginBottom: 4 }} />
                <Text style={[typography.title, { color: colors.textPrimary, fontWeight: '800' }]}>
                  57 Warga
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', fontSize: 12 }]}>
                  Aktif Memilah
                </Text>
              </View>
              <View style={[styles.impactDivider, { backgroundColor: colors.border }]} />

              <View style={styles.impactCell}>
                <Ionicons name="ribbon-outline" size={24} color={colors.icon} style={{ marginBottom: 4 }} />
                <Text style={[typography.title, { color: colors.textPrimary, fontWeight: '800' }]}>
                  9 Titik
                </Text>
                <Text style={[typography.caption, { color: colors.textSecondary, textAlign: 'center', fontSize: 12 }]}>
                  Liar Dibersihkan
                </Text>
              </View>
            </View>
          </ResikCard>
        </ResikSection>

        {/* 6. SYNC STATUS BANNER */}
        <View style={styles.syncStatusFooter}>
          {failedCount > 0 ? (
            <View style={[styles.syncBanner, { backgroundColor: '#FEF3C7', borderColor: '#FCD34D', borderWidth: 1 }]}>
              <Text style={[typography.caption, { color: '#92400E', fontWeight: '700', textAlign: 'center' }]}>
                {`⚠️ ${failedCount} laporan gagal dikirim — buka Profil untuk coba ulang`}
              </Text>
            </View>
          ) : !isConnected ? (
            <View style={[styles.syncBanner, { backgroundColor: '#F1F5F9', borderColor: '#CBD5E1', borderWidth: 1 }]}>
              <Text style={[typography.caption, { color: '#475569', fontWeight: '600', textAlign: 'center' }]}>
                {'🔌 Sinyal Internet Mati — Laporan Anda disimpan aman di HP'}
              </Text>
            </View>
          ) : isSyncing ? (
            <View style={[styles.syncBanner, { backgroundColor: '#EFF6FF', borderColor: '#BFDBFE', borderWidth: 1 }]}>
              <Text style={[typography.caption, { color: '#1D4ED8', fontWeight: '600', textAlign: 'center' }]}>
                {'☁️ Sedang mengirim laporan Anda ke server...'}
              </Text>
            </View>
          ) : count > 0 ? (
            <View style={[styles.syncBanner, { backgroundColor: '#FFF7ED', borderColor: '#FED7AA', borderWidth: 1 }]}>
              <Text style={[typography.caption, { color: '#C2410C', fontWeight: '600', textAlign: 'center' }]}>
                {`📋 ${count} laporan menunggu koneksi internet`}
              </Text>
            </View>
          ) : (
            <View style={[styles.syncBanner, { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0', borderWidth: 1 }]}>
              <Text style={[typography.caption, { color: '#166534', fontWeight: '600', textAlign: 'center' }]}>
                {'✅ Semua laporan berhasil tersinkron'}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  scroll: { paddingBottom: 40 },
  walletCard: {
    padding: 20,
    marginBottom: 24,
  },
  walletHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  walletBalanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 12,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  progressBarBg: {
    height: 8,
    width: '100%',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
  },
  timelineCard: {
    padding: 16,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionCol: {
    flex: 1,
  },
  fullWidthCard: {
    width: '100%',
  },
  carouselContainer: {
    gap: 12,
    paddingRight: 16,
    paddingBottom: 4,
  },
  carouselCard: {
    width: width * 0.42,
    padding: 12,
  },
  rewardIconContainer: {
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rewardIcon: {
    fontSize: 32,
  },
  impactCard: {
    padding: 16,
  },
  impactGrid: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  impactCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  impactEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  impactDivider: {
    width: 1,
    height: '60%',
  },
  syncStatusFooter: {
    marginTop: 8,
    paddingVertical: 4,
  },
  syncBanner: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  skeleton: {
    backgroundColor: '#E2E8F0',
  },
  primaryCtaCard: {
    padding: 16,
    borderWidth: 1.5,
  },
  secondaryCtaCard: {
    padding: 12,
  },
  ctaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  secondaryCtaHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ctaIconBg: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaButton: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  elderlyHelpCard: {
    padding: 12,
  },
  elderlyHelpHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
