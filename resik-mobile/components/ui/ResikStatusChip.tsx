import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { useResikTheme } from '../../hooks/use-theme-color';

export type ResikStatus = 'pending' | 'verified' | 'scheduled' | 'picked_up' | 'completed' | 'cancelled' | 'rejected';

interface ResikStatusChipProps {
  status: ResikStatus;
  style?: ViewStyle;
}

export function ResikStatusChip({ 
  status, 
  style 
}: ResikStatusChipProps) {
  const { colors, spacing, radius, typography } = useResikTheme();

  const getStatusConfig = () => {
    switch (status) {
      case 'verified':
        return { label: 'Diverifikasi', color: colors.info, icon: '✅' };
      case 'scheduled':
        return { label: 'Dijadwalkan', color: colors.info, icon: '📅' };
      case 'picked_up':
        return { label: 'Dalam Perjalanan', color: colors.warning, icon: '🚚' };
      case 'completed':
        return { label: 'Selesai', color: colors.success, icon: '🎉' };
      case 'cancelled':
        return { label: 'Dibatalkan', color: colors.danger, icon: '❌' };
      case 'rejected':
        return { label: 'Ditolak', color: colors.danger, icon: '🚫' };
      case 'pending':
      default:
        return { label: 'Laporan Diterima', color: colors.textSecondary, icon: '⏳' };
    }
  };


  const { label, color, icon } = getStatusConfig();

  return (
    <View style={[
      styles.base, 
      { backgroundColor: color + '15', borderRadius: radius.pill, paddingHorizontal: spacing.md },
      style
    ]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.text, typography.label, { color }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  icon: {
    fontSize: 12,
    marginRight: 6,
  },
  text: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
});
