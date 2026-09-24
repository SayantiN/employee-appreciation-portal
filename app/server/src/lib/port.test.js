import test from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';

import { findAvailablePort } from './port.js';

test('findAvailablePort skips ports already in use', async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const port = server.address().port;
  const nextPort = await findAvailablePort(port, '127.0.0.1');

  assert.notEqual(nextPort, port);
  await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
});
