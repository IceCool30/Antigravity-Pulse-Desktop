# Windows code signing — Antigravity Pulse Desktop

v1.0.0 was built and published unsigned, so Windows SmartScreen may warn on first run. This guide
sets up a signed follow-up build (v1.0.1 or later) without putting any certificate material in the
repository.

## Option A — Azure Trusted Signing (recommended)

Microsoft's Trusted Signing service issues short-lived certificates and needs no `.pfx` file on disk.
Use an **OV** certificate profile for a personal/indie publisher; **EV** is required for immediate
SmartScreen reputation and is available to verified organizations.

1. Create an Azure **Trusted Signing Account** in a supported region (for example `eastus`).
2. Create a **Certificate Profile** of type `Public Trusted Signing` with publisher name exactly
   `Solomon Bukie`.
3. Grant your Azure identity the role **Trusted Signing Certificate Profile Signer** on that profile.
4. Authenticate locally with `az login` (or set the standard `AZURE_*` environment variables for a
   service principal). The signing tool uses Microsoft Entra ID via `DefaultAzureCredential`.
5. Uncomment and fill the `azureSignOptions` block in [electron-builder.yml](/C:/Users/john.bisong/Bukie%20Workspace/Antigravity%20Pulse%20Desktop/electron-builder.yml):

   ```yaml
   win:
     azureSignOptions:
       endpoint: https://eastus.codesigning.azure.net
       codeSigningAccountName: <your-trusted-signing-account>
       certificateProfileName: <your-certificate-profile>
       publisherName: Solomon Bukie
   ```

6. Run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dist-signed.ps1`.

No certificate or password ever enters git. The values above are account *names*, not secrets, but
keep them in `.env.local` or your shell profile if you prefer.

## Option B — local PFX / hardware token

1. Buy an **OV or EV code-signing certificate**. EV typically removes the SmartScreen warning
   immediately; OV builds reputation over time.
2. Export it as `antigravity-pulse.pfx` (or use an EV token's signing utility via `signtoolOptions`).
3. Store the file **outside** this repository, for example:

   ```
   C:\Users\john.bisong\Keys\antigravity-pulse\antigravity-pulse.pfx
   ```

   Confirm `git check-ignore` passes for that path — never commit or package the `.pfx`.
4. Set the environment variables in the shell that runs the build:

   ```powershell
   $env:CSC_LINK = 'C:\Users\john.bisong\Keys\antigravity-pulse\antigravity-pulse.pfx'
   $env:CSC_KEY_PASSWORD = Read-Host -AsSecureString 'Certificate password' | ConvertFrom-SecureString -AsPlainText
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/dist-signed.ps1
   Remove-Item Env:CSC_KEY_PASSWORD
   ```

   electron-builder reads `CSC_LINK` / `CSC_KEY_PASSWORD` automatically. Paths are safer than
   base64 here because the value never appears in shell history as a long blob.

## Verify a signed build

After packaging:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-signatures.ps1
```

Expected output for a correctly signed build: `Valid` for the installer, the portable executable,
and both signed NSIS helper binaries, with the signer `Solomon Bukie`.

## Release checklist for the signed version

1. Bump `version` in `package.json`, `CHANGELOG.md`, and `RELEASE_NOTES.md`.
2. Run `npm test`, `npm run typecheck`, then `scripts/dist-signed.ps1`.
3. Run `scripts/verify-signatures.ps1` — stop if any signature is not `Valid`.
4. Run `scripts/make-checksums.ps1` and verify with `Get-FileHash`.
5. Tag and publish with `gh release create v1.0.1 ... --notes-file RELEASE_NOTES.md`.
6. Remove the SmartScreen warning from the release notes once the signed build is live.

## Current status

| Item | State |
| --- | --- |
| Code-signing certificate | Not present on this machine — you need to obtain one |
| electron-builder signing config | Ready-to-enable (commented Azure block) |
| `CSC_LINK` / `CSC_KEY_PASSWORD` support | Built into electron-builder; no source changes needed |
| Signature verification script | Included and ready |
