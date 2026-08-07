import { PROTOCOL_VERSION } from '@viu/protocol';

export function startupLine(): string {
  return `viu middleman - protocol v${PROTOCOL_VERSION} - node ${process.versions.node}`;
}
