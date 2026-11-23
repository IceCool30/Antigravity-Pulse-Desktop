import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Firestore,
  type Unsubscribe
} from 'firebase/firestore'
import {
  CONNECTION_MODES,
  promptCreatePayload,
  promptUpdatePayload,
  serverProfileCreatePayload,
  serverProfileUpdatePayload,
  type ConnectionMode,
  type NormalizedPrompt,
  type NormalizedServerProfile
} from '@shared/validation'
import { errorMessage } from './api'

/* ── Document shapes (mirrors the Android app's Firestore schema) ──────────── */

export interface ServerProfileDoc {
  id: string
  userId: string
  name: string
  endpointUrl: string
  connectionMode: ConnectionMode
  keepAlivePinned: boolean
  lastLatencyMs: number
  createdAt: number | null
  updatedAt: number | null
}

export interface CopilotPromptDoc {
  id: string
  userId: string
  title: string
  promptText: string
  rolePersona: string
  preferredModel: string
  createdAt: number | null
  updatedAt: number | null
}

export interface SnapshotMeta {
  fromCache: boolean
}

/* ── Defensive field parsing ───────────────────────────────────────────────── */

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback

const asBoolean = (value: unknown): boolean => value === true

const asNumber = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

function isTimestampLike(value: unknown): value is { toMillis(): number } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis?: unknown }).toMillis === 'function'
  )
}

const asMillis = (value: unknown): number | null => {
  if (isTimestampLike(value)) return value.toMillis()
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

const asConnectionMode = (value: unknown): ConnectionMode =>
  typeof value === 'string' && (CONNECTION_MODES as readonly string[]).includes(value)
    ? (value as ConnectionMode)
    : 'HYBRID_BRIDGE'

function mapProfile(id: string, data: Record<string, unknown> | undefined): ServerProfileDoc | null {
  if (!data) return null
  return {
    id,
    userId: asString(data.userId),
    name: asString(data.name, 'Untitled profile'),
    endpointUrl: asString(data.endpointUrl),
    connectionMode: asConnectionMode(data.connectionMode),
    keepAlivePinned: asBoolean(data.keepAlivePinned),
    lastLatencyMs: asNumber(data.lastLatencyMs),
    createdAt: asMillis(data.createdAt),
    updatedAt: asMillis(data.updatedAt)
  }
}

function mapPrompt(id: string, data: Record<string, unknown> | undefined): CopilotPromptDoc | null {
  if (!data) return null
  return {
    id,
    userId: asString(data.userId),
    title: asString(data.title, 'Untitled prompt'),
    promptText: asString(data.promptText),
    rolePersona: asString(data.rolePersona),
    preferredModel: asString(data.preferredModel),
    createdAt: asMillis(data.createdAt),
    updatedAt: asMillis(data.updatedAt)
  }
}

const updatedTime = (entry: { updatedAt: number | null; createdAt: number | null }): number =>
  entry.updatedAt ?? entry.createdAt ?? 0

/* ── Realtime subscriptions (sorted client-side by updatedAt desc) ─────────── */

export function subscribeProfiles(
  db: Firestore,
  uid: string,
  next: (docs: ServerProfileDoc[], meta: SnapshotMeta) => void,
  fail: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'serverProfiles'),
    (snapshot) => {
      const docs: ServerProfileDoc[] = []
      for (const entry of snapshot.docs) {
        const mapped = mapProfile(entry.id, entry.data())
        if (mapped) docs.push(mapped)
      }
      docs.sort((a, b) => updatedTime(b) - updatedTime(a))
      next(docs, { fromCache: snapshot.metadata.fromCache })
    },
    fail
  )
}

export function subscribePrompts(
  db: Firestore,
  uid: string,
  next: (docs: CopilotPromptDoc[], meta: SnapshotMeta) => void,
  fail: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    collection(db, 'users', uid, 'copilotPrompts'),
    (snapshot) => {
      const docs: CopilotPromptDoc[] = []
      for (const entry of snapshot.docs) {
        const mapped = mapPrompt(entry.id, entry.data())
        if (mapped) docs.push(mapped)
      }
      docs.sort((a, b) => updatedTime(b) - updatedTime(a))
      next(docs, { fromCache: snapshot.metadata.fromCache })
    },
    fail
  )
}

/* ── CRUD — payloads always come from @shared/validation (authToken: '') ───── */

export async function createProfile(
  db: Firestore,
  uid: string,
  profile: NormalizedServerProfile
): Promise<string> {
  const ref = doc(collection(db, 'users', uid, 'serverProfiles'))
  await setDoc(ref, {
    ...serverProfileCreatePayload(uid, profile),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return ref.id
}

export async function updateProfile(
  db: Firestore,
  uid: string,
  profileId: string,
  profile: NormalizedServerProfile
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'serverProfiles', profileId), {
    ...serverProfileUpdatePayload(profile),
    updatedAt: serverTimestamp()
  })
}

export async function deleteProfile(db: Firestore, uid: string, profileId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'serverProfiles', profileId))
}

export async function createPrompt(
  db: Firestore,
  uid: string,
  prompt: NormalizedPrompt
): Promise<string> {
  const ref = doc(collection(db, 'users', uid, 'copilotPrompts'))
  await setDoc(ref, {
    ...promptCreatePayload(uid, prompt),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return ref.id
}

export async function updatePrompt(
  db: Firestore,
  uid: string,
  promptId: string,
  prompt: NormalizedPrompt
): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'copilotPrompts', promptId), {
    ...promptUpdatePayload(prompt),
    updatedAt: serverTimestamp()
  })
}

export async function deletePrompt(db: Firestore, uid: string, promptId: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'copilotPrompts', promptId))
}

/* ── Actionable error copy ─────────────────────────────────────────────────── */

export function cloudErrorMessage(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'string'
      ? error.code
      : ''
  switch (code) {
    case 'permission-denied':
      return 'Firestore rejected this request. Confirm this Google account owns the data and that security rules allow users/{uid} in the shared database.'
    case 'unavailable':
      return 'Firestore is unreachable right now. Check your connection — reads fall back to cache and writes sync when it returns.'
    case 'failed-precondition':
      return 'The named Firestore database is not ready. Verify VITE_FIREBASE_DATABASE_ID matches the database used by Antigravity Pulse Android.'
    default:
      return errorMessage(error)
  }
}
