import { exports as workerExports } from 'cloudflare:workers'
import { describe, expect, it } from 'vitest'

describe('WebVista Worker', () => {
  it('serves the starter response', async () => {
    const response = await workerExports.default.fetch('https://webvista.test/')

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/plain')
    await expect(response.text()).resolves.toBe('WebVista is getting ready.')
  })
})
