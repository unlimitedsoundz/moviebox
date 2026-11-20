# Installing MovieBox as a VIDAA OS WebApp on Hisense TV

MovieBox includes a dedicated **Hisense VIDAA OS 10-foot TV WebApp** (`/?tv=vidaa`), a Web App Manifest (`/manifest.json`), TV launcher icons (`/icon-192.png`, `/icon-512.png`, `/vidaa-thumb.png`), and a built-in installer page (`/vidaa.html`).

---

## Option 1: 1-Click Install via VIDAA Browser (`/vidaa.html`)
1. Open the **Browser** app on your Hisense VIDAA TV.
2. Navigate to your deployed MovieBox installer page:
   ```text
   https://<your-moviebox-domain>/vidaa.html
   ```
3. Press **OK** on **Install on Hisense TV** (uses `Hisense_installApp` when available in VIDAA OS).
4. Once installed, **MovieBox** appears as a standalone app tile on your VIDAA Home screen.

## Option 2: Install via Hisense VIDAA Debug Page (Works on All VIDAA Versions)
1. Open the **Browser** app on your Hisense TV.
2. Go to **`hisense://debug`** (or the VIDAA App Installer URL if your TV firmware uses `vidaahub.com`).
3. Enter your hosted MovieBox values (also displayed on `/vidaa.html`):
   - **App ID**: `moviebox_vidaa_app`
   - **App Name**: `MovieBox`
   - **App URL**: `https://<your-moviebox-domain>/?tv=vidaa`
   - **Thumbnail URL**: `https://<your-moviebox-domain>/vidaa-thumb.png`
   - **Icon URL (Small)**: `https://<your-moviebox-domain>/icon-192.png`
   - **Icon URL (Large)**: `https://<your-moviebox-domain>/icon-512.png`
4. Click **Install** — MovieBox will be pinned to your Hisense VIDAA Home launcher.

## Option 3: Instant Fullscreen Launch (No Sideloading Needed)
Bookmark **`https://<your-moviebox-domain>/?tv=vidaa`** in the Hisense VIDAA Browser — MovieBox automatically activates 10-foot VIDAA TV mode (`body.vidaa-tv`).

---

## Hisense VIDAA Remote Controls
| Remote Button | Action |
|---|---|
| **D-Pad Arrows** | Spatial navigation across rows, cards, search, and buttons |
| **OK / Enter** | Open & start playing immediately |
| **Back** (`461` / `10009`) | Close modal → exit player → return to Home |
| **Red** (`403`) | Open Search |
| **Green** (`404`) | Open My List |
| **Yellow** (`405`) | Open Films |
| **Blue** (`406`) | Open Series |
| **Play / Pause / Stop** | Control video playback |
