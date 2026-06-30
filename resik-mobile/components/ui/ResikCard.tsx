import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { useResikTheme } from '../../hooks/use-theme-color';

interface ResikCardProps extends ViewProps {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export function ResikCard({ 
  children, 
  variant = 'default', 
  padding = 'md',
  style, 
  ...props 
}: ResikCardProps) {
  const { colors, spacing, radius, shadows } = useResikTheme();

  const cardStyles = [
    styles.base,
    {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: padding === 'none' ? 0 : spacing[padding],
    },
    variant === 'elevated' ? shadows.small : undefined,
    variant === 'outlined' ? { borderWidth: 1, borderColor: colors.border } : undefined,
    style,
  ];

  return (
    <View style={cardStyles} {...props}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    width: '100%',
    overflow: 'hidden',
  },
});
