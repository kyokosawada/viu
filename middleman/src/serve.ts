#!/usr/bin/env node
import { connectToHerdr, herdrSocketPath } from './herdr/socket.js';
import { portFrom, serveMiddleman, type Service } from './service.js';
import { exitCodeFor, startupLine } from './startup.js';
import { tailnetAddresses } from './tailnet.js';

const socketPath = herdrSocketPath();

process.stdout.write(`${startupLine()}\n`);

try {
  const service = await serveMiddleman({
    herdr: connectToHerdr(socketPath),
    addresses: tailnetAddresses(),
    port: portFrom(process.env.VIU_PORT),
  });

  process.stdout.write(`herdr ${service.herdr} through ${socketPath}\n`);
  process.stdout.write(`serving the fleet on ${service.urls.join(' and ')}\n`);

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      stop(service);
    });
  }
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  process.stderr.write(`the viu middleman is not starting: ${reason}\n`);
  process.exitCode = exitCodeFor(error);
}

function stop(service: Service): void {
  void service.close().then(() => {
    process.exit(0);
  });
}
