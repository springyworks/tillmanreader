import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { defineConfig } from 'vitest/config';

interface PackageJson {
  version: string;
}

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8'),
) as PackageJson;

/** Runs a git command; falls back when git or the repository history is unavailable. */
function git(args: string[], fallback: string): string {
  try {
    const out = execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.trim() || fallback;
  } catch {
    return fallback;
  }
}

// CI variables win over local git state so builds are reproducible (and work without .git).
const commit = (process.env.GITHUB_SHA ?? git(['rev-parse', 'HEAD'], 'dev')).slice(0, 7);
const sourceDateEpoch = process.env.SOURCE_DATE_EPOCH;
const committedAt = (
  sourceDateEpoch
    ? new Date(Number(sourceDateEpoch) * 1000)
    : new Date(git(['show', '-s', '--format=%cI', 'HEAD'], new Date().toISOString()))
).toISOString();

// The production build is a single self-contained index.html (JS + CSS inlined). The app's
// "Export standalone HTML" and borderless pop-out features clone the live document, so
// everything must live inside that one file.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __GIT_COMMIT__: JSON.stringify(commit),
    __BUILD_DATE__: JSON.stringify(committedAt),
  },
  plugins: [viteSingleFile()],
  build: {
    target: 'es2022',
    cssMinify: false,
    chunkSizeWarningLimit: 1024,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/types/**', 'src/vite-env.d.ts'],
    },
  },
});
