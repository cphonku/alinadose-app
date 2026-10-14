import type { CyclePhase } from '../domain/cycle';

/** Palette taken from the U Copenhagen iGEM 2026 wiki and the team logo. */
export const colors = {
  background: '#FFF8EF',
  surface: '#FFFFFF',
  wheat: '#FCE1B8',
  wheatSoft: '#FEF0DB',
  sand: '#FFB473',
  coral: '#FF855C',
  coralDim: '#C85E3A',
  orange: '#EE8A33', // logo
  petal: '#B86AAF',
  petalDim: '#7A3F73',
  teal: '#2C918B',
  tealDim: '#1E6B67',
  lime: '#AAE89B',
  ink: '#21100A',
  inkMid: '#55301C',
  inkSoft: '#8A5840',
  border: 'rgba(180, 110, 50, 0.22)',
  shadow: 'rgba(85, 48, 28, 0.12)',
  danger: '#C0392B',
} as const;

/** One colour per data series, used consistently in every chart. */
export const series = {
  progesterone: colors.teal,
  symptoms: colors.coral,
  medication: colors.petal,
} as const;

export const phaseColors: Record<CyclePhase | 'menstruation', string> = {
  menstruation: colors.coral,
  follicular: '#8FD07E',
  ovulatory: colors.sand,
  luteal: colors.petal,
};

export const phaseLabels: Record<CyclePhase, string> = {
  follicular: 'Follicular phase',
  ovulatory: 'Ovulation',
  luteal: 'Luteal phase',
};

export const fonts = {
  display: 'PlayfairDisplay_700Bold',
  displayItalic: 'PlayfairDisplay_400Regular_Italic',
  body: 'DMSans_400Regular',
  bodyMedium: 'DMSans_500Medium',
  bodyBold: 'DMSans_700Bold',
} as const;

/** On web (preview/projector) the app is shown in a phone-width column. */
export const MAX_APP_WIDTH = 430;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24, pill: 999 } as const;

export const shadow = {
  shadowColor: colors.inkMid,
  shadowOpacity: 0.1,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 4 },
  elevation: 3,
} as const;
