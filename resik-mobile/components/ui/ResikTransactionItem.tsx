import React from 'react';
import { StyleSheet, View, Text, ViewStyle } from 'react-native';
import { useResikTheme } from '../../hooks/use-theme-color';

interface ResikTransactionItemProps {
  title: string;
  subtitle: string;
  amount: number;
  type: 'earn' | 'spend';
  date: string;
  style?: ViewStyle;
}

export function ResikTransactionItem({ 
  title, 
  subtitle, 
  amount, 
  type = 'earn',
  date,
  style 
}: ResikTransactionItemProps) {
  const { colors, spacing, typography } = useResikTheme();

  return (
    <View style={[styles.container, { paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border }, style]}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{type === 'earn' ? '💰' : '🛍️'}</Text>
      </View>
      <View style={styles.content}>
        <Text style={[typography.body, { color: colors.textPrimary, fontWeight: '700' }]}>
          {title}
        </Text>
        <Text style={[typography.caption, { color: colors.textSecondary }]}>
          {subtitle} • {date}
        </Text>
      </View>
      <View style={styles.amountContainer}>
        <Text style={[
          typography.title, 
          { color: type === 'earn' ? colors.success : colors.textPrimary, fontWeight: '800' }
        ]}>
          {type === 'earn' ? '+' : '-'}{amount}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
});
