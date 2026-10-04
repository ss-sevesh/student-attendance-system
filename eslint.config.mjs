import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  globalIgnores(['.next/**', 'next-env.d.ts', '.npm-cache/**', '.playwright-mcp/**', 'playwright-report/**', 'test-results/**', 'agent-skills/**', 'scripts/**', 'public/face-api/face-api.min.js']),
]);
