/**
 * Genuine desktop Chrome identity helpers shared by Electron sessions,
 * sandboxed browser-compat preloads, and unit tests.
 */

export const DEFAULT_ACCEPT_LANGUAGE = 'en-US,en;q=0.9'

export interface PlatformIdentity {
  uaPlatform: string
  chPlatform: string
  chPlatformName: string
  chPlatformVersion: string
  chArch: string
  chBitness: string
}

export interface IdentityOptions {
  platform?: string
  arch?: string
  chromeVersion?: string
}

export function resolveChromeVersion(raw?: string): string {
  const cleaned = typeof raw === 'string' ? raw.trim() : ''
  return /^\d+(?:\.\d+){1,3}$/.test(cleaned) ? cleaned : '156.0.0.0'
}

export function browserPlatformInfo(
  platform: string = 'win32',
  arch: string = 'x64'
): PlatformIdentity {
  const chArch = arch === 'arm64' || arch === 'arm' ? 'arm' : 'x86'
  const chBitness = arch === 'ia32' ? '32' : '64'

  if (platform === 'darwin') {
    return {
      uaPlatform: 'Macintosh; Intel Mac OS X 10_15_7',
      chPlatform: '"macOS"',
      chPlatformName: 'macOS',
      chPlatformVersion: '15.0.0',
      chArch,
      chBitness
    }
  }
  if (platform === 'linux') {
    return {
      uaPlatform: 'X11; Linux x86_64',
      chPlatform: '"Linux"',
      chPlatformName: 'Linux',
      chPlatformVersion: '6.8.0',
      chArch,
      chBitness
    }
  }
  return {
    uaPlatform: 'Windows NT 10.0; Win64; x64',
    chPlatform: '"Windows"',
    chPlatformName: 'Windows',
    chPlatformVersion: '19.0.0',
    chArch,
    chBitness
  }
}

export function buildBrowserUserAgent(
  platform: string = 'win32',
  chromeVersion?: string
): string {
  const { uaPlatform } = browserPlatformInfo(platform)
  const version = resolveChromeVersion(chromeVersion)
  return `Mozilla/5.0 (${uaPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${version} Safari/537.36`
}

export function buildClientHintHeaders(options: IdentityOptions = {}): Record<string, string> {
  const version = resolveChromeVersion(options.chromeVersion)
  const major = version.split('.')[0] ?? '156'
  const info = browserPlatformInfo(options.platform, options.arch)

  return {
    'Sec-CH-UA': `"Not_A Brand";v="24", "Chromium";v="${major}", "Google Chrome";v="${major}"`,
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': info.chPlatform
  }
}

export function buildHighEntropyClientHintHeaders(options: IdentityOptions = {}): Record<string, string> {
  const version = resolveChromeVersion(options.chromeVersion)
  const info = browserPlatformInfo(options.platform, options.arch)

  return {
    'Sec-CH-UA-Full-Version-List': `"Not_A Brand";v="24.0.0.0", "Chromium";v="${version}", "Google Chrome";v="${version}"`,
    'Sec-CH-UA-Full-Version': `"${version}"`,
    'Sec-CH-UA-Platform-Version': `"${info.chPlatformVersion}"`,
    'Sec-CH-UA-Arch': `"${info.chArch}"`,
    'Sec-CH-UA-Bitness': `"${info.chBitness}"`,
    'Sec-CH-UA-Model': '""'
  }
}

export function isGoogleIdentityUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const host = parsed.hostname.toLowerCase()
    return (
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host.startsWith('accounts.google.') ||
      host === 'googleapis.com' ||
      host.endsWith('.googleapis.com') ||
      host === 'gstatic.com' ||
      host.endsWith('.gstatic.com') ||
      host === 'accounts.youtube.com'
    )
  } catch {
    return false
  }
}

function findHeaderKey(headers: Record<string, string>, targetLower: string): string | undefined {
  return Object.keys(headers).find((key) => key.toLowerCase() === targetLower)
}

function deleteHeaderInsensitive(headers: Record<string, string>, targetLower: string): void {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === targetLower) delete headers[key]
  }
}

/**
 * Rewrites outgoing HTTP(S) headers so embedded Electron views never advertise
 * Chromium-only or mismatched Client Hints to identity providers like Google.
 */
export function applyBrowserRequestHeaders(
  requestHeaders: Record<string, string>,
  url: string,
  options: IdentityOptions = {}
): Record<string, string> {
  const next: Record<string, string> = { ...requestHeaders }
  const ua = buildBrowserUserAgent(options.platform, options.chromeVersion)
  const lowEntropy = buildClientHintHeaders(options)
  const highEntropy = buildHighEntropyClientHintHeaders(options)
  const isGoogle = isGoogleIdentityUrl(url)

  deleteHeaderInsensitive(next, 'user-agent')
  next['User-Agent'] = ua

  const langKey = findHeaderKey(next, 'accept-language')
  if (!langKey || next[langKey]?.trim() === 'en-US') {
    if (langKey && langKey !== 'Accept-Language') delete next[langKey]
    next['Accept-Language'] = DEFAULT_ACCEPT_LANGUAGE
  }

  for (const [headerName, headerValue] of Object.entries(lowEntropy)) {
    deleteHeaderInsensitive(next, headerName.toLowerCase())
    next[headerName] = headerValue
  }

  for (const [headerName, headerValue] of Object.entries(highEntropy)) {
    const lower = headerName.toLowerCase()
    const hadHeader = findHeaderKey(next, lower) !== undefined
    if (isGoogle || hadHeader) {
      deleteHeaderInsensitive(next, lower)
      next[headerName] = headerValue
    }
  }

  return next
}

/**
 * Builds the main-world preload script that aligns `navigator.userAgentData`,
 * `window.chrome`, and `navigator.webdriver` with desktop Google Chrome.
 */
export function buildBrowserCompatScript(options: IdentityOptions = {}): string {
  const version = resolveChromeVersion(options.chromeVersion)
  const major = version.split('.')[0] ?? '156'
  const info = browserPlatformInfo(options.platform, options.arch)

  const config = JSON.stringify({
    version,
    major,
    platform: info.chPlatformName,
    platformVersion: info.chPlatformVersion,
    architecture: info.chArch,
    bitness: info.chBitness
  })

  return `(() => {
  if (globalThis.__pulseBrowserCompatApplied) return;
  try {
    Object.defineProperty(globalThis, '__pulseBrowserCompatApplied', { value: true, configurable: false });
  } catch {}
  const cfg = ${config};
  const brands = [
    { brand: 'Not_A Brand', version: '24' },
    { brand: 'Chromium', version: cfg.major },
    { brand: 'Google Chrome', version: cfg.major }
  ];
  const fullVersionList = [
    { brand: 'Not_A Brand', version: '24.0.0.0' },
    { brand: 'Chromium', version: cfg.version },
    { brand: 'Google Chrome', version: cfg.version }
  ];
  const highEntropyMap = {
    architecture: cfg.architecture,
    bitness: cfg.bitness,
    brands: brands.map((b) => ({ ...b })),
    fullVersionList: fullVersionList.map((b) => ({ ...b })),
    mobile: false,
    model: '',
    platform: cfg.platform,
    platformVersion: cfg.platformVersion,
    uaFullVersion: cfg.version,
    wow64: false
  };
  const uaData = {
    brands: brands.map((b) => ({ ...b })),
    mobile: false,
    platform: cfg.platform,
    toJSON() {
      return {
        brands: brands.map((b) => ({ ...b })),
        mobile: false,
        platform: cfg.platform
      };
    },
    async getHighEntropyValues(hints) {
      const out = {
        brands: brands.map((b) => ({ ...b })),
        mobile: false,
        platform: cfg.platform
      };
      if (Array.isArray(hints)) {
        for (const hint of hints) {
          if (Object.prototype.hasOwnProperty.call(highEntropyMap, hint)) {
            out[hint] = highEntropyMap[hint];
          }
        }
      }
      return out;
    }
  };
  try {
    if (typeof Navigator !== 'undefined' && Navigator.prototype) {
      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        get: () => uaData,
        configurable: true
      });
    }
  } catch {}
  try {
    if (typeof Navigator !== 'undefined' && Navigator.prototype && navigator.webdriver !== false) {
      Object.defineProperty(Navigator.prototype, 'webdriver', {
        get: () => false,
        configurable: true
      });
    }
  } catch {}
  try {
    const g = globalThis;
    if (!g.chrome || typeof g.chrome !== 'object') {
      Object.defineProperty(g, 'chrome', { value: {}, writable: true, configurable: true });
    }
    const c = g.chrome;
    if (!c.runtime) c.runtime = {};
    if (!c.app) c.app = { isInstalled: false };
    if (!c.csi) c.csi = () => ({});
    if (!c.loadTimes) c.loadTimes = () => ({});
  } catch {}
})();`
}
