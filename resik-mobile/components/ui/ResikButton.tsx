import React from 'react';
import { 
  StyleSheet, 
  TouchableOpacity, 
  Text, 
  ActivityIndicator, 
  ViewStyle, 
  TextStyle,
  TouchableOpacityProps 
} from 'react-native';
import { useResikTheme } from '../../hooks/use-theme-color';

interface ResikButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function ResikButton({ 
  title, 
  variant = 'primary', 
  size = 'md',
  loading = false,
  disabled,
  style,
  ...props 
}: ResikButtonProps) {
  const { colors, spacing, radius, typography } = useResikTheme();

  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (variant) {
      case 'secondary':
        return {
          container: { backgroundColor: colors.secondary },
          text: { color: colors.primary },
        };
      case 'outline':
        return {
          container: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.primary },
          text: { color: colors.primary },
        };
      case 'danger':
        return {
          container: { backgroundColor: colors.danger },
          text: { color: '#FFFFFF' },
        };
      case 'primary':
      default:
        return {
          container: { backgroundColor: colors.primary },
          text: { color: '#FFFFFF' },
        };
    }
  };

  const getSizeStyles = (): ViewStyle => {
    switch (size) {
      case 'sm':
        return { height: 40, paddingHorizontal: spacing.md };
      case 'lg':
        return { height: 64, paddingHorizontal: spacing.xl };
      case 'md':
      default:
        return { height: 56, paddingHorizontal: spacing.lg };
    }
  };

  const { container: variantContainer, text: variantText } = getVariantStyles();
  const sizeStyles = getSizeStyles();

  return (
    <TouchableOpacity 
      style={[
        styles.base,
        { borderRadius: radius.pill },
        variantContainer,
        sizeStyles,
        (disabled || loading) && styles.disabled,
        style as ViewStyle,
      ]}
      disabled={disabled || loading}
      activeOpacity={0.8}
      {...props}
    >
      {loading ? (
        <ActivityIndicator color={variantText.color} />
      ) : (
        <Text style={[
          styles.text,
          typography.title,
          variantText,
          size === 'sm' && { fontSize: 14 },
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  text: {
    fontWeight: '700',
    textAlign: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});
