# Upload-First & WebSocket Integration

This guide covers two common embed patterns:

1. **Upload an image on the host site first**, then open the widget with that media already loaded.
2. **Configure WebSocket URLs per tenant/environment** and understand how session auth ties in.

For general setup (script tag, `clientId`, theming), see [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md).

---

## Table of Contents

1. [Upload first, then open widget](#1-upload-first-then-open-widget)
   - [Path A: Logged-in host app (recommended)](#path-a-logged-in-host-app-recommended)
   - [Path B: Anonymous public embed](#path-b-anonymous-public-embed)
2. [WebSocket per tenant / session](#2-websocket-per-tenant--session)
3. [Quick reference](#quick-reference)
4. [Related demos](#related-demos)

---

## 1. Upload first, then open widget

The SDK does **not** include a file picker in chat mode today (`ChatInput` is text-only). For “image first, then widget,” upload on the **host site** (or via widget REST APIs for anonymous users), then pass `mediaId` into the widget before calling `open()`.

### Path A: Logged-in host app (recommended)

Use this when your site already authenticates users (Cognito / main REIH app). Upload with your existing v2/v3 media APIs, then configure the widget with the returned `mediaId`.

**Flow**

```
User picks image on host site
    → Host calls REIH upload API
    → Host receives mediaId
    → Host configures widget (bearerToken + mediaId)
    → User clicks CTA → reihWidget.open()
    → Widget loads GET /media/{mediaId} and shows restyle/chat UI
```

**Configuration**

```javascript
window.reihWidgetConfig = {
  mode: 'restyle',
  clientId: 'YOUR_CLIENT_ID',
  bearerToken: idTokenFromYourAuth,  // skips POST /widget/session
  mediaId: uploadedMediaId,
  propertyImage: 'https://cdn.example.com/preview.jpg', // optional instant preview
  apiBaseUrl: 'https://dev-api.reimaginehome.ai/v3',
  apiBaseUrlV2: 'https://dev-api.reimaginehome.ai/v2',
  apiVersion: 'v2',
  solutionName: 'REDESIGN_FURNISHED_ROOM',
  designTheme: 'Modern',
  designingFor: 'Homeowners',
  hideTrigger: true,
  autoInit: true,
};
```

**Open after upload**

```javascript
async function onPhotoSelected(file) {
  const mediaId = await yourApp.uploadToReih(file);

  window.reihWidget.configure({
    bearerToken: yourApp.getIdToken(),
    mediaId,
    propertyImage: URL.createObjectURL(file),
  });

  if (!window.reihWidget._mounted) {
    window.reihWidget.init();
  }
}

document.getElementById('restyle-btn').addEventListener('click', () => {
  if (!mediaId) {
    alert('Please upload a photo first');
    return;
  }
  window.reihWidget.open();
});
```

**Listen for media loaded** (update listing image, etc.):

```javascript
window.addEventListener('reihwidget:media-loaded', (e) => {
  const { url, mediaId, media } = e.detail;
  console.log('Media ready', url, mediaId);
});
```

With `bearerToken` set, the SDK **skips** `POST /widget/session` and uses your token for `/media/{id}` and generation APIs. See `demo/restyle.html` and `demo/env.example.js`.

---

### Path B: Anonymous public embed

For visitors without login, use the **widget session** API, upload via **widget upload**, then open the widget.

#### Step 1 — Create widget session

```javascript
const sessionRes = await fetch('https://dev-api.reimaginehome.ai/v3/widget/session', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    domain: window.location.hostname,
    client_id: 'YOUR_WIDGET_CLIENT_ID',
  }),
});

const { session_id, media_id, token } = await sessionRes.json();
```

#### Step 2 — Upload image

```javascript
const form = new FormData();
form.append('image', file);
form.append('session_id', session_id);

await fetch('https://dev-api.reimaginehome.ai/v3/widget/upload', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` },
  body: form,
});
```

> `uploadImage()` exists in the SDK source (`src/utils/api.js`) but is not yet exposed on `window.reihWidget`. Call the REST endpoint from the host page as shown above.

#### Step 3 — Open widget

**Restyle / direct auth:** pass the widget token and `media_id` if your backend accepts the widget JWT for media operations.

**Chat mode:** chat `App` does not read `config.mediaId` on init. Prime browser storage so the widget reuses the same session:

```javascript
localStorage.setItem('reih_widget_session', JSON.stringify({
  sessionId: session_id,
  mediaId: media_id,
  ts: Date.now(),
}));

window.reihWidget.configure({
  clientId: 'YOUR_WIDGET_CLIENT_ID',
  apiBaseUrl: 'https://dev-api.reimaginehome.ai/v3',
  wsBaseUrl: 'wss://your-tenant-ws-url/dev',
  apiVersion: 'v3',
  hideTrigger: true,
});

window.reihWidget.init();
window.reihWidget.open();
```

On open, chat mode restores `sessionId` / `mediaId` from `localStorage` and calls `/widget/session/refresh` instead of creating a new session.

---

### Full HTML example (host upload + restyle)

```html
<input type="file" id="photo" accept="image/*" />
<button id="restyle">Restyle with AI</button>

<script>
  window.reihWidgetConfig = {
    mode: 'restyle',
    clientId: 'YOUR_CLIENT_ID',
    apiBaseUrl: 'https://dev-api.reimaginehome.ai/v3',
    apiBaseUrlV2: 'https://dev-api.reimaginehome.ai/v2',
    apiVersion: 'v2',
    hideTrigger: true,
    autoInit: true,
  };
</script>
<script src="https://unpkg.com/@samardipmandal7364/widget-sdk@1.0.0/dist/reih-widget.js"></script>
<script>
  let readyMediaId = null;

  document.getElementById('photo').onchange = async (e) => {
    const file = e.target.files[0];
    readyMediaId = await yourApp.uploadMedia(file);

    window.reihWidget.configure({
      bearerToken: yourApp.getIdToken(),
      mediaId: readyMediaId,
    });
  };

  document.getElementById('restyle').onclick = () => {
    if (!readyMediaId) return alert('Upload a photo first');
    window.reihWidget.open();
  };
</script>
```

Replace `yourApp.uploadMedia` / `yourApp.getIdToken` with your app’s implementations.

---

## 2. WebSocket per tenant / session

### Important: URL is config, not from session API

The WebSocket endpoint is **not** returned by `/widget/session`. You must set `wsBaseUrl` in `reihWidgetConfig` for each environment/tenant—the same values your main REIH frontend uses.

| Environment | Example `wsBaseUrl` |
|-------------|---------------------|
| Dev | `wss://bcbss17qsc.execute-api.us-west-2.amazonaws.com/dev` |
| Prod | `wss://ws.reimaginehome.ai/prod` (confirm with REIH team) |

**Session/tenant identity is carried in the JWT**, appended as a query parameter when connecting:

```
{wsBaseUrl}?token={encodeURIComponent(jwt)}
```

The backend maps that token to the correct connection and media channel.

### When WebSocket is used

| Config | WebSocket |
|--------|-----------|
| `apiVersion: 'v2'` | **Off** — restyle uses `POST /v2/generate` polling only |
| `apiVersion: 'v3'` + `wsBaseUrl` set | **On** when chat/restyle panel opens |
| `apiVersion: 'v3'` + no `wsBaseUrl` | **Off** — REST polling fallback only |

Relevant SDK logic (`src/index.js`):

```javascript
if (this._config.apiVersion !== 'v2' && this._config.wsBaseUrl) {
  this._wsClient = createWidgetWebSocket({ wsBaseUrl: this._config.wsBaseUrl });
}
```

Connection (`src/utils/websocket.js`):

```javascript
ws = new WebSocket(`${wsBaseUrl}?token=${encodeURIComponent(token)}`);
```

### Per-tenant configuration from your backend

If each partner/tenant has different API/WS hosts, fetch tenant config server-side and pass it in:

```javascript
const tenant = await fetch('/api/tenant-config').then((r) => r.json());

window.reihWidget.configure({
  clientId: tenant.widgetClientId,
  apiBaseUrl: tenant.apiV3,
  apiBaseUrlV2: tenant.apiV2,
  wsBaseUrl: tenant.wsUrl,
  apiVersion: 'v3',
});
```

Keep **all three URLs on the same environment** (dev API + dev WS, prod API + prod WS). Mixing dev token with prod `wsBaseUrl` will fail.

### Token sources for WebSocket

| Auth mode | Token used for WS |
|-----------|-------------------|
| Widget session (`POST /widget/session`) | JWT from session response; refreshed via `/widget/session/refresh` |
| Direct auth (`bearerToken` in config) | Your Cognito / app `idToken` |

WebSocket connects when the panel opens and both `sessionId` and `mediaId` are available. Chat messages are sent with:

```javascript
{ action: 'sendMessage', message: { action: 'chat', payload: { media_id, user_message, ... } } }
```

If no WS reply arrives within ~10 seconds, the SDK falls back to `GET /widget/chat/:mediaId` polling.

### Bypass widget session (use host auth)

For embedded apps that already have a session, set `bearerToken` + `mediaId` and use `mode: 'restyle'` (or v2). This avoids `POST /widget/session` entirely. See Path A above.

---

## Quick reference

| Goal | What to do |
|------|------------|
| User uploads on your site, then opens widget | Host upload → `mediaId` + `bearerToken` → `reihWidget.open()` |
| Anonymous visitor, upload then chat | `/widget/session` → `/widget/upload` → prime `localStorage` → `open()` |
| Real-time v3 chat | `apiVersion: 'v3'` + correct `wsBaseUrl` for tenant |
| Generate-only, no WebSocket | `apiVersion: 'v2'` (restyle mode) |
| Custom button, open when ready | `hideTrigger: true`, upload first, then `open()` |
| Skip widget session API | `bearerToken` + `mediaId` (restyle / direct auth) |

### Config options (this guide)

| Option | Purpose |
|--------|---------|
| `mediaId` | Media to load when widget opens (restyle mode) |
| `bearerToken` | Host app JWT; skips widget session init |
| `propertyImage` | Optional preview URL before `GET /media` completes |
| `wsBaseUrl` | Tenant/environment WebSocket API Gateway URL |
| `apiVersion` | `'v2'` = no WS; `'v3'` = WS when `wsBaseUrl` set |
| `hideTrigger` | Hide floating button; use your own CTA |
| `autoInit` | Mount widget on load (`true` by default) |

---

## Related demos

| File | Shows |
|------|--------|
| `demo/restyle.html` | Upload-first flow, `hideTrigger`, `reihWidget.open()`, `reihwidget:media-loaded` |
| `demo/index.html` | Anonymous chat + widget session |
| `demo/env.example.js` | Dev tenant URLs (`apiBaseUrl`, `wsBaseUrl`, etc.) |

---

## Security notes

- Do **not** hardcode long-lived `bearerToken` values in public HTML.
- Prefer short-lived tokens from your backend or session init.
- Use the same environment for `apiBaseUrl`, `apiBaseUrlV2`, and `wsBaseUrl`.
