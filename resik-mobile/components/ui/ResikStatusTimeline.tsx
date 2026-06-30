import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { useResikTheme } from '../../hooks/use-theme-color';
import { ResikStatus } from './ResikStatusChip';

interface ResikStatusTimelineProps {
  currentStatus: ResikStatus;
  style?: ViewStyle;
}

const STEPS = [
  { key: 'pending', label: 'Diterima' },
  { key: 'verified', label: 'Diverifikasi' },
  { key: 'scheduled', label: 'Dijadwalkan' },
  { key: 'picked_up', label: 'Diambil' },
  { key: 'completed', label: 'Selesai' },
];

export function ResikStatusTimeline({ 
  currentStatus, 
  style 
}: ResikStatusTimelineProps) {
  const { colors, typography } = useResikTheme();

  const getCurrentStepIndex = () => {
    return STEPS.findIndex(s => s.key === currentStatus);
  };

  const currentIndex = getCurrentStepIndex();

  return (
    <View style={[styles.container, style]}>
      {STEPS.map((step, index) => {
        const isCompleted = index < currentIndex;
        const isCurrent = index === currentIndex;
        const isLast = index === STEPS.length - 1;

        return (
          <View key={step.key} style={styles.stepContainer}>
            <View style={styles.leftColumn}>
              <View style={[
                styles.dot,
                { backgroundColor: isCompleted || isCurrent ? colors.primary : colors.border }
              ]} />
              {!isLast && (
                <View style={[
                  styles.line,
                  { backgroundColor: isCompleted ? colors.primary : colors.border }
                ]} />
              )}
            </View>
            <View style={[styles.content, { paddingBottom: isLast ? 0 : 8 }]}>
              <Text style={[
                typography.caption,
                { color: isCurrent ? colors.textPrimary : colors.textMuted, fontWeight: isCurrent ? '700' : '500', fontSize: 13 }
              ]}>
                {step.label}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingLeft: 8,
  },
  stepContainer: {
    flexDirection: 'row',
  },
  leftColumn: {
    alignItems: 'center',
    marginRight: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    zIndex: 2,
    marginTop: 4,
  },
  line: {
    width: 2,
    flex: 1,
    marginVertical: -2,
    zIndex: 1,
  },
  content: {
    flex: 1,
  },
});
