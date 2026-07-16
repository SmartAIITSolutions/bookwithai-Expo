// Book With AI — Customer App
// Shadows — soft only, no heavy elevation

import { Platform } from 'react-native';

export const Shadows = {
  card: Platform.select({
    ios: {
      shadowColor: 'rgba(34, 34, 34, 1)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 20,
    },
    android: {
      elevation: 3,
    },
  }),

  subtle: Platform.select({
    ios: {
      shadowColor: 'rgba(34, 34, 34, 1)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.05,
      shadowRadius: 8,
    },
    android: {
      elevation: 1,
    },
  }),

  button: Platform.select({
    ios: {
      shadowColor: '#5B2EFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    },
    android: {
      elevation: 4,
    },
  }),
} as const;
