import { networkInterfaces } from 'node:os';

import { NoTailnet } from './errors.js';

export interface NetworkAddress {
  readonly address: string;
  readonly internal: boolean;
}

export type NetworkInterfaces = Readonly<Record<string, readonly NetworkAddress[] | undefined>>;

const TAILNET_INTERFACE = /^tailscale/i;
const TAILNET_IPV6_PREFIX = 'fd7a:115c:a1e0:';

export function tailnetAddresses(interfaces: NetworkInterfaces = networkInterfaces()): string[] {
  const found = Object.entries(interfaces)
    .filter(([name]) => TAILNET_INTERFACE.test(name))
    .flatMap(([, addresses]) => addresses ?? [])
    .filter((address) => !address.internal && isTailnetAddress(address.address))
    .map((address) => address.address);

  if (found.length === 0) throw new NoTailnet();
  return found.sort(ipv4First);
}

function isTailnetAddress(address: string): boolean {
  return isCarrierGradeNat(address) || address.toLowerCase().startsWith(TAILNET_IPV6_PREFIX);
}

function isCarrierGradeNat(address: string): boolean {
  const octets = address.split('.');
  if (octets.length !== 4) return false;
  const [first, second] = octets.map(Number);
  if (first === undefined || second === undefined) return false;
  return first === 100 && second >= 64 && second <= 127;
}

function ipv4First(one: string, other: string): number {
  return Number(one.includes(':')) - Number(other.includes(':'));
}
