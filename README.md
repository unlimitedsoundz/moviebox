# MovieBox

A responsive MovieBox catalog and streaming interface. It loads TMDB movies and TV shows, filters for free viewing availability by region, and provides provider links when TMDB lists them. The default region is Nigeria; free options without ads are selected by default, with separate choices for ad-supported free and any availability. Search, rating, release-date sorting, genre/year filters, and on-demand title details are included. Results are fetched one TMDB page at a time; use the page controls to continue through available results. If TMDB is unavailable, it falls back to playable MP4 titles from Internet Archive's `feature_films` collection.

## Run it

Run `node server.js` and open `http://127.0.0.1:4173`. The server reads the TMDB key from `.env.local` and keeps it out of browser code. `.env.local` is excluded by `.gitignore`.

## Inbuilt Ad & Redirect Blocker

MovieBox includes an inbuilt shield that stops external redirects, aggressive popups, and tab hijacking during video playback. It uses modern HTML5 navigation interception (`window.navigation`), parent-level `beforeunload` guards, and `window.open` traps to prevent embedded stream players from hijacking or navigating the MovieBox window away, without triggering anti-sandbox embed blocks. The shield can be toggled via the shield pill in the player, the topbar shield button, or the settings dialog. Multiple stream servers (VidSrc, VidSrc CC, AutoEmbed, SmashyStream) and a safe reload button are also available directly in the player controls.

## Connect a catalog or media server

Choose **Connect a server** in the footer and enter a catalog endpoint that returns a JSON array. The app sends a bearer token if supplied. The endpoint must allow browser requests from this site (CORS), and video URLs must be playable by the browser (for example MP4 or HLS with a compatible player/server setup).

Example item:

```json
{
  "id": "film-001",
  "title": "Example Film",
  "year": 2025,
  "genre": "Drama",
  "rating": 8.1,
  "duration": "1h 42m",
  "poster": "https://media.example/poster.jpg",
  "description": "A short description.",
  "videoUrl": "https://media.example/film.mp4",
  "qualityUrls": {
    "1080": "https://media.example/film-1080.mp4",
    "720": "https://media.example/film-720.mp4"
  },
  "subtitlesUrl": "https://media.example/film-en.vtt",
  "subtitleLabel": "English",
  "subtitleLanguage": "en"
}
```

TMDB provides metadata and artwork, not playable movie streams. The movie detail panel loads additional details and cast; playback requires a stream URL from a media server you are authorized to use. Internet Archive records are contributed by different parties; check each record's rights and availability before use. TMDB requires the attribution shown in the site footer. Saved titles, server settings, and playback position are stored in this browser's local storage; they are not synced across devices.
