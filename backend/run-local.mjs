// Boots an in-memory MongoDB, then starts the backend against it.
// Used for local runs on machines without a mongod binary.
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';

const mongod = await MongoMemoryServer.create({ instance: { port: 27017 } });
const uri = mongod.getUri();
console.log(`[run-local] in-memory MongoDB up at ${uri}`);

const child = spawn(process.execPath, ['src/server.js'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: { ...process.env, MONGODB_URI: uri },
});

const shutdown = async (code) => {
  await mongod.stop().catch(() => {});
  process.exit(code ?? 0);
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));
child.on('exit', (code) => shutdown(code ?? 1));
