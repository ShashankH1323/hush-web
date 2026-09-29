# Hush Web

Marketing + download site for **Hush**, voice dictation for Windows (hold a shortcut anywhere, speak, clean text is pasted into the focused app). Static, zero build, deployed on Vercel at https://hush-web-alpha.vercel.app.

## Structure

```
index.html        the whole page (nav, hero + demo, features, how it works, download CTA, footer)
boot.js           1-line same-origin script: swaps .no-js for .js before first paint (keeps the CSP free of inline scripts)
app.js            nav, reveal-on-scroll, card spotlight, validated version.json enhancement, download toast
demo.js           hero demo: messy speech -> clean text with a canvas "Hush bar" (chat / email / code comment)
styles/           tokens, base, nav, hero, demo, sections
assets/           favicon.svg (+ favicon.ico fallback), apple-touch-icon.png, og-image.png, fonts/ (self-hosted Geist, SIL OFL)
version.json      update manifest polled by the desktop app (GET /version.json). Do not change its shape.
vercel.json       cleanUrls + /downloads/:file redirect to the GitHub release + security headers (CSP etc.)
```

Design: true-black base (`#050506`), cool neutral greys, one soft mint accent (`#7CCFC0`) used only for small highlights (logo dot, focus ring, caret, glows), white primary buttons, Geist + Geist Mono (self-hosted). Windows and cards are very light glass (about 5% white, `blur(16px) saturate(1.2)`, hairline border) over a few dim background glows; the demo window puts its blur on a `::before` layer so the `<canvas>` is never inside a `backdrop-filter` element. Animations use transform/opacity and respect `prefers-reduced-motion`.

## Release contract (do not break)

The release workflow publishes a version by rewriting **`index.html`** with these regexes, and by committing `version.json` and `vercel.json`:

- `href="[^"]*x64-setup\.exe"` -> the new NSIS installer URL
- `Version \d+\.\d+\.\d+` -> `Version <new>` (plain text, keep it in a single text node)

So keep static download hrefs and "Version X.Y.Z" strings in `index.html`. At runtime `app.js` also refreshes the hrefs (`[data-download]`) and version labels (`[data-version-text]`) from `/version.json`; if that fetch fails, or the manifest fails validation, the static markup is used. The download URL is only accepted when it is `https://github.com/ShashankH1323/hush-web/releases/download/...x64-setup.exe`, and the version only when it is strict `N.N.N`; values are written with `textContent`/`href`, never parsed as HTML.

There is no `.msi` link, checksum or copy UI on the page (the only actions are the Download buttons and the Features anchor). `version.json` still carries `msi_url` / `sha256` for the desktop updater.

## Security headers

`vercel.json` adds a `headers` block for `/(.*)`: a strict CSP (`default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'none'; frame-ancestors 'none'; object-src 'none'`), `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`, `X-Frame-Options` and `Cross-Origin-Opener-Policy`. The CSP is only this strict because the page has **no inline scripts, no inline `style=` attributes, no `innerHTML` and no third-party origins**. Keep it that way: put styles in `styles/*.css`, scripts in `.js` files, and use `textContent`/DOM APIs. `el.style.setProperty(...)` from JS is fine under this CSP.

## Local preview

```
python3 -m http.server 8000
```
