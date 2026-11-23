import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app'
import { browserLocalPersistence, getAuth, setPersistence, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'

const env = import.meta.env

const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID
}

/** Exact named Firestore database shared with Antigravity Pulse Android. */
export const firebaseDatabaseId = (env.VITE_FIREBASE_DATABASE_ID ?? '').trim()
export const firebaseProjectId = (env.VITE_FIREBASE_PROJECT_ID ?? '').trim()

/** Missing .env renders a friendly "not configured" card instead of throwing. */
export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId && firebaseDatabaseId)
}

export interface FirebaseHandles {
  app: FirebaseApp
  auth: Auth
  db: Firestore
}

let handles: FirebaseHandles | null = null

/** Lazy singleton; returns null when env is incomplete. Never uses (default). */
export function getFirebase(): FirebaseHandles | null {
  if (!isFirebaseConfigured()) return null
  if (handles) return handles
  const app = getApps().length > 0 ? getApp() : initializeApp(config)
  const auth = getAuth(app)
  // Best-effort: persistence may be unavailable in hardened contexts.
  void setPersistence(auth, browserLocalPersistence).catch(() => undefined)
  const db = getFirestore(app, firebaseDatabaseId)
  handles = { app, auth, db }
  return handles
}
