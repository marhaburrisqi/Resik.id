import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, Text, ActivityIndicator, ScrollView, Image, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useResikTheme } from '../hooks/use-theme-color';
import { citizenApi } from '../lib/supabase/citizen';
import { TrashReport } from '../types/citizen';
import { CreateReportPayload } from '../types/offline';
import { ResikStatusChip } from '../components/ui/ResikStatusChip';
import { ResikStatusTimeline } from '../components/ui/ResikStatusTimeline';
import { ResikButton } from '../components/ui/ResikButton';
import { Ionicons } from '@expo/vector-icons';
import { logger } from '../utils/logger';
import { offlineQueue } from '../utils/offline-queue';

export default function ModalScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, typography, radius } = useResikTheme();
  
  const [report, setReport] = useState<TrashReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = useCallback(async () => {
    if (!id) {
      setError('ID laporan tidak valid.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Check if it's a pending offline draft task starting with 'resik_sync'
      if (id.startsWith('resik_sync')) {
        const tasks = await offlineQueue.getTasks();
        const task = tasks.find(t => t.id === id);
        if (task) {
          // Modal only reads CREATE_REPORT tasks — cast to the correct payload type
          const p = task.payload as CreateReportPayload;
          const mappedReport: TrashReport = {
            id: task.id,
            idempotency_key: task.id,
            citizen_id: 'local',
            trash_type: p.trash_type,
            estimated_weight: p.estimated_weight,
            location_lat: p.location_lat,
            location_lng: p.location_lng,
            accuracy: p.accuracy,
            loc_timestamp: p.loc_timestamp,
            address: p.address || 'Alamat akan dilengkapi saat internet tersedia',
            photo_url: p.photo_url,
            status: 'pending',
            created_at: task.created_at,
            updated_at: task.created_at,
            report_type: p.report_type ?? 'trash',
            description: p.description,
            pendingSync: true,
          };
          setReport(mappedReport);
          setLoading(false);
          return;
        }
      }

      // 2. Otherwise fetch from live Supabase instance
      const data = await citizenApi.getReportById(id);
      setReport(data);
    } catch (err: any) {
      logger.error('Failed to load report detail in modal screen', err);
      setError('Gagal memuat detail laporan. Periksa koneksi internet Anda.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[typography.caption, { color: colors.textSecondary, marginTop: 12 }]}>
          Memuat detail laporan...
        </Text>
      </View>
    );
  }

  if (error || !report) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, padding: 24 }]}>
        <Ionicons name="alert-circle-outline" size={64} color={colors.danger} />
        <Text style={[typography.title, { color: colors.textPrimary, marginTop: 16, textAlign: 'center' }]}>
          {error || 'Laporan tidak ditemukan'}
        </Text>
        <ResikButton 
          title="Coba Lagi" 
          onPress={fetchReport} 
          style={{ marginTop: 24, paddingHorizontal: 32 }} 
        />
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={[typography.body, { color: colors.primary, fontWeight: '700' }]}>Kembali</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const createdDate = new Date(report.created_at).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Photo Header */}
      <View style={[styles.imageContainer, { borderRadius: radius.lg, backgroundColor: colors.border }]}>
        {report.photo_url ? (
          <Image source={{ uri: report.photo_url }} style={styles.image} resizeMode="cover" />
        ) : (
          <View style={styles.noImage}>
            <Ionicons name="image-outline" size={48} color={colors.textMuted} />
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>
              Tidak ada foto bukti
            </Text>
          </View>
        )}
        {report.pendingSync && (
          <View style={[styles.offlineBadge, { backgroundColor: colors.warning }]}>
            <Ionicons name="cloud-offline-outline" size={14} color="#FFFFFF" style={{ marginRight: 4 }} />
            <Text style={styles.offlineText}>Menunggu Sinkronisasi</Text>
          </View>
        )}
      </View>

      {/* Main Details Card */}
      <View style={[styles.detailsCard, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: radius.lg }]}>
        <View style={styles.headerRow}>
          <View>
            <Text style={[typography.heading, { color: colors.textPrimary, fontWeight: '800' }]}>
              {report.trash_type}
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}>
              Kode: {report.tracking_id || 'PROSES-SYNC'}
            </Text>
          </View>
          <ResikStatusChip status={report.status} />
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Status Timeline */}
        <Text style={[typography.label, { color: colors.textSecondary, marginBottom: 12 }]}>
          Status Terakhir Laporan
        </Text>
        <ResikStatusTimeline currentStatus={report.status} />

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Metadata Details */}
        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Jenis Laporan</Text>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
              {report.report_type === 'illegal' ? 'Sampah Liar ⚠️' : 'Setoran Sampah ♻️'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Tanggal Laporan</Text>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
              {createdDate}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Taksiran Berat</Text>
            <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700', marginTop: 2 }]}>
              {report.estimated_weight} Kg
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>Poin Diperoleh</Text>
            <Text style={[typography.body, { color: colors.success, fontWeight: '800', marginTop: 2 }]}>
              {report.points_earned || 0} Poin
            </Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Address and Description */}
        <View style={styles.sectionBlock}>
          <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>Alamat Penjemputan</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{report.address}</Text>
        </View>

        {report.description && (
          <View style={[styles.sectionBlock, { marginTop: 12 }]}>
            <Text style={[typography.caption, { color: colors.textMuted, marginBottom: 4 }]}>Catatan Tambahan</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>{report.description}</Text>
          </View>
        )}

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* GPS Coordinates Validation */}
        <View style={styles.gpsRow}>
          <Ionicons name="location-outline" size={20} color={colors.primary} />
          <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={[typography.caption, { color: colors.textSecondary, fontWeight: '700' }]}>
              Koordinat GPS (Akurasi: {report.accuracy.toFixed(1)}m)
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 1 }]}>
              Lat: {report.location_lat.toFixed(5)}, Lng: {report.location_lng.toFixed(5)}
            </Text>
          </View>
        </View>
      </View>

      <ResikButton 
        title="Tutup Halaman" 
        onPress={() => router.back()} 
        style={{ marginTop: 24, marginBottom: 40 }} 
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageContainer: {
    width: '100%',
    height: 220,
    overflow: 'hidden',
    marginBottom: 20,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  noImage: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  offlineText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  detailsCard: {
    padding: 20,
    borderWidth: 1,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  divider: {
    height: 1,
    marginVertical: 16,
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  metaItem: {
    width: '45%',
  },
  sectionBlock: {
    width: '100%',
  },
  gpsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
