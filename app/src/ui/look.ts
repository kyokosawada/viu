import { StyleSheet } from 'react-native';

export const colour = {
  ground: '#0e1116',
  raised: '#161b22',
  edge: '#272e38',
  ink: '#e7edf5',
  faded: '#8b98a8',
  good: '#4ec97a',
  wants: '#f2a33c',
  bad: '#ff6b6b',
  act: '#2f6feb',
  mine: '#17305c',
} as const;

export const look = StyleSheet.create({
  page: {
    backgroundColor: colour.ground,
  },
  fill: {
    flex: 1,
  },
  screen: {
    flexGrow: 1,
    backgroundColor: colour.ground,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'center',
    gap: 24,
  },
  title: {
    color: colour.ink,
    fontSize: 28,
    fontWeight: '600',
  },
  heading: {
    color: colour.ink,
    fontSize: 20,
    fontWeight: '600',
    flexShrink: 1,
  },
  headline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  lamp: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  said: {
    color: colour.faded,
    fontSize: 15,
    lineHeight: 22,
  },
  advice: {
    color: colour.ink,
    fontSize: 15,
    lineHeight: 22,
  },
  address: {
    color: colour.ink,
    fontSize: 16,
    fontVariant: ['tabular-nums'],
  },
  card: {
    backgroundColor: colour.raised,
    borderColor: colour.edge,
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  field: {
    backgroundColor: colour.raised,
    borderColor: colour.edge,
    borderWidth: 1,
    borderRadius: 12,
    color: colour.ink,
    fontSize: 17,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    color: colour.faded,
    fontSize: 13,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  button: {
    backgroundColor: colour.act,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 17,
    fontWeight: '600',
  },
  fromTheTop: {
    justifyContent: 'flex-start',
  },
  list: {
    flexGrow: 1,
    gap: 12,
    paddingVertical: 4,
  },
  state: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.4,
  },
  turn: {
    maxWidth: '92%',
    gap: 6,
  },
  fromTheAgent: {
    alignSelf: 'flex-start',
    borderLeftColor: colour.good,
    borderLeftWidth: 3,
  },
  fromYou: {
    alignSelf: 'flex-end',
    backgroundColor: colour.mine,
    borderColor: colour.act,
  },
  fromThePane: {
    alignSelf: 'stretch',
    maxWidth: '100%',
  },
  who: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  spoken: {
    color: colour.ink,
    fontSize: 16,
    lineHeight: 24,
  },
  raw: {
    color: colour.ink,
    fontFamily: 'monospace',
    fontSize: 13,
    lineHeight: 19,
  },
  cut: {
    color: colour.wants,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  slab: {
    alignSelf: 'stretch',
    gap: 12,
  },
  bar: {
    alignSelf: 'stretch',
    backgroundColor: colour.act,
    borderRadius: 16,
    paddingVertical: 22,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 6,
  },
  listening: {
    backgroundColor: colour.wants,
  },
  barText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  draft: {
    alignSelf: 'stretch',
    gap: 12,
  },
  beside: {
    flexDirection: 'row',
    gap: 12,
  },
  half: {
    flex: 1,
  },
  discard: {
    backgroundColor: 'transparent',
    borderColor: colour.edge,
    borderWidth: 1,
  },
  discardText: {
    color: colour.faded,
    fontSize: 17,
    fontWeight: '600',
  },
  keys: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  key: {
    minWidth: 52,
    borderRadius: 12,
    backgroundColor: colour.raised,
    borderColor: colour.edge,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  keyText: {
    color: colour.ink,
    fontSize: 16,
    fontWeight: '600',
  },
  apart: {
    flex: 1,
  },
  stop: {
    backgroundColor: colour.bad,
    borderColor: colour.bad,
  },
  stopText: {
    color: colour.ground,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  warning: {
    color: colour.wants,
    fontSize: 15,
    lineHeight: 22,
  },
  calling: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colour.raised,
    borderColor: colour.wants,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  callingText: {
    color: colour.ink,
    fontSize: 15,
    fontWeight: '600',
  },
  quiet: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  quietText: {
    color: colour.faded,
    fontSize: 15,
  },
});
