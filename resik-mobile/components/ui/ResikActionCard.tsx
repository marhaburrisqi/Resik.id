import React from 'react';
import { StyleSheet, TouchableOpacity, Text, ViewStyle } from 'react-native';
import { useResikTheme } from '../../hooks/use-theme-color';
import { ResikCard } from './ResikCard';
import { Ionicons } from '@expo/vector-icons';

interface ResikActionCardProps {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  style?: ViewStyle;
}

export function ResikActionCard({ 
  title, 
  subtitle, 
  icon, 
  onPress,
  style 
}: ResikActionCardProps) {
  const { colors, typography } = useResikTheme();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={style}>
      <ResikCard variant="elevated" style={styles.card}>
        <Ionicons name={icon as any} size={36} color={colors.primary} style={{ marginBottom: 12 }} />
        <Text style={[styles.title, typography.title, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text style={[styles.subtitle, typography.caption, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      </ResikCard>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 4,
    fontWeight: '700',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: 12,
  },
});
