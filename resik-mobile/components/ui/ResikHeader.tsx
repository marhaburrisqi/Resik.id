import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { useResikTheme } from '../../hooks/use-theme-color';

interface ResikHeaderProps {
  title: string;
  subtitle?: string;
  rightElement?: React.ReactNode;
  style?: ViewStyle;
}

export function ResikHeader({ 
  title, 
  subtitle, 
  rightElement,
  style 
}: ResikHeaderProps) {
  const { colors, spacing, typography } = useResikTheme();

  return (
    <View style={[styles.container, { paddingVertical: spacing.lg }, style]}>
      <View style={styles.left}>
        <Text style={[styles.title, typography.heading, { color: colors.textPrimary }]}>
          {title}
        </Text>
        {subtitle && (
          <Text style={[styles.subtitle, typography.body, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {rightElement && (
        <View style={styles.right}>
          {rightElement}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  left: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
  },
  right: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
});
