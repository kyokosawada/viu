import { lookFor, type Colours } from './look';

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

const EVERY_ROLE = Object.keys(BY_NIGHT) as (keyof Colours)[];

describe('the theme a colour scheme resolves to', () => {
  test('is the light token set when the phone asks for light', () => {
    expect(lookFor('light').colour).toEqual(BY_DAY);
  });

  test('is the dark token set when the phone asks for dark', () => {
    expect(lookFor('dark').colour).toEqual(BY_NIGHT);
  });

  test('is the dark token set when the phone asks for neither, because dark is the default', () => {
    expect(lookFor('unspecified').colour).toEqual(BY_NIGHT);
    expect(lookFor(null).colour).toEqual(BY_NIGHT);
  });

  test('carries every semantic role, whichever scheme was asked for', () => {
    for (const role of EVERY_ROLE) {
      expect(lookFor('light').colour[role]).toMatch(/^#[0-9a-f]{6}$/);
      expect(lookFor('dark').colour[role]).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

});
