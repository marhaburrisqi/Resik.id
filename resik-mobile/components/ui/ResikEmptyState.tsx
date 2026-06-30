import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { useResikTheme } from '../../hooks/use-theme-color';
import { ResikButton } from './ResikButton';
import { Ionicons } from '@expo/vector-icons';

interface ResikEmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function ResikEmptyState({ 
  icon = 'leaf-outline',
  title, 
  description,
  actionLabel,
  onAction,
  style 
}: ResikEmptyStateProps) {
  const { colors, typography } = useResikTheme();

  return (
    <View style={[styles.container, style]}>
      <Ionicons name={icon as any} size={64} color={colors.textMuted} style={styles.icon} />
      <Text style={[styles.title, typography.heading, { color: colors.textPrimary }]}>
        {title}
      </Text>
      <Text style={[styles.description, typography.body, { color: colors.textSecondary }]}>
        {description}
      </Text>
      {actionLabel && onAction && (
        <ResikButton 
          title={actionLabel} 
          onPress={onAction} 
          style={styles.button}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    textAlign: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  description: {
    textAlign: 'center',
    marginBottom: 32,
  },
  button: {
    minWidth: 200,
  },
});
