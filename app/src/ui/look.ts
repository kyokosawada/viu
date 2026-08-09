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
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
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
