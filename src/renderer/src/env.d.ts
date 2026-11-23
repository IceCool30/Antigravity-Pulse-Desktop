/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  /** Exact named Firestore database shared with Antigravity Pulse Android. */
  readonly VITE_FIREBASE_DATABASE_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

/**
 * Ambient shim for the web program only. tsconfig.web.json limits `types` to
 * "vite/client", but @shared/ipc.ts references NodeJS.Platform. This mirrors
 * the exact union from @types/node so the shared contract typechecks without
 * editing shared files or configs. The node program loads real @types/node
 * and never includes this file.
 */
declare namespace NodeJS {
  type Platform =
    | 'aix'
    | 'android'
    | 'darwin'
    | 'freebsd'
    | 'haiku'
    | 'linux'
    | 'openbsd'
    | 'sunos'
    | 'win32'
    | 'cygwin'
    | 'netbsd'
}
