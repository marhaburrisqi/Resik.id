import { useColorScheme } from 'react-native';
import { Colors } from '../constants/theme';
import { theme, colors } from '../constants/theme/index';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const themeName = useColorScheme() ?? 'light';
  const colorFromProps = props[themeName];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return Colors[themeName][colorName];
  }
}

export function useResikTheme() {
  const scheme = useColorScheme();
  
  // Ensure we always have a valid key (default to light)
  const colorScheme = (scheme === 'dark' || scheme === 'light') ? scheme : 'light';
  
  // Get active color palette
  const activeColors = colors[colorScheme] || colors.light;

  return {
    ...theme,
    colors: activeColors,
    isDark: colorScheme === 'dark',
  };
}

