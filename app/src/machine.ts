export interface Machine {
  readonly host: string;
  readonly port: number;
}

export const DEFAULT_PORT = 8787;

export function machineFrom(host: string, port: string): Machine | null {
  const named = host.trim();
  if (named === '' || /\s/.test(named)) return null;

  const asked = port.trim();
  if (asked === '') return { host: named, port: DEFAULT_PORT };

  const numbered = Number(asked);
  if (!Number.isInteger(numbered) || numbered < 1 || numbered > 65535) return null;
  return { host: named, port: numbered };
}

export function addressOf(machine: Machine): string {
  const host = machine.host.includes(':') ? `[${machine.host}]` : machine.host;
  return `${host}:${machine.port}`;
}

export function urlOf(machine: Machine): string {
  return `http://${addressOf(machine)}`;
}
