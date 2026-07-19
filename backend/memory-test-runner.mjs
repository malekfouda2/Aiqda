import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { readdirSync } from 'node:fs';

const mongod = await MongoMemoryServer.create();
const uri = mongod.getUri();
console.log(`[memory-runner] mongod up at ${uri}`);

const args = process.argv.slice(2);
const testGlob = args.length > 0
  ? args
  : readdirSync('tests')
      .filter((f) => f.endsWith('.test.js'))
      .map((f) => `tests/${f}`)
      .sort();

const child = spawn(
  process.execPath,
  ['--test', '--test-concurrency=1', ...testGlob],
  {
    cwd: process.cwd(),
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'test', TEST_MONGODB_URI: uri },
  }
);

const shutdown = async (code) => {
  await mongod.stop();
  process.exit(code);
};

child.on('exit', (code) => shutdown(code ?? 1));
child.on('error', async (err) => {
  console.error('[memory-runner] failed to spawn tests:', err);
  await shutdown(1);
});
