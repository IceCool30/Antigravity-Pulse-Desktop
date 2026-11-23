import { app, safeStorage } from 'electron'
import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import {
  DEFAULT_SETTINGS,
  applySettingsPatch,
  sanitizeSettings,
  type Settings
} from '@shared/settings'

interface VaultFile {
  version: 1
  values: Record<string, string>
}

const SETTINGS_FILE = 'settings.json'
const VAULT_FILE = 'vault.json'

function encodeSecret(value: string): string {
  if (safeStorage.isEncryptionAvailable()) {
    return `enc:${safeStorage.encryptString(value).toString('base64')}`
  }
  return `plain:${Buffer.from(value, 'utf8').toString('base64')}`
}

function decodeSecret(stored: string): string | null {
  try {
    if (stored.startsWith('enc:')) {
      if (!safeStorage.isEncryptionAvailable()) return null
      return safeStorage.decryptString(Buffer.from(stored.slice(4), 'base64'))
    }
    if (stored.startsWith('plain:')) {
      return Buffer.from(stored.slice(6), 'base64').toString('utf8')
    }
    return null
  } catch {
    return null
  }
}

/**
 * Local-only settings plus a DPAPI-backed secret vault. Cloud sync never reads
 * from here: Firestore documents always carry `authToken: ""`.
 */
export class SettingsStore {
  private readonly settingsPath: string
  private readonly vaultPath: string
  private settings: Settings = { ...DEFAULT_SETTINGS }
  private vault: VaultFile = { version: 1, values: {} }
  private settingsTimer: NodeJS.Timeout | null = null
  private vaultTimer: NodeJS.Timeout | null = null
  private loaded = false

  constructor(userDataPath: string) {
    this.settingsPath = join(userDataPath, SETTINGS_FILE)
    this.vaultPath = join(userDataPath, VAULT_FILE)
  }

  get encryptionAvailable(): boolean {
    return safeStorage.isEncryptionAvailable()
  }

  async load(): Promise<void> {
    await fs.mkdir(app.getPath('userData'), { recursive: true })

    try {
      const text = await fs.readFile(this.settingsPath, 'utf8')
      this.settings = sanitizeSettings(JSON.parse(text))
    } catch {
      this.settings = { ...DEFAULT_SETTINGS }
      await this.writeSettings()
    }

    try {
      const text = await fs.readFile(this.vaultPath, 'utf8')
      const parsed = JSON.parse(text) as Partial<VaultFile>
      if (parsed && typeof parsed === 'object' && parsed.values && typeof parsed.values === 'object') {
        const values: Record<string, string> = {}
        for (const [key, value] of Object.entries(parsed.values)) {
          if (typeof value === 'string') values[key] = value
        }
        this.vault = { version: 1, values }
      }
    } catch {
      this.vault = { version: 1, values: {} }
    }

    this.loaded = true
  }

  get(): Settings {
    return this.settings
  }

  async update(patch: unknown): Promise<Settings> {
    this.settings = applySettingsPatch(this.settings, patch)
    this.scheduleSettingsSave()
    return this.settings
  }

  async replace(next: unknown): Promise<Settings> {
    this.settings = sanitizeSettings(next)
    this.scheduleSettingsSave()
    return this.settings
  }

  async reset(): Promise<Settings> {
    this.settings = { ...DEFAULT_SETTINGS }
    this.scheduleSettingsSave()
    return this.settings
  }

  async setSecret(key: string, value: string): Promise<void> {
    if (!this.loaded) await this.load()
    if (!value) {
      delete this.vault.values[key]
    } else {
      this.vault.values[key] = encodeSecret(value)
    }
    this.scheduleVaultSave()
  }

  getSecret(key: string): string | null {
    const stored = this.vault.values[key]
    if (!stored) return null
    return decodeSecret(stored)
  }

  async deleteSecret(key: string): Promise<void> {
    if (!this.vault.values[key]) return
    delete this.vault.values[key]
    this.scheduleVaultSave()
  }

  /** 256-bit hex token, generated once and stored in the OS secret vault. */
  async ensureBridgeToken(): Promise<string> {
    const existing = this.getSecret('bridge:token')
    if (existing && /^[a-f0-9]{64}$/i.test(existing)) return existing
    const token = randomBytes(32).toString('hex')
    await this.setSecret('bridge:token', token)
    return token
  }

  async regenerateBridgeToken(): Promise<string> {
    const token = randomBytes(32).toString('hex')
    await this.setSecret('bridge:token', token)
    return token
  }

  private scheduleSettingsSave(): void {
    if (this.settingsTimer) clearTimeout(this.settingsTimer)
    this.settingsTimer = setTimeout(() => {
      this.settingsTimer = null
      void this.writeSettings()
    }, 120)
  }

  private scheduleVaultSave(): void {
    if (this.vaultTimer) clearTimeout(this.vaultTimer)
    this.vaultTimer = setTimeout(() => {
      this.vaultTimer = null
      void this.writeVault()
    }, 120)
  }

  private async writeSettings(): Promise<void> {
    const temporary = `${this.settingsPath}.tmp`
    try {
      await fs.mkdir(app.getPath('userData'), { recursive: true })
      await fs.writeFile(temporary, `${JSON.stringify(this.settings, null, 2)}\n`, 'utf8')
      await fs.rename(temporary, this.settingsPath)
    } catch (error) {
      console.error('[settings] failed to persist settings', error)
    }
  }

  private async writeVault(): Promise<void> {
    const temporary = `${this.vaultPath}.tmp`
    try {
      await fs.mkdir(app.getPath('userData'), { recursive: true })
      await fs.writeFile(temporary, `${JSON.stringify(this.vault, null, 2)}\n`, 'utf8')
      await fs.rename(temporary, this.vaultPath)
    } catch (error) {
      console.error('[settings] failed to persist vault', error)
    }
  }

  async flush(): Promise<void> {
    if (this.settingsTimer) {
      clearTimeout(this.settingsTimer)
      this.settingsTimer = null
    }
    if (this.vaultTimer) {
      clearTimeout(this.vaultTimer)
      this.vaultTimer = null
    }
    await Promise.all([this.writeSettings(), this.writeVault()])
  }
}
