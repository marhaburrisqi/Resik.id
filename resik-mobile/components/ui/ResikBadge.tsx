import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { useResikTheme } from '../../hooks/use-theme-color';

interface ResikBadgeProps {
  label: string;
  variant?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted';
  style?: ViewStyle;
}

export function ResikBadge({ 
  label, 
  variant = 'primary', 
  style 
}: ResikBadgeProps) {
  const { colors, spacing, radius, typography } = useResikTheme();

  const getVariantStyles = () => {
    switch (variant) {
      case 'success': return { bg: colors.success + '20', text: colors.success };
      case 'warning': return { bg: colors.warning + '20', text: colors.warning };
      case 'danger': return { bg: colors.danger + '20', text: colors.danger };
      case 'info': return { bg: colors.info + '20', text: colors.info };
      case 'muted': return { bg: colors.textMuted + '20', text: colors.textMuted };
      case 'primary':
      default:
        return { bg: colors.primary + '20', text: colors.primary };
    }
  };

  const { bg, text } = getVariantStyles();

  return (
    <View style={[
      styles.base, 
      { backgroundColor: bg, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
      style
    ]}>
      <Text style={[styles.text, typography.label, { color: text }]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  text: {
    fontSize: 10,
    fontWeight: '800',
  },
});
