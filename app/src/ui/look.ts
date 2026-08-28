import { StyleSheet, useColorScheme, type ColorSchemeName } from 'react-native';

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  block: 8,
  card: 12,
  pill: 999,
} as const;

export const text = {
  title: { fontSize: 28, lineHeight: 34, fontWeight: '600' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  reading: { fontSize: 16, lineHeight: 26, fontWeight: '400' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  label: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  terminal: { fontSize: 13, lineHeight: 20, fontWeight: '400', fontFamily: 'monospace' },
} as const;

export interface Colours {
  readonly paper: string;
  readonly raised: string;
  readonly sunken: string;
  readonly line: string;
  readonly ink: string;
  readonly muted: string;
  readonly accent: string;
  readonly stateNeedsYou: string;
  readonly stateThinking: string;
  readonly stateIdle: string;
  readonly stateBad: string;
}

const BY_DAY: Colours = {
  paper: '#fbfbfa',
  raised: '#ffffff',
  sunken: '#f0f1f3',
  line: '#e3e5e9',
  ink: '#16181d',
  muted: '#666b76',
  accent: '#4c5fd7',
  stateNeedsYou: '#b0710f',
  stateThinking: '#2f7a52',
  stateIdle: '#666b76',
  stateBad: '#c0392b',
};

const BY_NIGHT: Colours = {
  paper: '#131417',
  raised: '#1b1d21',
  sunken: '#0e0f12',
  line: '#2a2d33',
  ink: '#eceef2',
  muted: '#9aa1ad',
  accent: '#8a9bf0',
  stateNeedsYou: '#e8b45c',
  stateThinking: '#5fce8d',
  stateIdle: '#9aa1ad',
  stateBad: '#ff6b6b',
};

export interface Look {
  readonly colour: Colours;
  readonly look: Sheet;
}

type Sheet = ReturnType<typeof sheetFor>;

const BY_SCHEME = {
  light: { colour: BY_DAY, look: sheetFor(BY_DAY) },
  dark: { colour: BY_NIGHT, look: sheetFor(BY_NIGHT) },
} satisfies Record<'light' | 'dark', Look>;

export function lookFor(scheme: ColorSchemeName | null | undefined): Look {
  return scheme === 'light' ? BY_SCHEME.light : BY_SCHEME.dark;
}

export function useLook(): Look {
  return lookFor(useColorScheme());
}

function sheetFor(colour: Colours) {
  return StyleSheet.create({
    page: {
      backgroundColor: colour.paper,
    },
    fill: {
      flex: 1,
    },
    screen: {
      flexGrow: 1,
      backgroundColor: colour.paper,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxl,
      justifyContent: 'center',
      gap: spacing.xl,
    },
    title: {
      color: colour.ink,
      ...text.title,
    },
    heading: {
      color: colour.ink,
      ...text.heading,
      flexShrink: 1,
    },
    headline: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    lamp: {
      width: spacing.md,
      height: spacing.md,
      borderRadius: radius.pill,
    },
    said: {
      color: colour.muted,
      ...text.body,
    },
    advice: {
      color: colour.ink,
      ...text.body,
    },
    address: {
      color: colour.ink,
      ...text.reading,
      fontVariant: ['tabular-nums'],
    },
    card: {
      backgroundColor: colour.raised,
      borderColor: colour.line,
      borderWidth: 1,
      borderRadius: radius.card,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    field: {
      backgroundColor: colour.raised,
      borderColor: colour.line,
      borderWidth: 1,
      borderRadius: radius.block,
      color: colour.ink,
      ...text.reading,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    label: {
      color: colour.muted,
      ...text.label,
      marginBottom: spacing.xs,
    },
    button: {
      backgroundColor: colour.accent,
      borderRadius: radius.block,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    buttonText: {
      color: '#ffffff',
      ...text.body,
      fontWeight: '600',
    },
    fromTheTop: {
      justifyContent: 'flex-start',
    },
    list: {
      flexGrow: 1,
      gap: spacing.md,
      paddingVertical: spacing.xs,
    },
    state: {
      ...text.label,
    },
    turn: {
      maxWidth: '92%',
      gap: spacing.sm,
    },
    fromTheAgent: {
      alignSelf: 'flex-start',
      borderLeftColor: colour.stateThinking,
      borderLeftWidth: 3,
    },
    fromYou: {
      alignSelf: 'flex-end',
      backgroundColor: colour.sunken,
      borderColor: colour.accent,
    },
    fromThePane: {
      alignSelf: 'stretch',
      maxWidth: '100%',
    },
    who: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    spoken: {
      color: colour.ink,
      ...text.reading,
    },
    raw: {
      color: colour.ink,
      ...text.terminal,
    },
    cut: {
      color: colour.stateNeedsYou,
      ...text.label,
    },
    slab: {
      alignSelf: 'stretch',
      gap: spacing.md,
    },
    bar: {
      alignSelf: 'stretch',
      backgroundColor: colour.accent,
      borderRadius: radius.pill,
      paddingVertical: spacing.xl,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
      gap: spacing.xs,
    },
    listening: {
      backgroundColor: colour.stateNeedsYou,
    },
    barText: {
      color: '#ffffff',
      ...text.reading,
      fontWeight: '600',
    },
    draft: {
      alignSelf: 'stretch',
      gap: spacing.md,
    },
    beside: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    half: {
      flex: 1,
    },
    discard: {
      backgroundColor: 'transparent',
      borderColor: colour.line,
      borderWidth: 1,
    },
    discardText: {
      color: colour.muted,
      ...text.body,
      fontWeight: '600',
    },
    keys: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    key: {
      minWidth: spacing.xxl + spacing.xl,
      borderRadius: radius.block,
      backgroundColor: colour.raised,
      borderColor: colour.line,
      borderWidth: 1,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    keyText: {
      color: colour.ink,
      ...text.reading,
      fontWeight: '600',
    },
    apart: {
      flex: 1,
    },
    stop: {
      backgroundColor: colour.stateBad,
      borderColor: colour.stateBad,
    },
    stopText: {
      color: colour.paper,
      ...text.reading,
      fontWeight: '700',
    },
    warning: {
      color: colour.stateNeedsYou,
      ...text.body,
    },
    calling: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colour.raised,
      borderColor: colour.stateNeedsYou,
      borderWidth: 1,
      borderRadius: radius.card,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    callingText: {
      color: colour.ink,
      ...text.body,
      fontWeight: '600',
    },
    attach: {
      alignSelf: 'stretch',
      backgroundColor: colour.raised,
      borderColor: colour.line,
      borderWidth: 1,
      borderRadius: radius.block,
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },
    attachText: {
      color: colour.ink,
      ...text.reading,
      fontWeight: '600',
    },
    attached: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    tag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colour.sunken,
      borderColor: colour.accent,
      borderWidth: 1,
      borderRadius: radius.block,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
    },
    tagText: {
      color: colour.ink,
      ...text.terminal,
    },
    tagDrop: {
      color: colour.muted,
      ...text.body,
      fontWeight: '700',
    },
    quiet: {
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    quietText: {
      color: colour.muted,
      ...text.body,
    },
    rows: {
      backgroundColor: colour.raised,
      borderColor: colour.line,
      borderWidth: 1,
      borderRadius: radius.card,
      overflow: 'hidden',
    },
    row: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    ruled: {
      borderTopColor: colour.line,
      borderTopWidth: 1,
    },
    between: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
    },
    bench: {
      backgroundColor: colour.raised,
      borderColor: colour.line,
      borderWidth: 1,
      borderRadius: radius.card,
      padding: spacing.lg,
      gap: spacing.md,
    },
    troubled: {
      borderLeftColor: colour.stateBad,
      borderLeftWidth: 3,
    },
    hint: {
      color: colour.muted,
      ...text.body,
      marginTop: spacing.xs,
    },
    wrong: {
      color: colour.stateBad,
    },
  });
}
