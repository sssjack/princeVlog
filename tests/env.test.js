import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { loadEnvFile } from '../server/env.js';

let tempDir;

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), 'princevlog-env-'));
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe('env file loading', () => {
  it('loads simple KEY=value pairs without overriding existing env values', async () => {
    const envPath = path.join(tempDir, '.env');
    await writeFile(envPath, [
      'DEEPSEEK_API_URL=https://deepseek.example/chat',
      'DEEPSEEK_API_KEY=\"test-key\"',
      'DEEPSEEK_MODEL=deepseek-v4-pro',
      'PORT=9999'
    ].join('\n'));
    const env = { PORT: '4210' };

    loadEnvFile(envPath, env);

    expect(env).toMatchObject({
      DEEPSEEK_API_URL: 'https://deepseek.example/chat',
      DEEPSEEK_API_KEY: 'test-key',
      DEEPSEEK_MODEL: 'deepseek-v4-pro',
      PORT: '4210'
    });
  });
});
