# Privacy Policy — Antigravity Pulse Desktop

_Last updated: 23 November 2026_

Antigravity Pulse Desktop is a local-first Electron application built by Solomon Bukie. This
policy explains what the app stores and what it sends to Google.

## What the app stores locally

- Settings, theme preferences, workspace URLs, and UI state in a local JSON file under Electron's
  `userData` directory.
- Encrypted profile tokens and the phone-bridge bearer token in the operating system's secret store
  (Windows DPAPI via Electron `safeStorage`). These never leave the device.
- Browser sessions for the pinned workspaces in a shared persistent Chromium profile on this device.

## What the app sends to Google

- **Google sign-in** opens your system browser. The app exchanges the authorization code with Google
  over HTTPS and uses the ID token with Firebase Authentication. It requests only `openid`, `email`,
  and `profile`.
- **Firestore** stores server profiles and copilot prompts in the Firebase project shared with the
  Android app. Profile documents always contain `authToken: ""`; real tokens are never uploaded.
- No analytics, advertising SDKs, or third-party trackers are included.

## Phone bridge

The Phone Companion bridge is off by default. When enabled, it listens only on local network
interfaces and requires a randomly generated 256-bit bearer token on every request. No data is sent
to any third party through the bridge.

## Your controls

- Sign out in **Cloud Sync & Phone Companion** to stop Firestore synchronization.
- Disable the bridge in Settings or the Phone Companion drawer.
- Uninstall the app to remove local settings; browser profiles are stored in Electron's `userData`
  directory and can be deleted separately.

## Contact

Questions about this policy: [solomonogarbukie@gmail.com](mailto:solomonogarbukie@gmail.com)

This document describes the app's actual behavior. It is not legal advice.
