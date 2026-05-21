# @samardipmandal7364/widget-sdk

Embeddable AI design assistant widget. Drop it into any website or SPA with a single script tag or import.

---

## Install

**CDN (script tag):**

```html
<script src="https://unpkg.com/@samardipmandal7364/widget-sdk@1.0.0/dist/reih-widget.js" async></script>
```

**npm:**

```bash
npm install @samardipmandal7364/widget-sdk
```

---

## Quick Start

### 1. Script Tag (simplest)

```html
<script>
  window.reihWidgetConfig = {
    clientId: 'YOUR_CLIENT_ID',
    primaryColor: '#6C63FF',
  };
</script>
<script src="https://unpkg.com/@samardipmandal7364/widget-sdk@1.0.0/dist/reih-widget.js" async></script>
```

The widget auto-initializes and shows a floating trigger button.

### 2. Deferred / Programmatic Init

```html
<script>
  window.reihWidgetConfig = {
    clientId: 'YOUR_CLIENT_ID',
    autoInit: false,
  };
</script>
<script src="https://unpkg.com/@samardipmandal7364/widget-sdk@1.0.0/dist/reih-widget.js" async></script>

<script>
  document.getElementById('open-btn').addEventListener('click', () => {
    window.reihWidget.init();
  });
</script>
```

### 3. React / Next.js (Dynamic Import)

```jsx
"use client";

import { useCallback, useRef } from "react";

const WIDGET_SCRIPT_URL =
  "https://unpkg.com/@samardipmandal7364/widget-sdk@1.0.0/dist/reih-widget.js";

function loadWidgetScript() {
  return new Promise((resolve, reject) => {
    if (window.reihWidget?.configure) {
      resolve(window.reihWidget);
      return;
    }
    const script = document.createElement("script");
    script.src = WIDGET_SCRIPT_URL;
    script.async = true;
    script.onload = () =>
      window.reihWidget?.configure
        ? resolve(window.reihWidget)
        : reject(new Error("reihWidget not available after load"));
    script.onerror = () => reject(new Error("Failed to load widget script"));
    document.body.appendChild(script);
  });
}

export function useReihWidget() {
  const loadingRef = useRef(null);

  const openWidget = useCallback(async ({ mediaId, bearerToken } = {}) => {
    if (typeof window === "undefined") return;

    const config = {
      mode: "restyle",
      clientId: "YOUR_CLIENT_ID",
      apiBaseUrl: "https://api.reimaginehome.ai/v3",
      apiBaseUrlV2: "https://api.reimaginehome.ai/v2",
      wsBaseUrl: "wss://ws.reimaginehome.ai/prod",
      apiVersion: "v2",
      primaryColor: "#6C63FF",
      title: "REimagineHome",
      subtitle: "AI Design Assistant",
      hideTrigger: true,
      autoOpen: 1,
      solutionName: "VIRTUAL_STAGING",
      ...(mediaId ? { mediaId } : {}),
      ...(bearerToken ? { bearerToken } : {}),
    };

    try {
      if (!loadingRef.current) {
        window.reihWidgetConfig = { ...config, autoInit: false };
        loadingRef.current = loadWidgetScript();
      }
      const widget = await loadingRef.current;

      if (widget._mounted) widget.destroy();

      widget.configure(config);
      widget.init();
    } catch (error) {
      loadingRef.current = null;
      console.error("[ReihWidget] Failed to open:", error);
    }
  }, []);

  return { openWidget };
}
```

**Usage in a component:**

```jsx
function DesignButton({ mediaId, token }) {
  const { openWidget } = useReihWidget();
  return (
    <button onClick={() => openWidget({ mediaId, bearerToken: token })}>
      Open AI Designer
    </button>
  );
}
```

---

## Configuration

Pass via `window.reihWidgetConfig` or `.configure()`:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `clientId` | `string` | **required** | Your client identifier _(not needed when `mode` is `"widget-v4"`)_ |
| `mode` | `string` | `"chat"` | `"chat"`, `"restyle"`, or `"widget-v4"` / `"WIDGET-V4"` (V4 Studio modal UI) |
| `v4Studio` | `object` | — | Optional props forwarded to `StudioModal` (`rooms`, `pills`, `historyItems`, …) |
| `onV4StudioClose` | `function` | — | Callback when user closes V4 Studio (top-bar close) |
| `v4StudioClosedHint` | `string` | — | Text shown after close (shown with reopen button) |
| `v4StudioReopenLabel` | `string` | — | Label for reopen button after close |
| `apiBaseUrl` | `string` | `"https://api.reimaginehome.ai/v3"` | V3 API endpoint |
| `apiBaseUrlV2` | `string` | derived from `apiBaseUrl` | V2 API endpoint (for generation) |
| `wsBaseUrl` | `string` | `"wss://ws.reimaginehome.ai/prod"` | WebSocket endpoint for real-time updates |
| `apiVersion` | `string` | `"v3"` | `"v2"` or `"v3"` — controls which generation flow is used |
| `bearerToken` | `string` | — | Pre-authenticated JWT (skips widget session init) |
| `mediaId` | `string` | — | Pre-load a specific media/image for restyle |
| `primaryColor` | `string` | `"#6C63FF"` | Brand accent color (hex) |
| `title` | `string` | `"REimagineHome"` | Header title |
| `subtitle` | `string` | `"AI Design Assistant"` | Header subtitle |
| `welcomeTitle` | `string` | `"Welcome!"` | Welcome screen heading |
| `welcomeDescription` | `string` | `"Upload an image..."` | Welcome screen body |
| `placeholder` | `string` | `"Tell us what to change..."` | Input placeholder |
| `position` | `string` | `"bottom-right"` | `"bottom-right"` or `"bottom-left"` |
| `hideTrigger` | `boolean` | `false` | Hide the built-in floating button |
| `autoOpen` | `boolean \| number` | `false` | Auto-open on load. Number = delay in ms |
| `autoInit` | `boolean` | `true` | Auto-initialize on script load |
| `triggerIcon` | `string` | built-in SVG | Custom trigger icon URL |
| `logoUrl` | `string` | — | Logo shown in chat header |
| `solutionName` | `string` | `"REDESIGN_FURNISHED_ROOM"` | Generation solution type |
| `poweredByText` | `string \| false` | `"REimagineHome"` | Footer text. `false` hides it |

---

## API

All methods are available on `window.reihWidget`:

### `configure(config)`

Update config. Chainable. Can be called before or after `init()`.

```js
window.reihWidget.configure({ primaryColor: '#FF5733' });
```

### `init(overrides?)`

Mount the widget into the page (Shadow DOM). Optional config overrides.

```js
window.reihWidget.init({ clientId: 'my-id' });
```

### `destroy()`

Unmount and clean up all DOM, timers, and WebSocket connections.

```js
window.reihWidget.destroy();
```

### `open()`

Programmatically open the panel (initializes first if needed).

```js
window.reihWidget.open();
```

### `on(event, callback)` / `off(event, callback)`

Subscribe/unsubscribe to widget lifecycle events.

```js
window.reihWidget.on('ready', (detail) => console.log(detail.mode));
```

---

## Events

| Event | When | Callback / `detail` |
|-------|------|---------------------|
| `ready` | Widget mounted into DOM | `{ mode }` — normalized mode string (`"chat"`, `"restyle"`, `"widget-v4"`, …) |
| `destroyed` | Widget removed from DOM | `{}` |

Events also fire as `CustomEvent` on `window`:

```js
window.addEventListener('reihwidget:ready', (e) => {
  console.log(e.detail.mode); // e.g. "widget-v4"
});
window.addEventListener('reihwidget:media-loaded', (e) => {
  console.log(e.detail.url, e.detail.mediaId);
});
```

---

## Modes

### Chat Mode (`mode: "chat"`)

Full conversational UI. User uploads an image, chats with the AI, and receives generated designs via WebSocket.

### Restyle Mode (`mode: "restyle"`)

Overlay-based flow optimized for a single image restyle. Pass `mediaId` and `bearerToken` to skip session initialization and jump straight into generation.

```js
window.reihWidget.configure({
  mode: 'restyle',
  mediaId: 'abc123',
  bearerToken: 'eyJ...',
  apiVersion: 'v2',
  solutionName: 'VIRTUAL_STAGING',
  hideTrigger: true,
  autoOpen: 1,
}).init();
```

### V4 Studio Mode (`mode: "widget-v4"`)

Renders the V4 Studio modal inside the same Shadow DOM mount as other modes. **`clientId` is optional** (no widget session/API is initialized). For `widget-v4`, **`autoOpen`** defaults to **`true`** and **`hideTrigger`** to **`true`** unless you set them explicitly in config (needed because SDK defaults otherwise keep the modal “closed”). Use `v4Studio: { … }` to override rooms, pills, labels, etc. Set **`autoOpen: false`** to start collapsed (reopen UI is fullscreen so it stays visible).

```js
window.reihWidget.configure({ mode: 'widget-v4' }).init();

// Start collapsed (explicit):
window.reihWidget.configure({
  mode: 'widget-v4',
  autoOpen: false,
}).init();
```

#### Troubleshooting `widget-v4` on another site

1. **Use the main bundle** — `dist/reih-widget.js` (or ESM equivalent). Do **not** load only `v4-studio.js`; that is a standalone demo bundle with different wiring.

2. **Script order** — `window.reihWidgetConfig = { … }` must run **before** the SDK script **evaluates**. With **`async`**, an inline config later on the page can run **too late** (race). Prefer either:
   - an inline `<script>` config block **immediately above** a non-async widget `<script src="…">`, or  
   - **`defer`** on the widget script **after** an inline config `<script>` (document order preserved).

   Bundlers / SPAs: often `import '@scope/widget-sdk'` runs **before** you assign `reihWidgetConfig`. Call **`window.reihWidget.configure({ mode: 'widget-v4' }).init()`** yourself after your config is ready (and omit relying on global auto-init).

3. **`autoInit`** — If you set **`autoInit: false`**, you must call **`window.reihWidget.init()`** (or **`configure(...).init()`**) yourself.

4. **Published version** — Confirm `npm ls @samardipmandal7364/widget-sdk` matches a release that includes `widget-v4` support; rebuild and bump version if you ship from Git only.

5. **Verify mount** — After load, **`document.getElementById('reih-widget-host')`** should exist. Listen for **`reihwidget:ready`** and log **`event.detail.mode`**; expect **`widget-v4`**.

---

## Authentication

Two authentication strategies:

1. **Widget session (default)** — The SDK calls `/widget/session` with your `clientId` and the page domain. The backend returns a short-lived JWT. Your domain must be whitelisted.

2. **Bearer token (pre-auth)** — Pass `bearerToken` in config to skip session creation. Useful when your app already has an authenticated user. The token is sent as `Authorization: Bearer <token>` on all API calls.

---

## Fullscreen Override (CSS)

To make the panel fill the viewport (e.g., in a modal context), inject a style into the widget's Shadow DOM:

```js
const css = `
  .reih-panel {
    width: 100vw !important;
    height: 100vh !important;
    max-width: 100vw !important;
    max-height: 100vh !important;
    inset: 0 !important;
    border-radius: 0 !important;
  }
`;
const style = document.createElement('style');
style.textContent = css;
window.reihWidget._shadowRoot.appendChild(style);
```

---

## Content Security Policy

If your site uses CSP headers:

```
script-src 'self' https://unpkg.com;
connect-src 'self' https://api.reimaginehome.ai wss://ws.reimaginehome.ai;
img-src 'self' https://cdn-2.reimaginehome.ai https://*.amazonaws.com;
style-src 'self' 'unsafe-inline';
```

---

## Browser Support

| Browser | Minimum |
|---------|---------|
| Chrome | 63+ |
| Firefox | 63+ |
| Safari | 10+ |
| Edge | 79+ |
| iOS Safari | 10+ |

Requires Shadow DOM v1. No IE support.

---

## Technical Details

- **~12 KB** gzipped bundle (Preact runtime)
- Renders inside a **closed Shadow DOM** — no CSS conflicts with host page
- Singleton — only one widget instance per page
- WebSocket with auto-reconnect and heartbeat
- Session stored in `localStorage` (30-min TTL, auto-refresh)

---

## License

MIT
