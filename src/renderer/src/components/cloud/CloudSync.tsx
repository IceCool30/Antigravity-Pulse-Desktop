import { useEffect, useState } from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithCredential,
  signOut as firebaseSignOut,
  type User
} from 'firebase/auth'
import { Cloud, CloudOff, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react'
import { errorMessage, invoke } from '../../lib/api'
import {
  cloudErrorMessage,
  subscribeProfiles,
  subscribePrompts,
  type CopilotPromptDoc,
  type ServerProfileDoc
} from '../../lib/cloud'
import { getFirebase, isFirebaseConfigured } from '../../lib/firebase'
import { useShell } from '../../store/shell'
import { GoogleMark } from '../BrandIcons'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Spinner'
import { TabPanel, Tabs } from '../ui/Tabs'
import { BridgeTab } from './BridgeTab'
import { ProfilesTab } from './ProfilesTab'
import { PromptsTab } from './PromptsTab'

type CloudTab = 'profiles' | 'prompts' | 'bridge'
type Connection = 'connecting' | 'live' | 'cached' | 'offline'

function NotConfiguredCard() {
  return (
    <div className="panel mx-auto mt-10 max-w-xl rounded-2xl p-8 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <CloudOff size={26} aria-hidden />
      </span>
      <h2 className="mt-4 font-display text-lg font-semibold leading-[1.15]">
        Cloud Sync isn’t configured
      </h2>
      <p className="mt-2 text-sm text-muted">
        Add your Firebase web app credentials to <span className="font-mono text-xs">.env</span> and
        restart the app. The named Firestore database must match Antigravity Pulse Android.
      </p>
      <ul className="mx-auto mt-4 flex max-w-sm flex-col gap-1 text-left font-mono text-2xs text-muted">
        {[
          'VITE_FIREBASE_API_KEY',
          'VITE_FIREBASE_AUTH_DOMAIN',
          'VITE_FIREBASE_PROJECT_ID',
          'VITE_FIREBASE_STORAGE_BUCKET',
          'VITE_FIREBASE_MESSAGING_SENDER_ID',
          'VITE_FIREBASE_APP_ID',
          'VITE_FIREBASE_DATABASE_ID'
        ].map((key) => (
          <li key={key} className="rounded-md border border-line bg-surface px-2 py-1">
            {key}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function CloudSync() {
  const setCloudAccount = useShell((state) => state.setCloudAccount)
  const pushToast = useShell((state) => state.pushToast)
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [tab, setTab] = useState<CloudTab>('profiles')
  const [profiles, setProfiles] = useState<ServerProfileDoc[]>([])
  const [prompts, setPrompts] = useState<CopilotPromptDoc[]>([])
  const [profilesLoading, setProfilesLoading] = useState(true)
  const [promptsLoading, setPromptsLoading] = useState(true)
  const [profilesError, setProfilesError] = useState<string | null>(null)
  const [promptsError, setPromptsError] = useState<string | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')

  const configured = isFirebaseConfigured()

  useEffect(() => {
    const fb = getFirebase()
    if (!fb) {
      setAuthReady(true)
      return
    }
    const unsubscribe = onAuthStateChanged(
      fb.auth,
      (nextUser) => {
        setUser(nextUser)
        setAuthReady(true)
        setCloudAccount(
          nextUser
            ? { email: nextUser.email, name: nextUser.displayName, picture: nextUser.photoURL }
            : null
        )
      },
      (error) => {
        setAuthError(cloudErrorMessage(error))
        setAuthReady(true)
      }
    )
    return () => {
      unsubscribe()
      setCloudAccount(null)
    }
  }, [setCloudAccount])

  useEffect(() => {
    const fb = getFirebase()
    if (!fb || !user) {
      setProfiles([])
      setPrompts([])
      setProfilesError(null)
      setPromptsError(null)
      setConnection('connecting')
      return
    }
    setProfilesLoading(true)
    setPromptsLoading(true)
    const unsubscribeProfiles = subscribeProfiles(
      fb.db,
      user.uid,
      (docs, meta) => {
        setProfiles(docs)
        setProfilesError(null)
        setProfilesLoading(false)
        setConnection(meta.fromCache ? 'cached' : 'live')
      },
      (error) => {
        setProfilesError(cloudErrorMessage(error))
        setProfilesLoading(false)
        setConnection('offline')
      }
    )
    const unsubscribePrompts = subscribePrompts(
      fb.db,
      user.uid,
      (docs, meta) => {
        setPrompts(docs)
        setPromptsError(null)
        setPromptsLoading(false)
        setConnection(meta.fromCache ? 'cached' : 'live')
      },
      (error) => {
        setPromptsError(cloudErrorMessage(error))
        setPromptsLoading(false)
        setConnection('offline')
      }
    )
    return () => {
      unsubscribeProfiles()
      unsubscribePrompts()
    }
  }, [user])

  const signIn = async (): Promise<void> => {
    const fb = getFirebase()
    if (!fb) return
    setSigningIn(true)
    setAuthError(null)
    try {
      // OAuth happens in the system browser via main; we only receive the idToken.
      const tokens = await invoke('auth:google', undefined)
      const credential = GoogleAuthProvider.credential(tokens.idToken)
      await signInWithCredential(fb.auth, credential)
    } catch (caught) {
      setAuthError(errorMessage(caught))
    } finally {
      setSigningIn(false)
    }
  }

  const cancelSignIn = (): void => {
    void invoke('auth:cancel', undefined).catch(() => undefined)
  }

  const signOut = async (): Promise<void> => {
    const fb = getFirebase()
    if (!fb) return
    try {
      await firebaseSignOut(fb.auth)
      pushToast({ title: 'Signed out', body: 'Cloud Sync access revoked on this device.', kind: 'info' })
    } catch (caught) {
      pushToast({ title: 'Sign out failed', body: errorMessage(caught), kind: 'error' })
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1080px] flex-col gap-6 px-6 py-8">
        {!configured ? (
          <NotConfiguredCard />
        ) : !authReady ? (
          <div className="flex flex-col gap-4" aria-label="Loading Cloud Sync">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : !user ? (
          <div className="panel mx-auto mt-6 w-full max-w-2xl rounded-2xl p-8">
            <span className="grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Cloud size={26} aria-hidden />
            </span>
            <h1 className="mt-4 font-display text-xl font-semibold leading-[1.15]">
              Sync with Antigravity Pulse for Android
            </h1>
            <p className="mt-2 text-sm text-muted">
              Sign in with Google to share server profiles and copilot prompts with Antigravity Pulse
              for Android. Sign-in opens in your system browser.
            </p>

            {authError ? (
              <div role="alert" className="mt-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3">
                <p className="text-sm text-error">{authError}</p>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => void signIn()}>
                  Retry sign-in
                </Button>
              </div>
            ) : null}

            <div className="mt-5 flex items-center gap-2">
              <Button
                variant="primary"
                icon={<GoogleMark size={15} />}
                loading={signingIn}
                onClick={() => void signIn()}
              >
                Sign in with Google
              </Button>
              {signingIn ? (
                <Button variant="ghost" onClick={cancelSignIn}>
                  Cancel
                </Button>
              ) : null}
            </div>

            <ul className="mt-6 flex flex-col gap-2 border-t border-line pt-4 text-xs text-muted">
              {[
                'Device tokens stay local in the OS vault — never in Firestore.',
                'Every profile document carries authToken: "" (empty).',
                'Signing out revokes this device’s sync access.'
              ].map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                  {line}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <>
            {/* Account row */}
            <header className="flex flex-wrap items-center gap-4">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt=""
                  width={36}
                  height={36}
                  className="h-9 w-9 rounded-full border border-line object-cover"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent-soft text-accent">
                  <UserIcon size={16} aria-hidden />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.displayName ?? 'Google account'}</p>
                <p className="truncate text-xs text-muted">{user.email ?? user.uid}</p>
              </div>
              {connection === 'live' ? (
                <Badge variant="online" dot title="Firestore realtime connection is live">
                  live
                </Badge>
              ) : connection === 'cached' ? (
                <Badge variant="warning" dot title="Serving cached data; writes will sync">
                  cached
                </Badge>
              ) : connection === 'offline' ? (
                <Badge variant="error" dot title="Firestore is unreachable">
                  offline
                </Badge>
              ) : (
                <Badge dot>connecting</Badge>
              )}
              <Button variant="ghost" size="sm" icon={<LogOut size={13} aria-hidden />} onClick={() => void signOut()}>
                Sign out
              </Button>
            </header>

            <p className="text-2xs text-muted">
              Shared test-mode database — keep payloads credential-free.
            </p>

            <Tabs
              label="Cloud Sync sections"
              active={tab}
              onChange={(id) => setTab(id as CloudTab)}
              items={[
                { id: 'profiles', label: 'Server profiles' },
                { id: 'prompts', label: 'Copilot prompts' },
                { id: 'bridge', label: 'Phone bridge' }
              ]}
            />
            <TabPanel id="profiles" active={tab}>
              <ProfilesTab uid={user.uid} profiles={profiles} loading={profilesLoading} error={profilesError} />
            </TabPanel>
            <TabPanel id="prompts" active={tab}>
              <PromptsTab uid={user.uid} prompts={prompts} loading={promptsLoading} error={promptsError} />
            </TabPanel>
            <TabPanel id="bridge" active={tab}>
              <BridgeTab />
            </TabPanel>
          </>
        )}
      </div>
    </div>
  )
}
