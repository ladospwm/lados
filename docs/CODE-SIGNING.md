# Code signing (Windows) — plan

## Why

Windows **SmartScreen** warns about any `.exe`/`.msi` that is not signed with a trusted
Authenticode certificate, and browsers tag downloads from an unknown publisher. Users see
*"Windows protected your PC"* / *"Unknown publisher"*. This is independent of where the
file is hosted (GitHub included).

> The Tauri updater signature (`TAURI_SIGNING_PRIVATE_KEY`, `latest.json`) is **minisign**,
> used only for in-app update integrity. It does **not** affect SmartScreen. Separate thing.

## Recommendation: SignPath Foundation (free for OSS)

<https://signpath.org> — free Authenticode signing for open-source projects.

- The certificate is issued to **SignPath Foundation**, so the listed publisher is
  *SignPath Foundation*, **not** the project author. Good when you do not want to publish
  your personal name as the publisher.
- **OV-level** certificate: it removes "Unknown publisher", but SmartScreen **reputation
  still builds** over time with downloads. Only an **EV** certificate gives instant trust
  (and is paid).
- Private key lives on SignPath's HSM; integrates with GitHub Actions; **each release is
  approved by hand** before it is signed.
- Required attribution (already in the README and on `/code-signing`):
  *"Free code signing provided by SignPath.io, certificate by SignPath Foundation."*

### Eligibility checklist for Lados

| Requirement | Status |
| --- | --- |
| OSI license, no commercial dual-license | ✅ GPL-3.0 |
| No proprietary components | ✅ (OSS deps only) |
| Actively maintained, already released | ✅ v0.3.0 |
| Download page describes the app | ✅ `/` and releases |
| Sign your own binaries only | ✅ |
| No "hacking tools" | ✅ |
| Privacy respected + policy | ✅ `/privacy` |
| MFA on GitHub and SignPath | ⚠️ enable before applying |
| "Code signing policy" on home/download page | ✅ README + `/code-signing` |
| Artifact metadata (ProductName / ProductVersion) enforced | ⚠️ configure in SignPath |
| **Verifiable reputation for executables** | ⚠️ **the real risk** |

SignPath states it cannot sign binaries *"based on source code that nobody knows"*. A
brand-new project with no users may be rejected on reputation grounds. If so:

- **Microsoft Store (MSIX)** — the Store signs the package, so no SmartScreen warning; a
  Microsoft developer account (~19 USD once) and a review; needs MSIX packaging (extra
  tooling, Tauri does not emit MSIX natively).
- **Paid OV/EV certificate** — OV (~100–300 €/yr) removes "Unknown publisher"; **EV**
  (~300–600 €/yr) gives instant trust. Publisher name = certificate subject.

### How to apply

1. Enable **MFA** on GitHub and create the SignPath account with MFA.
2. Apply at <https://signpath.org/apply> with the repository URL
   (<https://github.com/ladospwm/lados>), the download page
   (<https://ladospwm.vercel.app/>) and a short description.
3. If accepted: create the SignPath project + signing policy, and store the CI secrets.

### Wiring (when accepted)

The release currently builds **and uploads** the installer in one step
(`tauri-apps/tauri-action`). Signing needs **build → sign → upload**:

1. Build without uploading (`uploadUpdaterJson: false`).
2. `signpath/github-action-submit-signing-request` with `SIGNPATH_API_TOKEN` /
   `SIGNPATH_ORG_ID`, `wait-for-completion: true`.
3. Upload the returned signed `.exe`/`.msi` and the updater `latest.json` to the release.

The commented sketch lives in `.github/workflows/release.yml` (search for
"Code signing (Windows) — SignPath Foundation").

## macOS (separate)

Gatekeeper warns about apps from an unidentified developer until the app is **notarized**
by Apple (Developer Program, 99 USD/yr). Same kind of friction, different mechanism; not
covered here.
