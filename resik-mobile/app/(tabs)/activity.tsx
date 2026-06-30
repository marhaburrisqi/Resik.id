import React, { useMemo, useState } from 'react';
import { StyleSheet, View, ScrollView, Text, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRealtimeReports } from '../../hooks/use-realtime-reports';
import { useResikTheme } from '../../hooks/use-theme-color';
import { useOfflineSync } from '../../hooks/use-offline-sync';
import { ResikHeader } from '../../components/ui/ResikHeader';
import { ResikCard } from '../../components/ui/ResikCard';
import { ResikStatusChip } from '../../components/ui/ResikStatusChip';
import { ResikEmptyState } from '../../components/ui/ResikEmptyState';
import { ResikSection } from '../../components/ui/ResikSection';
import { ResikStatusTimeline } from '../../components/ui/ResikStatusTimeline';
import { ResikTransactionItem } from '../../components/ui/ResikTransactionItem';
import { router } from 'expo-router';

const FILTERS = ['Semua', 'Sedang Diproses', 'Sudah Diambil', 'Tabungan Poin'];

export default function ActivityCenterScreen() {
  const { reports, balance, loading, refreshData, loadMore, hasMore, error } = useRealtimeReports();
  const { colors, spacing, typography } = useResikTheme();
  const { pendingTasks } = useOfflineSync();
  const [activeFilter, setActiveFilter] = useState('Semua');

  // Filter reports that are active
  const activeReports = useMemo(() => 
    reports.filter(r => r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'rejected'),
  [reports]);

  // Filter reports that are completed
  const completedReports = useMemo(() => 
    reports.filter(r => r.status === 'completed'),
  [reports]);

  const stats = useMemo(() => ({
    active: activeReports.length,
    completed: completedReports.length,
  }), [activeReports, completedReports]);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <ScrollView 
        stickyHeaderIndices={[2]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={loading && reports.length === 0} onRefresh={refreshData} tintColor={colors.primary} />}
      >
        <View style={{ paddingHorizontal: 24 }}>
          <ResikHeader title="Aktivitas Anda" subtitle="Pantau tabungan sampah dan laporan Anda." />

          <View style={[styles.summaryRow, { gap: spacing.md }]}>
            <View style={[styles.summaryItem, { backgroundColor: colors.secondary + '40' }]}>
              <Text style={[typography.label, { color: colors.primary }]}>DIPROSES</Text>
              <Text style={[typography.heading, { color: colors.primary }]}>{stats.active}</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: colors.success + '15' }]}>
              <Text style={[typography.label, { color: colors.success }]}>DIAMBIL</Text>
              <Text style={[typography.heading, { color: colors.success }]}>{stats.completed}</Text>
            </View>
            <View style={[styles.summaryItem, { backgroundColor: colors.info + '15' }]}>
              <Text style={[typography.label, { color: colors.info }]}>POIN SAYA</Text>
              <Text style={[typography.heading, { color: colors.info }]}>{balance}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.filterBarWrapper, { backgroundColor: colors.background }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterBar}>
            {FILTERS.map(f => (
              <TouchableOpacity 
                key={f} 
                style={[
                  styles.filterChip, 
                  activeFilter === f && { backgroundColor: colors.primary, borderColor: colors.primary }
                ]}
                onPress={() => setActiveFilter(f)}
              >
                <Text style={[
                  typography.caption, 
                  { color: activeFilter === f ? '#FFFFFF' : colors.textSecondary, fontWeight: '700' }
                ]}>
                  {f}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={{ paddingHorizontal: 24, paddingTop: 16 }}>
          {error && (
            <View style={[styles.errorContainer, { borderColor: colors.danger + '40' }]}>
              <Text style={[typography.caption, { color: colors.danger, textAlign: 'center' }]}>
                {error}
              </Text>
            </View>
          )}

          {reports.length === 0 && !loading && (
            <ResikEmptyState 
              title="Belum ada aktivitas"
              description="Belum ada sampah yang Anda laporkan."
            />
          )}

          {(activeFilter === 'Semua' || activeFilter === 'Sedang Diproses') && activeReports.length > 0 && (
            <ResikSection title="Masih Menunggu Petugas">
              {activeReports.map((report) => {
                // Find the corresponding queue task to show sync status
                const queueTask = report.pendingSync
                  ? pendingTasks.find((t) => t.local_uuid === report.idempotency_key || t.id === report.id)
                  : undefined;

                const syncLabel = queueTask
                  ? queueTask.sync_status === 'syncing'
                    ? 'Sedang Sinkronisasi'
                    : queueTask.sync_status === 'failed'
                    ? 'Sinkronisasi Gagal'
                    : queueTask.sync_status === 'synced'
                    ? 'Tersinkron'
                    : 'Menunggu Sinkronisasi'
                  : null;

                const syncColor = queueTask
                  ? queueTask.sync_status === 'syncing'
                    ? colors.info
                    : queueTask.sync_status === 'failed'
                    ? colors.danger
                    : queueTask.sync_status === 'synced'
                    ? colors.success
                    : colors.warning
                  : undefined;

                return (
                  <TouchableOpacity
                    key={report.id}
                    activeOpacity={0.85}
                    onPress={() => router.push({ pathname: '/modal', params: { id: report.id } })}
                    style={styles.cardTouchable}
                  >
                    <ResikCard variant="elevated" style={styles.timelineCard}>
                      <View style={styles.timelineHeader}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                          <Text style={[typography.title, { color: colors.textPrimary, fontWeight: '800' }]}>
                            {report.trash_type}
                          </Text>
                          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]} numberOfLines={2}>
                            {report.address}
                          </Text>
                        </View>
                        <ResikStatusChip status={report.status} />
                      </View>
                      {syncLabel && (
                        <View style={[
                          styles.syncChip,
                          { backgroundColor: (syncColor ?? colors.warning) + '18', borderColor: (syncColor ?? colors.warning) + '40' }
                        ]}>
                          <View style={[styles.syncDot, { backgroundColor: syncColor ?? colors.warning }]} />
                          <Text style={[typography.caption, { color: syncColor ?? colors.warning, fontWeight: '700', fontSize: 11 }]}>
                            {syncLabel}
                          </Text>
                        </View>
                      )}
                      <ResikStatusTimeline currentStatus={report.status} style={{ marginTop: spacing.md }} />
                    </ResikCard>
                  </TouchableOpacity>
                );
              })}
            </ResikSection>
          )}

          {(activeFilter === 'Semua' || activeFilter === 'Tabungan Poin') && completedReports.length > 0 && (
            <ResikSection title="Catatan Penerimaan Poin">
              {completedReports.map(report => (
                <TouchableOpacity
                  key={`point_touch_${report.id}`}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/modal', params: { id: report.id } })}
                >
                  <ResikTransactionItem 
                    title="Tambahan Poin Sampah"
                    subtitle={report.trash_type}
                    amount={report.points_earned || 0}
                    type="earn"
                    date={new Date(report.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                  />
                </TouchableOpacity>
              ))}
            </ResikSection>
          )}

          {(activeFilter === 'Semua' || activeFilter === 'Sudah Diambil') && completedReports.length > 0 && (
            <ResikSection title="Laporan yang Sudah Selesai">
              {completedReports.map(report => (
                <TouchableOpacity
                  key={`comp_touch_${report.id}`}
                  activeOpacity={0.85}
                  onPress={() => router.push({ pathname: '/modal', params: { id: report.id } })}
                  style={styles.cardTouchable}
                >
                  <ResikCard variant="outlined" style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700' }]}>
                        {report.trash_type}
                      </Text>
                      <ResikStatusChip status="completed" />
                    </View>
                    <Text style={[typography.caption, { color: colors.textMuted }]}>
                      Selesai pada: {new Date(report.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </Text>
                  </ResikCard>
                </TouchableOpacity>
              ))}
            </ResikSection>
          )}

          {/* Pagination Trigger */}
          {hasMore && reports.length > 0 && (
            <TouchableOpacity 
              activeOpacity={0.8}
              style={[styles.loadMoreButton, { borderColor: colors.primary }]}
              onPress={loadMore}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[typography.label, { color: colors.primary, fontWeight: '700' }]}>
                  Muat Lebih Banyak Laporan
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
        
        <View style={{ height: 80 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  summaryRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  summaryItem: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    alignItems: 'center',
  },
  filterBarWrapper: {
    paddingVertical: 12,
  },
  filterBar: {
    paddingHorizontal: 24,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E9ECEF',
  },
  cardTouchable: {
    width: '100%',
    marginBottom: 16,
  },
  timelineCard: {
    padding: 24,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  historyCard: {
    padding: 16,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  errorContainer: {
    padding: 12,
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 16,
  },
  loadMoreButton: {
    padding: 16,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
    width: '100%',
  },
  syncChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    marginTop: 8,
    marginBottom: 4,
    gap: 6,
  },
  syncDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
