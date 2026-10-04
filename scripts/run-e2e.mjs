import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const admin = args.some((arg) => arg.includes('playwright.admin.config.ts'));
const port = admin ? 3105 : 3100;
const origin = `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  APP_ORIGIN: origin,
  DATABASE_PATH: admin
    ? join(tmpdir(), `student-admin-${randomUUID()}.sqlite`)
    : join(tmpdir(), 'student-browser-acceptance.sqlite'),
  E2E_EXTERNAL_SERVER: '1',
};
if (admin) {
  env.ADMIN_E2E_DB_PATH = env.DATABASE_PATH;
  env.ADMIN_EMAIL = 'browser-admin@example.com';
}

async function isReady() {
  try {
    return (await fetch(origin)).ok;
  } catch {
    return false;
  }
}

function run(command, commandArgs) {
  const child = spawn(process.execPath, [command, ...commandArgs], {
    env,
    stdio: 'inherit',
    windowsHide: true,
  });
  const done = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
  });
  return { child, done };
}

let server;
try {
  if (!(await isReady())) {
    server = run('node_modules/next/dist/bin/next', [
      'start', '--hostname', '127.0.0.1', '--port', String(port),
    ]);
    const deadline = Date.now() + 120_000;
    while (!(await isReady())) {
      if (server.child.exitCode !== null) throw new Error('Next.js server exited before it was ready.');
      if (Date.now() >= deadline) throw new Error('Timed out waiting for the Next.js server.');
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  const tests = run('node_modules/@playwright/test/cli.js', ['test', ...args]);
  process.exitCode = await tests.done;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  if (server && server.child.exitCode === null) {
    server.child.kill();
    await server.done;
  }
}
