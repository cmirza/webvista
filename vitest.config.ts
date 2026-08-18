import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers'
import { defineConfig } from 'vitest/config'

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    new URL('./migrations', import.meta.url).pathname,
  )

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            ADMIN_PASSWORD: 'webvista-test-password',
            ADMIN_SESSION_SECRET:
              'webvista-test-session-secret-with-at-least-32-characters',
            TMDB_API_TOKEN: 'webvista-test-tmdb-token',
          },
        },
      }),
    ],
    test: {
      provide: { migrations },
      setupFiles: ['./test/setup.ts'],
    },
  }
})
