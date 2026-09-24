import net from 'node:net';

export async function isPortAvailable(port, host = '127.0.0.1') {
  return await new Promise((resolve) => {
    const server = net.createServer();
    server.unref();

    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });

    server.listen(port, host);
  });
}

export async function findAvailablePort(startPort, host = '127.0.0.1', maxAttempts = 20) {
  const basePort = Number(startPort);

  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = basePort + offset;
    if (await isPortAvailable(candidate, host)) {
      return candidate;
    }
  }

  throw new Error(`No available port found starting from ${basePort} on ${host}`);
}
