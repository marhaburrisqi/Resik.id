import React from 'react';
import { StyleSheet, View, Text, ViewStyle, TouchableOpacity } from 'react-native';
import { useResikTheme } from '../../hooks/use-theme-color';

interface ResikSectionProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

export function ResikSection({ 
  title, 
  actionLabel, 
  onAction,
  children,
  style 
}: ResikSectionProps) {
  const { colors, spacing, typography } = useResikTheme();

  return (
    <View style={[styles.container, { marginBottom: spacing.lg }, style]}>
      <View style={[styles.header, { marginBottom: spacing.md }]}>
        <Text style={[styles.title, typography.title, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction}>
            <Text style={[styles.action, typography.caption, { color: colors.primary }]}>
              {actionLabel}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontWeight: '700',
  },
  action: {
    fontWeight: '700',
  },
});
