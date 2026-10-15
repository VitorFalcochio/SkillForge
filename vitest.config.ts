import { defineConfig } from 'vitest/config';
import { mkdirSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Keep worker and fixture temporaries on the workspace volume, including Windows.
const temporaryRoot = fileURLToPath(new URL('./.tmp/', import.meta.url));
mkdirSync(temporaryRoot, { recursive: true });
const canonicalTemporaryRoot = realpathSync(temporaryRoot);
process.env.TEMP = canonicalTemporaryRoot;
process.env.TMP = canonicalTemporaryRoot;
process.env.TMPDIR = canonicalTemporaryRoot;

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    maxWorkers: 2,
  },
});
