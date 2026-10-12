# MicroTools

Fast, free, single-purpose developer tools that run entirely in your browser.

> 🔒 **100% local.** Every tool processes your input with JavaScript on your own device. Nothing you type, paste or drop is ever sent to a server.

No accounts, no sign-ups, no frameworks. Results update as you type, and every output has a one-click copy button. Dark mode is the default, with a light theme one click away.

## Tools

### General tools (`index.html`)

| Tool                     | What it does                                                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Luhn Validator**       | Validates credit card and IMEI numbers as you type, detects the card type and shows the expected check digit.                                                                                                                  |
| **Test Card Generator**  | Luhn-valid test card numbers with correct prefixes and lengths for Visa, Mastercard, Amex, Discover, JCB, Diners Club and UnionPay, with optional fake expiry/CVV. Output as a list, CSV or JSON. Test data only: not real, chargeable cards. |
| **JSON Formatter**       | Validates, beautifies or minifies JSON. Syntax errors are pinpointed to the exact line and column.                                                                                                                             |
| **YAML ⇄ JSON**          | Two-way YAML/JSON conversion as you type, with line and column for errors. |
| **JWT Decoder**          | Decodes header and payload, shows exp/iat/nbf, and verifies HS256–512, RS256–512, PS256–512 and ES256–512 signatures with a secret or PEM key. |
| **Password Generator**   | Cryptographically secure passwords (8–64 characters) with a strength meter and entropy estimate.                                                                                                                               |
| **RSA Keys (PEM)**       | Generates RSA key pairs (2048–4096-bit) in PEM format, or imports your own. Encrypt (RSA-OAEP) and verify signatures with the public key; decrypt and sign (PKCS#1 v1.5 or PSS) with the private key. Compatible with OpenSSL. |
| **Hash Generator**       | MD5, SHA-1, SHA-256, SHA-384 and SHA-512 (and HMACs) of text or files. |
| **UUID Generator**       | RFC 4122 version 4 UUIDs, one or up to 1,000 at a time.                                                                                                                                                                        |
| **Lorem Ipsum**          | Placeholder text by paragraphs, sentences or words.                                                                                                                                                                            |
| **Epoch Converter**      | Unix timestamps to readable dates and back, with automatic seconds/ms/µs/ns detection.                                                                                                                                         |
| **Base64 Encode/Decode** | Two-way, real-time conversion with full UTF-8 support and a URL-safe mode.                                                                                                                                                     |
| **Base64 Image Viewer**  | Previews a Base64 string or `data:` URI as an image. The format is detected from the bytes (PNG, JPEG, GIF, WebP, AVIF, BMP, ICO, SVG, plus TIFF/HEIC where the browser supports them). Images are shown in an `<img>`, so SVG scripts never run. |
| **Image Resizer**        | Resize, convert and compress images to JPEG, WebP or PNG with a quality slider. |
| **QR Code Generator**    | Text, URL or Wi-Fi QR codes with error-correction and colour options; PNG or SVG download. |
| **URL Encode & Parse**   | Percent-encode/decode, and split a URL into parts with editable query parameters. |
| **Regex Tester**         | Live JavaScript regex matching with highlighting, capture groups, named groups and replace preview. Runaway patterns are stopped after 2 seconds. |
| **Diff Checker**         | Line, word or character diffs with collapsed unchanged sections. |
| **Case Converter**       | UPPERCASE, lowercase, Title Case, camelCase and Sentence case, all at once.                                                                                                                                                    |
| **Whitespace Remover**   | Removes spaces, tabs, line breaks and invisible characters (non-breaking and zero-width spaces, BOM) from long text such as keys, tokens or Base64. Shows exactly what was removed. |

### Flutter tools (`flutter/index.html`)

| Tool               | What it does                                                                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JSON to Dart**   | Generates null-safe Dart model classes from JSON in four styles: plain, Equatable, json_serializable or freezed. Optional `copyWith()`, `toString()` and nullable fields.                    |
| **.env to Dart**   | Turns a `.env` file into an XOR-obfuscated Dart config class, or a `String.fromEnvironment` class plus a `dart_defines.json` for `--dart-define-from-file`.                                  |
| **Assets to Dart** | Drag and drop your `assets` folder to generate an `assets.dart` class (flat or nested by folder) and the matching `pubspec.yaml` entries. Only file names are read. Images are never opened. |
| **App Icon Generator** | One image to every Android mipmap, iOS AppIcon (no alpha channel, matching `flutter create`) and web icon, as a zip laid out like a Flutter project. |
| **Color to Flutter**   | HEX/RGB/HSL/`Color(0x…)` to every Flutter `Color` constructor, plus a `MaterialColor` swatch. |
| **ColorScheme Generator** | Material 3 light/dark schemes identical to `ColorScheme.fromSeed` for every `DynamicSchemeVariant`; outputs fromSeed or explicit `ColorScheme` code. |
| **ARB Converter**      | CSV (comma, semicolon or tab) or JSON to `.arb` files for `gen-l10n`, with placeholders declared; ARB back to CSV for translators. |

> **Note on the .env tool:** obfuscation is not encryption, and values passed with `--dart-define` can be extracted from a compiled app. Both keep secrets out of plain sight and out of git, but real secrets belong on a server. The tool shows this warning too.

## Tech stack

- **Static HTML pages** generated by a small build script: a home page with search and categories, one page per tool (`tools/<tool>.html`), a Flutter landing page, About and Privacy. They work on any static host and when opened directly from disk.
- **Vanilla JavaScript ES modules**, bundled per page with [esbuild](https://esbuild.github.io/), so each tool page loads only its own code.
- **Tailwind CSS v3.4** compiled to a single stylesheet. Design: deep navy with an electric blue → violet accent, dark mode by default, subtle motion that respects the "reduce motion" system setting.
- **Web Crypto API** for passwords, UUIDs, RSA keys, JWT signatures, hashes and obfuscation keys.
- **Four small open-source libraries**, bundled into `assets/js/vendor/` and served from the site itself (never a CDN), loaded only when a tool needs them: [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT), [js-yaml](https://github.com/nodeca/js-yaml) (MIT), [jsdiff](https://github.com/kpdecker/jsdiff) (BSD-3-Clause) and Google's [material-color-utilities](https://github.com/material-foundation/material-color-utilities) (Apache-2.0), the same color algorithm Flutter uses.
- **Google AdSense**: one unit below each tool, a tall sticky unit in the right column on wide screens, and one above the footer. Slots reserve their space so pages don't jump, and collapse when there is no ad.

Node.js is only needed to build. The site itself needs no server.

## Project structure

```
├── index.html, about.html, privacy.html   Generated pages (don't edit by hand)
├── tools/*.html                           Generated tool pages
├── flutter/index.html                     Generated Flutter landing page
├── assets/
│   ├── css/styles.css                     Generated stylesheet
│   ├── js/pages/*.js                      Generated per-page scripts
│   ├── js/vendor/*.js                     Bundled libraries (`npm run vendor`)
│   └── favicon.svg
├── src/
│   ├── registry.mjs     Every tool: page name, category, summary, keywords, icon, script
│   ├── site.mjs         Site name, domain, AdSense publisher and slot IDs
│   ├── tools/*.html     The UI of each tool (inserted into the tool page)
│   ├── pages/*.html     About and Privacy content
│   ├── js/lib/          Shared code: core helpers, page layout (⌘K search, menu), binary helpers
│   ├── js/tools/        One module per tool
│   ├── js/pages/        Home and static page scripts
│   ├── styles.css       Stylesheet source
│   └── vendor/          Entry files for the bundled libraries
├── scripts/build.mjs    Page templates (header, footer, sidebar, ads) and the build
├── ads.txt, robots.txt  Generated (sitemap.xml too, once a domain is set)
├── tailwind.config.js
└── package.json
```

## Building

```bash
npm install
npm run build    # pages + scripts + stylesheet, in about a second
```

Edit the files in `src/` (and `scripts/build.mjs` for the shared layout), then run `npm run build`. The generated files are committed on purpose, so the site can be hosted without a build step. After updating a library version in `package.json`, also run `npm run vendor`.

When you have a domain, set `url` in `src/site.mjs` and rebuild: pages get canonical and Open Graph URLs, and `sitemap.xml` is generated.

## Adding a tool

1. Create the tool's UI in `src/tools/<slug>.html` (copy an existing one for the structure and classes).
2. Create `src/js/tools/<module>.js` exporting an `init…()` function that wires up the UI. Import helpers from `../lib/core.js` (`$`, `$$`, `store`, `debounce`, `escapeText`, `hydrateCopyButtons`, `loadVendor`, …). Any `<button data-copy="#element-id">` becomes a copy button automatically.
3. Add an entry to `TOOLS` in `src/registry.mjs` with the slug, category, summary, keywords, icon, module and init function.
4. Add the tool to `src/pages/about.html` and `src/pages/privacy.html`. If it saves settings in `localStorage`, list the key in the privacy policy.
5. Run `npm run build`. The page, its script, the home card, sidebar entry and quick-search entry are all generated.

Old links such as `index.html#json` and `flutter/index.html#json-to-dart` redirect to the new tool pages.

## Deployment

The site is fully static. Any static host works: GitHub Pages, Netlify, Cloudflare Pages, or plain file hosting. Upload everything except `node_modules/`.

**GitHub Pages:** in the repository, go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.

Folder drag and drop works best when the site is served over `https://`. When pages are opened from disk, it works in Chrome and Edge. Firefox and Safari users can use the "choose a folder" button instead.

## Privacy

- All processing happens in the browser. There is no backend.
- A few preferences (theme and tool options) are kept in `localStorage` on your device. Tool input is never stored.
- The only third-party code is Google's ad code. See [privacy.html](privacy.html) for the full policy.

You can check this yourself: open your browser's developer tools, switch to the **Network** tab and use any tool. Typing into a tool makes no requests.
