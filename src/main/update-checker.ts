import { net } from 'electron'
import type { UpdateStatus } from '@shared/ipc'
import { DEVELOPER } from '@shared/workspaces'

const RELEASE_API = `https://api.github.com/repos/${DEVELOPER.github}/Antigravity-Pulse-Desktop/releases/latest`

function parseVersion(version: string): number[] {
  return version
    .replace(/^v/i, '')
    .split(/[.+-]/)
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0))
}

function isNewer(latest: string, current: string): boolean {
  const left = parseVersion(latest)
  const right = parseVersion(current)
  const length = Math.max(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const a = left[index] ?? 0
    const b = right[index] ?? 0
    if (a > b) return true
    if (a < b) return false
  }
  return false
}

export async function checkForUpdates(currentVersion: string): Promise<UpdateStatus> {
  try {
    const response = await net.fetch(RELEASE_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': `Antigravity-Pulse-Desktop/${currentVersion}`
      },
      signal: AbortSignal.timeout(12_000)
    })
    if (!response.ok) {
      return {
        state: 'error',
        message:
          response.status === 404
            ? 'No published releases found yet.'
            : `GitHub responded with ${response.status}.`,
        checkedAt: Date.now()
      }
    }
    const body = (await response.json()) as { tag_name?: string; html_url?: string }
    const tag = typeof body.tag_name === 'string' ? body.tag_name.replace(/^v/i, '') : ''
    const url = typeof body.html_url === 'string' ? body.html_url : undefined
    if (!tag) {
      return { state: 'error', message: 'Release metadata was incomplete.', checkedAt: Date.now() }
    }
    if (isNewer(tag, currentVersion)) {
      return { state: 'available', latestVersion: tag, url, checkedAt: Date.now() }
    }
    return { state: 'current', latestVersion: tag, url, checkedAt: Date.now() }
  } catch {
    return { state: 'error', message: 'Could not reach GitHub Releases.', checkedAt: Date.now() }
  }
}
