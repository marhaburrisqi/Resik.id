import React from 'react';
import { StyleSheet, Text, ViewStyle } from 'react-native';
import { useResikTheme } from '../../hooks/use-theme-color';
import { ResikCard } from './ResikCard';

interface ResikStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  variant?: 'primary' | 'secondary' | 'surface';
  style?: ViewStyle;
}

export function ResikStatCard({ 
  title, 
  value, 
  subtitle,
  variant = 'surface',
  style 
}: ResikStatCardProps) {
  const { colors, typography } = useResikTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'primary': return { bg: colors.primary, title: colors.secondary, value: '#FFFFFF', subtitle: colors.secondary };
      case 'secondary': return { bg: colors.secondary, title: colors.primary, value: colors.primary, subtitle: colors.primary };
      case 'surface':
      default:
        return { bg: colors.surface, title: colors.textSecondary, value: colors.textPrimary, subtitle: colors.textMuted };
    }
  };

  const v = getVariantStyles();

  return (
    <ResikCard style={[style, { backgroundColor: v.bg }]} variant={variant === 'surface' ? 'elevated' : 'default'}>
      <Text style={[styles.title, typography.label, { color: v.title }]}>
        {title}
      </Text>
      <Text style={[styles.value, typography.display, { color: v.value }]}>
        {value}
      </Text>
      {subtitle && (
        <Text style={[styles.subtitle, typography.caption, { color: v.subtitle }]}>
          {subtitle}
        </Text>
      )}
    </ResikCard>
  );
}

const styles = StyleSheet.create({
  title: {
    marginBottom: 4,
  },
  value: {
    marginBottom: 4,
  },
  subtitle: {
    fontWeight: '700',
  },
});
