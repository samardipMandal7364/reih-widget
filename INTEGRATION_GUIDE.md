# ReihWidget SDK — Integration Guide

Embed the REimagineHome AI chat widget on your website with a single script tag. This guide covers everything you need to get the widget running on your domain.

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration Options](#configuration-options)
5. [Programmatic API](#programmatic-api)
6. [Events](#events)
7. [Custom Trigger Button](#custom-trigger-button)
8. [Theming & Branding](#theming--branding)
9. [Content Security Policy (CSP)](#content-security-policy-csp)
10. [Troubleshooting](#troubleshooting)
11. [Browser Support](#browser-support)
12. [FAQ](#faq)

**See also:** [UPLOAD_AND_WEBSOCKET.md](./UPLOAD_AND_WEBSOCKET.md) — upload image before opening the widget, and WebSocket URL configuration per tenant.

---

## Quick Start

Add this snippet to your HTML, just before the closing `</body>` tag:

```html
<script>
  window.reihWidgetConfig = {
    clientId: 'YOUR_CLIENT_ID',
  };
</script>
<script src="https://cdn.reimaginehome.ai/widget/reih-widget.js" async></script>
```

That's it. A floating chat button appears in the bottom-right corner. Clicking it opens the AI design assistant chat.

---

## Prerequisites

Before integrating, you need:

1. **A Client ID** — provided by the REimagineHome team when you register as a widget partner
2. **Domain whitelisting** — your website domain(s) must be registered with your Client ID. Contact the REimagineHome team to add domains.

| What you get | Where it goes |
|---|---|
| `clientId` (e.g. `"acme-realty-001"`) | `window.reihWidgetConfig.clientId` |
| Allowed domains | Backend whitelist (managed by REimagineHome) |

> **No API keys or secrets are needed on the client side.** All authentication is handled via secure server-to-server tokens.

---

## Installation

### Option A: Script Tag (Recommended)

The simplest approach. The widget auto-initializes when the page loads.

```html
<!-- 1. Configure (before the script loads) -->
<script>
  window.reihWidgetConfig = {
    clientId: 'YOUR_CLIENT_ID',
    primaryColor: '#6C63FF',
    title: 'Design Assistant',
    subtitle: 'Powered by AI',
  };
</script>

<!-- 2. Load the widget -->
<script src="https://cdn.reimaginehome.ai/widget/reih-widget.js" async></script>
```

### Option B: Deferred Initialization

If you want to control when the widget initializes:

```html
<script>
  window.reihWidgetConfig = {
    clientId: 'YOUR_CLIENT_ID',
    autoInit: false,  // Don't auto-initialize
  };
</script>
<script src="https://cdn.reimaginehome.ai/widget/reih-widget.js" async></script>

<script>
  // Initialize later, e.g. after user logs in
  document.getElementById('start-chat').addEventListener('click', function() {
    window.reihWidget.init();
  });
</script>
```

### Option C: NPM Package (for SPAs)

If you're using a bundler (Webpack, Vite, etc.):

```bash
npm install @reimaginehome/widget-sdk
```

```javascript
import reihWidget from '@reimaginehome/widget-sdk';

reihWidget.configure({
  clientId: 'YOUR_CLIENT_ID',
  primaryColor: '#6C63FF',
}).init();
```

---

## Configuration Options

Pass these via `window.reihWidgetConfig` or the `.configure()` method:

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `clientId` | `string` | **(required)** | Your unique client identifier |
| `apiBaseUrl` | `string` | `"https://api.reimaginehome.ai/v3"` | API base URL (don't change unless instructed) |
| `wsBaseUrl` | `string` | `"wss://ws.reimaginehome.ai/prod"` | WebSocket URL (don't change unless instructed) |
| `primaryColor` | `string` | `"#6C63FF"` | Brand color (hex). Used for buttons, headers, accents |
| `title` | `string` | `"REimagineHome"` | Chat header title |
| `subtitle` | `string` | `"AI Design Assistant"` | Chat header subtitle |
| `welcomeTitle` | `string` | `"Welcome!"` | Welcome screen heading |
| `welcomeDescription` | `string` | `"Upload an image..."` | Welcome screen description |
| `placeholder` | `string` | `"Tell us what to change..."` | Input field placeholder text |
| `position` | `string` | `"bottom-right"` | Widget position: `"bottom-right"` or `"bottom-left"` |
| `hideTrigger` | `boolean` | `false` | Hide the floating trigger button (use your own button) |
| `autoOpen` | `boolean \| number` | `false` | Auto-open chat. `true` = immediate, number = delay in ms |
| `autoInit` | `boolean` | `true` | Auto-initialize on page load |
| `triggerIcon` | `string` | (built-in SVG) | URL to a custom trigger button icon image |
| `logoUrl` | `string` | (none) | URL to your logo (shown in chat header) |
| `poweredByText` | `string \| false` | `"REimagineHome"` | "Powered by" text. Set to `false` to hide |
| `poweredByUrl` | `string` | `"https://reimaginehome.ai"` | "Powered by" link URL |
| `pollInterval` | `number` | `3000` | Message polling interval in ms |

### Example: Full Configuration

```html
<script>
  window.reihWidgetConfig = {
    clientId: 'acme-realty-001',
    primaryColor: '#1E3A5F',
    title: 'Acme Design Studio',
    subtitle: 'AI-Powered Room Makeover',
    welcomeTitle: 'Hi there! 👋',
    welcomeDescription: 'Upload a photo of any room and tell me how you want to transform it.',
    placeholder: 'e.g. "Make this a modern living room"',
    position: 'bottom-right',
    logoUrl: 'https://acme-realty.com/logo-white-48.png',
    poweredByText: 'REimagineHome AI',
    autoOpen: 5000,  // Open after 5 seconds
  };
</script>
```

---

## Programmatic API

The widget exposes `window.reihWidget` with these methods:

### `reihWidget.configure(config)`

Update configuration. Can be called before `init()`.

```javascript
window.reihWidget.configure({
  primaryColor: '#FF5733',
  title: 'New Title',
});
```

### `reihWidget.init(overrides?)`

Initialize and mount the widget. Optional overrides merge with existing config.

```javascript
window.reihWidget.init({ clientId: 'my-client-id' });
```

### `reihWidget.destroy()`

Remove the widget from the page. Cleans up all DOM elements and event listeners.

```javascript
window.reihWidget.destroy();
```

### `reihWidget.on(event, callback)`

Listen for widget events.

```javascript
window.reihWidget.on('ready', () => {
  console.log('Widget is ready');
});
```

### `reihWidget.off(event, callback)`

Remove an event listener.

---

## Events

The widget emits events both via the `.on()` API and as native `CustomEvent`s on `window`:

| Event | Detail | When |
|-------|--------|------|
| `ready` | `{}` | Widget has been mounted |
| `destroyed` | `{}` | Widget has been removed |

### Listening via CustomEvent

```javascript
window.addEventListener('reihwidget:ready', (e) => {
  console.log('Widget ready', e.detail);
});
```

---

## Custom Trigger Button

To use your own button instead of the built-in floating bubble:

```html
<script>
  window.reihWidgetConfig = {
    clientId: 'YOUR_CLIENT_ID',
    hideTrigger: true,   // Hide built-in button
    autoInit: false,     // Don't auto-init
  };
</script>
<script src="https://cdn.reimaginehome.ai/widget/reih-widget.js" async></script>

<!-- Your custom button -->
<button id="my-chat-btn" style="padding: 12px 24px; background: #6C63FF; color: #fff; border: none; border-radius: 8px; cursor: pointer;">
  💬 Chat with AI Designer
</button>

<script>
  document.getElementById('my-chat-btn').addEventListener('click', function() {
    if (!window.reihWidget._mounted) {
      window.reihWidget.init();
    }
    // The widget opens automatically on init
  });
</script>
```

---

## Theming & Branding

### Primary Color

The `primaryColor` option controls:
- Trigger button background
- Chat header background
- User message bubble color
- Send button color
- Input field focus border
- Smart reply button border/hover
- Loading spinner accent

```javascript
window.reihWidgetConfig = {
  clientId: 'YOUR_CLIENT_ID',
  primaryColor: '#1E3A5F',  // Dark navy blue
};
```

### Custom Logo

Provide a URL to your logo (recommended: 32×32px or 48×48px, white or transparent background):

```javascript
window.reihWidgetConfig = {
  clientId: 'YOUR_CLIENT_ID',
  logoUrl: 'https://yoursite.com/logo-48.png',
};
```

### Powered-By Branding

Customize or hide the "Powered by" footer:

```javascript
// Custom text
poweredByText: 'YourBrand + REimagineHome',
poweredByUrl: 'https://yoursite.com',

// Hide entirely
poweredByText: false,
```

---

## Content Security Policy (CSP)

If your site uses a Content Security Policy, add these directives:

```
script-src 'self' https://cdn.reimaginehome.ai;
connect-src 'self' https://api.reimaginehome.ai wss://ws.reimaginehome.ai;
img-src 'self' https://cdn-2.reimaginehome.ai https://*.amazonaws.com;
style-src 'self' 'unsafe-inline';
```

### Explanation

| Directive | Reason |
|-----------|--------|
| `script-src` | Allows loading the widget JS from CDN |
| `connect-src` | Allows REST API calls and WebSocket connections |
| `img-src` | Allows loading generated images from S3/CloudFront |
| `style-src 'unsafe-inline'` | The widget injects scoped CSS into Shadow DOM |

If you use `nonce`-based CSP, the widget script tag needs the nonce:

```html
<script nonce="abc123" src="https://cdn.reimaginehome.ai/widget/reih-widget.js" async></script>
```

---

## Troubleshooting

### Widget doesn't appear

1. **Check the console** for `[ReihWidget]` errors
2. Verify `clientId` is set correctly
3. Ensure your domain is whitelisted — you'll see a "Domain not authorized" error if not
4. Check if an ad-blocker is blocking the script
5. Verify CSP headers allow the widget resources

### "Session expired" error

The widget token expires after 1 hour. The widget auto-refreshes tokens, but if the page has been idle for a very long time, reload the page.

### Chat messages not loading

1. Check network tab for failed `/widget/chat` requests
2. Verify `apiBaseUrl` is correct (default should work for most cases)
3. Check for CORS errors in the console

### Widget conflicts with page CSS

The widget uses a closed Shadow DOM, which isolates its CSS completely. If you still see issues:
- Ensure no `all: revert` or `* { }` rules target the widget host element
- The widget host has `all: initial` to reset inherited styles

### Multiple widgets on one page

The widget is a singleton. Including the script twice will log a warning and skip duplicate initialization. Only one chat instance runs per page.

---

## Browser Support

| Browser | Minimum Version |
|---------|----------------|
| Chrome | 63+ |
| Firefox | 63+ |
| Safari | 10+ |
| Edge | 79+ |
| iOS Safari | 10+ |
| Chrome Android | 63+ |

Shadow DOM v1 is required. Internet Explorer is **not supported**.

---

## FAQ

**Q: Does the widget slow down my page?**

No. The widget script is ~12KB gzipped, loaded asynchronously, and does not block page rendering. It uses Preact (3KB runtime) instead of React/Vue/Angular.

**Q: Can visitors use the widget without logging in?**

Yes. The widget creates anonymous sessions. No login or account is required from visitors.

**Q: Is visitor data stored?**

Chat messages are stored server-side for the session duration (up to 30 minutes of inactivity). No personally identifiable information (PII) is collected unless the visitor voluntarily provides it in chat.

**Q: Can I have different configurations for different pages?**

Yes. Set `autoInit: false` and call `reihWidget.configure({...}).init()` with page-specific settings.

**Q: How do I remove the widget from a specific page?**

Call `window.reihWidget.destroy()` or conditionally load the script only on pages where you want the widget.

**Q: Can the widget work on localhost for development?**

Yes. Ask the REimagineHome team to add `localhost` (or `*.localhost`) to your allowed domains list. This should only be used for development.

**Q: What happens if the API is down?**

The widget shows a friendly error message ("Failed to initialize. Please try again.") with a retry button. It does not crash the host page.

---

## Support

For integration help, domain whitelisting requests, or to get your Client ID:

- Email: support@reimaginehome.ai
- Docs: https://docs.reimaginehome.ai/widget

---

## Changelog

### v1.0.0
- Initial release
- Shadow DOM isolation
- Anonymous session management with JWT
- Polling-based message delivery
- Smart replies support
- Generation output (image) display
- Mobile-responsive layout
- Configurable branding (colors, logo, text)
- Left/right positioning
- Auto-open with delay
- Custom trigger button support
- Error handling with retry
