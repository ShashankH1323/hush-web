# Hush Web

Marketing + download site for **Hush**, voice dictation for Windows (hold a shortcut anywhere, speak, clean text is pasted into the focused app). Static, zero build, deployed on Vercel at https://hush-web-alpha.vercel.app.

## Structure

```
index.html        the whole page (nav, hero + demo, features, how it works, download CTA, footer)
app.js            nav, reveal-on-scroll, card spotlight, version.json enhancement, download toast, copy SHA-256
demo.js           hero demo: messy speech -> clean text with a canvas "Hush bar" (chat / email / code comment)
styles/           tokens, base, nav, hero, demo, sections
assets/           favicon.svg (+ favicon.ico fallback), apple-touch-icon.png, og-image.png
version.json      update manifest polled by the desktop app (GET /version.json). Do not change its shape.
vercel.json       cleanUrls + /downloads/:file redirect to the GitHub release
```

Design: dark graphite (`#0B0C0E`), mint accent (`#5EEAD4`), Geist + Geist Mono, frosted-but-opaque surfaces. Tokens mirror `docs/redesign/SPEC.md` §1–2 in the Hush app repo. Animations use transform/opacity only and respect `prefers-reduced-motion`.

## Release contract (do not break)

The release workflow in the Hush app repo publishes a version by rewriting **`index.html`** with these regexes, and by committing `version.json` and `vercel.json`:

- `href="[^"]*x64-setup\.exe"` -> the new NSIS installer URL
- `href="[^"]*x64_en-US\.msi"` -> the new MSI URL
- `Version \d+\.\d+\.\d+` -> `Version <new>` (plain text, keep it in a single text node)

So keep static download hrefs and "Version X.Y.Z" strings in `index.html`. At runtime `app.js` also refreshes hrefs (`[data-download]`, `[data-msi]`), version labels (`[data-version-text]`) and the SHA-256 copy button (`[data-copy]`) from `/version.json`; if that fetch fails the static markup is used.

## Local preview

```
python3 -m http.server 8000
```
