import { colors } from './colors';
import { spacing } from './spacing';
import { radius } from './radius';
import { typography } from './typography';
import { shadows } from './shadows';

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
};

export type Theme = typeof theme;
export { colors, spacing, radius, typography, shadows };
