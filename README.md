# MicroTools

Fast, free, single-purpose developer tools that run entirely in your browser.

> 🔒 **100% local.** Every tool processes your input with JavaScript on your own device. Nothing you type, paste or drop is ever sent to a server.

No accounts, no sign-ups, no frameworks. Results update as you type, and every output has a one-click copy button. Dark mode is the default, with a light theme one click away.

## Tools

### General tools (`index.html`)

| Tool | What it does |
|---|---|
| **Luhn Validator** | Validates credit card and IMEI numbers as you type, detects the card type and shows the expected check digit. |
| **JSON Formatter** | Validates, beautifies or minifies JSON. Syntax errors are pinpointed to the exact line and column. |
| **Password Generator** | Cryptographically secure passwords (8–64 characters) with a strength meter and entropy estimate. |
| **UUID Generator** | RFC 4122 version 4 UUIDs, one or up to 1,000 at a time. |
| **Lorem Ipsum** | Placeholder text by paragraphs, sentences or words. |
| **Epoch Converter** | Unix timestamps to readable dates and back, with automatic seconds/ms/µs/ns detection. |
| **Base64 Encode/Decode** | Two-way, real-time conversion with full UTF-8 support and a URL-safe mode. |
| **Case Converter** | UPPERCASE, lowercase, Title Case, camelCase and Sentence case, all at once. |

### Flutter tools (`flutter/index.html`)

| Tool | What it does |
|---|---|
| **JSON to Dart** | Generates null-safe Dart model classes from JSON in four styles: plain, Equatable, json_serializable or freezed. Optional `copyWith()`, `toString()` and nullable fields. |
| **.env to Dart** | Turns a `.env` file into an XOR-obfuscated Dart config class, or a `String.fromEnvironment` class plus a `dart_defines.json` for `--dart-define-from-file`. |
| **Assets to Dart** | Drag and drop your `assets` folder to generate an `assets.dart` class (flat or nested by folder) and the matching `pubspec.yaml` entries. Only file names are read. Images are never opened. |

> **Note on the .env tool:** obfuscation is not encryption, and values passed with `--dart-define` can be extracted from a compiled app. Both keep secrets out of plain sight and out of git, but real secrets belong on a server. The tool shows this warning too.

## Tech stack

- **HTML + vanilla JavaScript.** No framework and no bundler. Pages load with plain `<script>` tags, so they work when opened directly from disk.
- **Tailwind CSS v3.4** compiled to a single static stylesheet with the Tailwind CLI.
- **Web Crypto API** for passwords, UUIDs and obfuscation keys.
- **Google AdSense** slots, which stay as styled placeholders until a real publisher ID is configured.

Node.js is only needed to rebuild the CSS. The site itself has no runtime dependencies.

## Project structure

```
├── index.html            General tools
├── flutter/index.html    Flutter tools
├── about.html            About page
├── privacy.html          Privacy policy
├── assets/
│   ├── css/styles.css    Compiled stylesheet (generated, don't edit by hand)
│   └── js/
│       ├── core.js       Shared helpers: clipboard, theme, navigation, JSON parsing, ads
│       ├── tools.js      General tools
│       └── flutter.js    Flutter tools
├── src/styles.css        Stylesheet source (edit this one)
├── tailwind.config.js
└── package.json
```

## Running locally

Open `index.html` in your browser. That's it, no server needed.

To change styles, install the dependencies once and rebuild the CSS:

```bash
npm install
npm run watch    # rebuilds assets/css/styles.css on every save
# or
npm run build    # one-off minified build
```

Rebuild whenever you use a Tailwind class that isn't used anywhere else yet; classes missing from the compiled stylesheet won't render. `assets/css/styles.css` is committed on purpose, so the site can be hosted without a build step.

## Adding a tool

Each page is a set of `<section class="tool-panel">` panels switched by the URL hash (`#json`, `#json-to-dart`, …).

1. Add a section to the page: `<section class="tool-panel" data-tool="your-id" hidden>…</section>`.
2. In the page's script (`tools.js` or `flutter.js`):
   - add `{ id: 'your-id', name: 'Your Tool', icon: '<svg path data>' }` to the `TOOLS` / `FLUTTER_TOOLS` list,
   - write an `initYourTool()` function,
   - call it in the **Boot** section at the bottom of the file.
3. Add the tool to the lists in `about.html` and `privacy.html`. If it saves settings in `localStorage`, list the key in the privacy policy as well.
4. Run `npm run build`.

Shared helpers in `core.js` include `$` / `$$` (query selectors), `store` (safe `localStorage`), `debounce`, `escapeText`, `hydrateCopyButtons` and `findJsonError`. Any `<button data-copy="#element-id">` automatically becomes a copy button.

## Deployment

The site is fully static. Any static host works: GitHub Pages, Netlify, Cloudflare Pages, or plain file hosting.

**GitHub Pages:** in the repository, go to **Settings → Pages**, choose **Deploy from a branch**, select `main` and `/ (root)`, and save.

Folder drag and drop works best when the site is served over `https://`. When pages are opened from disk, it works in Chrome and Edge. Firefox and Safari users can use the "choose a folder" button instead.

### Before going live

- Replace the AdSense publisher ID `ca-pub-XXXXXXXXXXXXXXXX` and the slot IDs (`1111111111`, `2222222222`, `3333333333`) in `index.html` and `flutter/index.html`. No ad requests are made until you do.
- Replace `contact@example.com` in `about.html` and `privacy.html`.
- Review `privacy.html` for your jurisdiction. It's an accurate template, not legal advice.

## Privacy

- All processing happens in the browser. There is no backend.
- A few preferences (theme, last tool used, tool options) are kept in `localStorage` on your device. Tool input is never stored.
- The only third-party code is Google's ad code. See [privacy.html](privacy.html) for the full policy.

You can check this yourself: open your browser's developer tools, switch to the **Network** tab and use any tool. Typing into a tool makes no requests.
