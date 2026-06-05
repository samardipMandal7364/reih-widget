# REimagineHome Widget SDK

Embeddable AI design widget for tenant websites. Iframe-based architecture — a thin
vanilla JS loader on the tenant page, full Preact app inside a sandboxed iframe.

---

## Architecture

```
Tenant page
├── <script src="reih-loader.js">       (2.8 KB gz, vanilla JS, no dependencies)
│   ├── Renders trigger button on host page
│   └── Creates iframe → widget.reimaginehome.ai/embed.html
│       └── Preact app (~40 KB gz)
│           ├── API calls (same-origin, no CORS)
│           ├── WebSocket connections
│           └── Session in iframe localStorage
│
└── postMessage ↔ for open/close/config/events
```

**Tenant CSP requirement:** `script-src <cdn>` + `frame-src <widget-domain>` — that's it.

---

## Install

**CDN (recommended for tenants):**

```html
<script src="https://cdn.reimaginehome.ai/widget/reih-loader.js" async></script>
```

**npm:**

```bash
npm install @samardipmandal7364/widget-sdk
```

---

## Quick Start

```html
<script>
  window.reihWidgetConfig = {
    tenantId: 'YOUR_TENANT_ID',
    primaryColor: '#6C63FF',
  };
</script>
<script src="https://cdn.reimaginehome.ai/widget/reih-loader.js" async></script>
```

The widget auto-initializes, shows a floating chat button, and opens inside a
sandboxed iframe when clicked.

---

## Config Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `tenantId` | string | — | **Required.** Issued from tenant dashboard. |
| `mode` | string | `'chat'` | `'chat'`, `'restyle'`, or `'widget-v4'` |
| `primaryColor` | string | `'#6C63FF'` | Brand color for trigger + widget accents |
| `logoUrl` | string | — | Header / overlay logo image URL |
| `fontFamily` | string | system UI stack | Widget body font (CSS font-family value) |
| `fontFamilyHeading` | string | — | Heading / serif font (V4 Studio) |
| `secondaryColor` | string | — | Accent + gradient end color |
| `textPrimary` | string | `'#0F0F31'` | Primary text color |
| `textSecondary` | string | `'#6b7280'` | Secondary text color |
| `widgetTitle` | string | — | Chat header title (alias: `title`) |
| `branding` | object | — | Nested override object (see below) |
| `position` | string | `'bottom-right'` | `'bottom-right'` or `'bottom-left'` |
| `hideTrigger` | boolean | `false` | Hide trigger button, call `open()` manually |
| `autoOpen` | boolean / number | `false` | Auto-open on load. Number = delay in ms. |
| `autoInit` | boolean | `true` | Set `false` to defer until `reihWidget.init()` |
| `embedBaseUrl` | string | `'https://widget.reimaginehome.ai'` | Override for dev/staging |
| `apiBaseUrl` | string | — | REST API base URL |
| `apiBaseUrlV2` | string | — | V2 API base URL |
| `wsBaseUrl` | string | — | WebSocket URL |
| `bearerToken` | string | — | Pre-authenticated JWT (skip anonymous session) |
| `mediaId` | string | — | Pre-selected media for restyle mode |
| `triggerLabel` | string | `'Restyle with AI'` | Restyle trigger button text |
| `triggerIcon` | string | — | Custom icon URL for chat FAB |
| `v4Studio` | object | `{}` | V4 Studio config (rooms, pills, etc.) |

### Branding object (`branding` or flat keys)

Pass on `window.reihWidgetConfig`, `init(overrides)`, or `configure()`. Nested `branding` wins over top-level keys.

| Field | Maps to |
|-------|---------|
| `primaryColor` | Buttons, headers, accents (`--reih-primary`, `--tenant-primary`) |
| `secondaryColor` | Gradient end, teal accent |
| `logoUrl` | Chat / restyle header logo |
| `fontFamily` | Widget + FAB font |
| `fontFamilyHeading` | V4 Studio serif headings |
| `widgetTitle` | Header title |
| `textPrimary` / `textSecondary` | Body text CSS variables |
| `gradientBorder` | Custom gradient string (optional) |

Dashboard defaults from the backend can be overridden per page via `init()` / `configure()`.

---

## JavaScript API

```javascript
// Programmatic init (if autoInit: false)
window.reihWidget.init();

// Open / close
window.reihWidget.open();
window.reihWidget.close();

// Update config at runtime (including branding)
window.reihWidget.configure({ primaryColor: '#FF6B6B' });

// Init with full branding override (flat or nested `branding` object)
window.reihWidget.init({
  tenantId: 'YOUR_TENANT_ID',
  branding: {
    primaryColor: '#E11D48',
    secondaryColor: '#BE123C',
    logoUrl: 'https://cdn.example.com/logo.svg',
    fontFamily: '"Inter", system-ui, sans-serif',
    fontFamilyHeading: 'Georgia, serif',
    widgetTitle: 'Acme Design Studio',
    textPrimary: '#1a1a2e',
    textSecondary: '#64748b',
  },
});

// Tear down completely
window.reihWidget.destroy();

// Listen to events
window.reihWidget.on('ready', (detail) => console.log('Ready:', detail.mode));
window.reihWidget.on('media-loaded', (detail) => console.log('Media:', detail.url));

// DOM events
window.addEventListener('reihwidget:ready', (e) => console.log(e.detail));
```

---

## Integration Examples

### Deferred / Programmatic

```html
<script>
  window.reihWidgetConfig = {
    tenantId: 'YOUR_TENANT_ID',
    autoInit: false,
    hideTrigger: true,
  };
</script>
<script src="https://cdn.reimaginehome.ai/widget/reih-loader.js" async></script>

<button onclick="window.reihWidget.init(); window.reihWidget.open();">
  Open AI Studio
</button>
```

### Restyle with Pre-Auth

```html
<script>
  window.reihWidgetConfig = {
    tenantId: 'YOUR_TENANT_ID',
    mode: 'restyle',
    bearerToken: '<jwt-from-your-backend>',
    mediaId: '<media-id>',
    hideTrigger: true,
    autoOpen: false,
    embedBaseUrl: 'https://widget.reimaginehome.ai',
  };
</script>
<script src="https://cdn.reimaginehome.ai/widget/reih-loader.js" async></script>

<button onclick="window.reihWidget.open()">Restyle this property</button>
```

### React / Next.js

```jsx
"use client";
import { useCallback, useRef } from "react";

const LOADER_URL = "https://cdn.reimaginehome.ai/widget/reih-loader.js";

function loadLoader() {
  return new Promise((resolve, reject) => {
    if (window.reihWidget?.init) return resolve(window.reihWidget);
    const s = document.createElement("script");
    s.src = LOADER_URL;
    s.async = true;
    s.onload = () =>
      window.reihWidget ? resolve(window.reihWidget) : reject(new Error("Loader failed"));
    s.onerror = () => reject(new Error("Failed to load widget loader"));
    document.body.appendChild(s);
  });
}

export function useReihWidget() {
  const loaded = useRef(null);

  const openWidget = useCallback(async (overrides = {}) => {
    if (typeof window === "undefined") return;

    const config = {
      tenantId: "YOUR_TENANT_ID",
      mode: "restyle",
      hideTrigger: true,
      ...overrides,
    };

    if (!loaded.current) {
      window.reihWidgetConfig = { ...config, autoInit: false };
      loaded.current = loadLoader();
    }

    const widget = await loaded.current;
    widget.configure(config);
    widget.init();
    widget.open();
  }, []);

  const closeWidget = useCallback(() => {
    window.reihWidget?.close();
  }, []);

  return { openWidget, closeWidget };
}
```

---

## Events

| Event | When | Detail |
|-------|------|--------|
| `ready` | Widget mounted inside iframe | `{ mode }` |
| `media-loaded` | Media fetched from API | `{ url, mediaId, media }` |
| `destroyed` | Widget torn down | `{}` |

Events fire both as callbacks (`widget.on(name, cb)`) and DOM events (`reihwidget:<name>`).

---

## Build Outputs

| File | Description |
|------|-------------|
| `dist/reih-loader.js` | Thin loader — runs on tenant page (2.8 KB gz) |
| `dist/reih-embed.js` | Preact app — runs inside iframe (~40 KB gz) |
| `embed.html` | HTML shell for the iframe |

---

## CSP (Content Security Policy)

Tenants only need two directives:

```
script-src 'self' https://cdn.reimaginehome.ai;
frame-src https://widget.reimaginehome.ai;
```

All API calls, WebSocket, images, and styles run inside the iframe on the widget domain.

---

## Local Development

```bash
npm install
npm run build
npm run serve          # http://localhost:3333

# Demos:
#   http://localhost:3333/demo/hybrid-chat.html
#   http://localhost:3333/demo/hybrid-restyle.html
#   http://localhost:3333/demo/hybrid-v4.html
```

For watch mode:

```bash
npm run dev            # rebuilds on file change
npm run serve          # in another terminal
```

Demo pages use `embedBaseUrl: 'http://localhost:3333'` to point the iframe at
the local `embed.html`.

---

## Deployment

### Widget domain (your infra)

```
widget.reimaginehome.ai/
├── embed.html          ← from repo root (update script src to ./reih-embed.js)
└── reih-embed.js       ← dist/reih-embed.js
```

Headers: `Content-Security-Policy: frame-ancestors *;`

### CDN (for the loader)

```
cdn.reimaginehome.ai/widget/reih-loader.js  ← dist/reih-loader.js
```

---

## Project Structure

```
src/
├── loader.js           ← Vanilla JS loader (runs on tenant page)
├── embed.js            ← Preact iframe entry point
├── components/         ← UI components (ChatPanel, RestyleOverlay, etc.)
├── utils/              ← API client, WebSocket, session, helpers
├── styles/             ← Widget CSS
├── v3/                 ← Restyle v3 components (MediaChatModal port)
└── v4/                 ← V4 Studio components

demo/
├── hybrid-chat.html    ← Chat mode demo
├── hybrid-restyle.html ← Restyle mode demo
├── hybrid-v4.html      ← V4 Studio demo
├── env.example.js      ← Environment config template
└── env.js              ← Local dev config (gitignored)

embed.html              ← iframe HTML shell
```

---

## Docs

| Document | Contents |
|----------|----------|
| [HYBRID_MIGRATION.md](./HYBRID_MIGRATION.md) | Architecture details, postMessage protocol, migration guide |
| [BACKEND_SPEC.md](./BACKEND_SPEC.md) | Production backend spec — AWS infra, DB schemas, JWT auth, analytics, scaling |
| [TENANT_DASHBOARD_SPEC.md](./TENANT_DASHBOARD_SPEC.md) | Tenant portal — pricing, analytics, API keys, billing, team |

---

## Browser Support

| Browser | Minimum |
|---------|---------|
| Chrome | 63+ |
| Firefox | 63+ |
| Safari | 10+ |
| Edge | 79+ |
| iOS Safari | 10+ |

---

## License

MIT
