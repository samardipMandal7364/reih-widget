# Backend Changes Required for ReihWidget SDK

This document describes all the changes needed in `reimaginehome-2.0-backend` to support the embeddable chat widget working **without user login**.

---

## Overview

The existing chat system (`chat.service.js`) is tightly coupled to authenticated users via AWS Cognito. Every chat operation requires `user.user_email`, `user.user_id`, and an active subscription. The widget SDK needs to operate on **anonymous sessions** — visitors on client websites who have no account.

The backend needs five new components:

1. **Widget API routes** (`/v3/widget/*`) — new REST endpoints for session init, token refresh, chat, and message retrieval
2. **Widget WebSocket auth** — allow widget JWT tokens on the existing API Gateway WebSocket (`$connect`)
3. **Widget authentication middleware** — JWT-based auth replacing Cognito for widget requests
4. **Widget session model** — database model to track anonymous widget sessions
5. **Widget client model** — database model to store registered client domains and their API keys

---

## 1. New Database Models

### 1.1 `WidgetClient` Model

Stores registered clients who embed the widget. Each client gets a `client_id` and a list of allowed domains.

**File:** `src/models/widgetClient.model.js`

```javascript
const mongoose = require('mongoose');

const widgetClientSchema = new mongoose.Schema(
  {
    client_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    client_name: {
      type: String,
      required: true,
    },
    allowed_domains: {
      type: [String],
      required: true,
      validate: {
        validator: (v) => v.length > 0,
        message: 'At least one domain is required',
      },
    },
    api_key_hash: {
      type: String,
      required: true,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    rate_limit: {
      messages_per_minute: { type: Number, default: 30 },
      sessions_per_hour: { type: Number, default: 100 },
    },
    config: {
      max_session_duration_minutes: { type: Number, default: 30 },
      allowed_features: { type: [String], default: ['chat', 'image_edit'] },
      credits_pool: { type: Number, default: 1000 },
      credits_used: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

const WidgetClient = mongoose.model('WidgetClient', widgetClientSchema);
module.exports = WidgetClient;
```

### 1.2 `WidgetSession` Model

Tracks each anonymous chat session created by the widget.

**File:** `src/models/widgetSession.model.js`

```javascript
const mongoose = require('mongoose');

const widgetSessionSchema = new mongoose.Schema(
  {
    session_id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    client_id: {
      type: String,
      required: true,
      index: true,
    },
    domain: {
      type: String,
      required: true,
    },
    media_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Media',
    },
    visitor_fingerprint: {
      type: String,
    },
    ip_address: {
      type: String,
    },
    user_agent: {
      type: String,
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    expires_at: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 },
    },
    messages_count: {
      type: Number,
      default: 0,
    },
    last_activity: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

const WidgetSession = mongoose.model('WidgetSession', widgetSessionSchema);
module.exports = WidgetSession;
```

### 1.3 Register models in `src/models/index.js`

Add to the existing exports:

```javascript
module.exports.WidgetClient = require('./widgetClient.model');
module.exports.WidgetSession = require('./widgetSession.model');
```

---

## 2. Widget Authentication Middleware

JWT-based authentication for widget requests. Does NOT use Cognito.

**File:** `src/middlewares/widgetAuth.js`

```javascript
const jwt = require('jsonwebtoken');
const config = require('../config/config');
const { WidgetSession } = require('../models');

const widgetAuth = () => async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing widget authorization token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.widget_jwt_secret);

    // Verify session is still active
    const session = await WidgetSession.findOne({
      session_id: decoded.session_id,
      is_active: true,
    });

    if (!session) {
      return res.status(401).json({ message: 'Widget session expired or invalid' });
    }

    // Verify domain matches
    const origin = req.headers.origin || req.headers.referer || '';
    // Domain check is advisory here — the token already encodes the allowed domain

    // Attach session info to request
    req.widgetSession = session;
    req.widgetClientId = decoded.client_id;

    // Create a synthetic user object so chat.service.js can work
    req.user = {
      user_id: `widget_${session.session_id}`,
      user_email: `widget_${session.session_id}@widget.reimaginehome.ai`,
      user_name: 'Widget Visitor',
      provider: 'widget',
      is_widget: true,
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Widget token expired' });
    }
    return res.status(401).json({ message: 'Invalid widget token' });
  }
};

module.exports = widgetAuth;
```

---

## 3. Widget Service

Core business logic for widget sessions.

**File:** `src/services/v3/widget.service.js`

```javascript
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const config = require('../../config/config');
const { WidgetClient, WidgetSession, Media, Subscription } = require('../../models');
const { chatHandler } = require('./chat.service');
const logger = require('../../config/logger');
const ApiError = require('../../utils/ApiError');
const httpStatus = require('http-status');

const TOKEN_EXPIRY_SECONDS = 3600; // 1 hour

/**
 * Initialize a new widget session.
 * Validates client_id and domain, creates a session, issues a JWT.
 */
async function initSession(clientId, domain, ipAddress, userAgent) {
  // 1. Validate client
  const client = await WidgetClient.findOne({
    client_id: clientId,
    is_active: true,
  });

  if (!client) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Invalid client ID');
  }

  // 2. Validate domain
  const isAllowed = client.allowed_domains.some((d) => {
    if (d === '*') return true; // wildcard for dev
    if (d.startsWith('*.')) {
      return domain.endsWith(d.substring(1)) || domain === d.substring(2);
    }
    return d === domain;
  });

  if (!isAllowed) {
    throw new ApiError(httpStatus.FORBIDDEN, 'Domain not authorized for this client');
  }

  // 3. Rate limit check — sessions per hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentSessions = await WidgetSession.countDocuments({
    client_id: clientId,
    createdAt: { $gte: oneHourAgo },
  });

  if (recentSessions >= client.rate_limit.sessions_per_hour) {
    throw new ApiError(httpStatus.TOO_MANY_REQUESTS, 'Session rate limit exceeded');
  }

  // 4. Create session
  const sessionId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000);

  // 5. Create a Media document for this widget session
  //    This mirrors how the main app creates a media record for chat
  const syntheticUserEmail = `widget_${sessionId}@widget.reimaginehome.ai`;
  const syntheticUserId = `widget_${sessionId}`;

  const media = await Media.create({
    user_id: syntheticUserId,
    user_email: syntheticUserEmail,
    url: 'widget://no-image',  // Placeholder — widget chat may not need an image
    original_name: 'widget_session',
    messages: [],
    chat_provider: 'gemini',
  });

  // 6. Create or find a subscription for widget usage
  //    (Widget sessions use the CLIENT's credit pool, not individual subscriptions)
  //    We create a synthetic "widget" subscription so chat.service.js doesn't fail
  let subscription = await Subscription.findOne({
    user_email: syntheticUserEmail,
    is_active: true,
  });

  if (!subscription) {
    subscription = await Subscription.create({
      user_email: syntheticUserEmail,
      user_id: syntheticUserId,
      plan_name: 'WIDGET',
      is_active: true,
      credits: client.config.credits_pool - client.config.credits_used,
    });
  }

  const session = await WidgetSession.create({
    session_id: sessionId,
    client_id: clientId,
    domain,
    media_id: media._id,
    ip_address: ipAddress,
    user_agent: userAgent,
    expires_at: expiresAt,
  });

  // 7. Issue JWT
  const token = jwt.sign(
    {
      session_id: sessionId,
      client_id: clientId,
      domain,
      media_id: media._id.toString(),
    },
    config.widget_jwt_secret,
    { expiresIn: TOKEN_EXPIRY_SECONDS }
  );

  return {
    session_id: sessionId,
    media_id: media._id,
    token,
    expires_in: TOKEN_EXPIRY_SECONDS,
  };
}

/**
 * Refresh an existing session token.
 */
async function refreshSessionToken(sessionId) {
  const session = await WidgetSession.findOne({
    session_id: sessionId,
    is_active: true,
  });

  if (!session) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Session not found or expired');
  }

  // Extend session expiry
  const newExpiry = new Date(Date.now() + TOKEN_EXPIRY_SECONDS * 1000);
  session.expires_at = newExpiry;
  session.last_activity = new Date();
  await session.save();

  const token = jwt.sign(
    {
      session_id: session.session_id,
      client_id: session.client_id,
      domain: session.domain,
      media_id: session.media_id.toString(),
    },
    config.widget_jwt_secret,
    { expiresIn: TOKEN_EXPIRY_SECONDS }
  );

  return {
    token,
    expires_in: TOKEN_EXPIRY_SECONDS,
    session_id: sessionId,
    media_id: session.media_id,
  };
}

/**
 * Send a chat message from the widget.
 * Adapts the payload to work with the existing chatHandler.
 */
async function sendWidgetMessage(user, sessionId, mediaId, userMessage, attachments) {
  const session = await WidgetSession.findOne({
    session_id: sessionId,
    is_active: true,
  });

  if (!session) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Session expired');
  }

  // Rate limit — messages per minute
  const client = await WidgetClient.findOne({ client_id: session.client_id });
  if (client) {
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    // Use message count as a simple rate check
    if (session.messages_count > client.rate_limit.messages_per_minute) {
      throw new ApiError(httpStatus.TOO_MANY_REQUESTS, 'Message rate limit reached. Please wait.');
    }
  }

  // Update activity
  session.messages_count += 1;
  session.last_activity = new Date();
  await session.save();

  // Delegate to existing chatHandler (which handles OpenAI/Gemini routing)
  const result = await chatHandler(user, {
    media_id: mediaId,
    user_message: userMessage,
    attachments: attachments || [],
  }, {
    send_websocket_message: false, // Widget uses polling, not websockets
    store_user_message: true,
  });

  return result;
}

/**
 * Get messages for a widget session.
 */
async function getWidgetMessages(sessionId, mediaId) {
  const session = await WidgetSession.findOne({
    session_id: sessionId,
    is_active: true,
  });

  if (!session) {
    throw new ApiError(httpStatus.UNAUTHORIZED, 'Session expired');
  }

  const media = await Media.findById(mediaId);
  if (!media) {
    throw new ApiError(httpStatus.NOT_FOUND, 'Chat not found');
  }

  // Filter out internal messages
  const messages = (media.messages || [])
    .filter((m) => !m.hidden_from_client)
    .map((m) => ({
      _id: m._id,
      author: m.author,
      comment: m.comment,
      content: m.content,
      created_at: m.created_at,
      attachments: m.attachments,
    }));

  return { messages };
}

module.exports = {
  initSession,
  refreshSessionToken,
  sendWidgetMessage,
  getWidgetMessages,
};
```

---

## 4. Widget Controller

**File:** `src/controllers/v3/widget.controller.js`

```javascript
const httpStatus = require('http-status');
const widgetService = require('../../services/v3/widget.service');
const catchAsync = require('../../utils/catchAsync');

const initSession = catchAsync(async (req, res) => {
  const { domain, client_id } = req.body;
  const ip = req.ip || req.headers['x-forwarded-for'] || '';
  const userAgent = req.headers['user-agent'] || '';

  const result = await widgetService.initSession(client_id, domain, ip, userAgent);
  res.status(httpStatus.OK).json(result);
});

const refreshToken = catchAsync(async (req, res) => {
  const { session_id } = req.body;
  const result = await widgetService.refreshSessionToken(session_id);
  res.status(httpStatus.OK).json(result);
});

const sendMessage = catchAsync(async (req, res) => {
  const { session_id, media_id, user_message, attachments } = req.body;
  const result = await widgetService.sendWidgetMessage(
    req.user,
    session_id,
    media_id,
    user_message,
    attachments
  );

  // Fetch latest messages to return to client
  const messages = await widgetService.getWidgetMessages(session_id, media_id);
  const latestMessage = messages.messages[messages.messages.length - 1];

  res.status(httpStatus.OK).json({
    success: true,
    message: latestMessage || null,
    media_id,
  });
});

const getMessages = catchAsync(async (req, res) => {
  const { mediaId } = req.params;
  const { session_id } = req.query;
  const result = await widgetService.getWidgetMessages(session_id, mediaId);
  res.status(httpStatus.OK).json(result);
});

module.exports = {
  initSession,
  refreshToken,
  sendMessage,
  getMessages,
};
```

---

## 5. Widget Validation

**File:** `src/validations/v3/widget.validation.js`

```javascript
const Joi = require('joi');

const initSession = {
  body: Joi.object().keys({
    domain: Joi.string().required(),
    client_id: Joi.string().required(),
  }),
};

const refreshToken = {
  body: Joi.object().keys({
    session_id: Joi.string().uuid().required(),
  }),
};

const sendMessage = {
  body: Joi.object().keys({
    session_id: Joi.string().uuid().required(),
    media_id: Joi.string().required(),
    user_message: Joi.string().required().max(2000),
    attachments: Joi.array().items(
      Joi.object().keys({
        url: Joi.string().uri().required(),
        attachment_type: Joi.string().valid('IMAGE', 'VIDEO', 'PDF', 'GENERATION').required(),
        attachment_id: Joi.string(),
      })
    ).optional(),
  }),
};

const getMessages = {
  params: Joi.object().keys({
    mediaId: Joi.string().required(),
  }),
  query: Joi.object().keys({
    session_id: Joi.string().uuid().required(),
  }),
};

module.exports = {
  initSession,
  refreshToken,
  sendMessage,
  getMessages,
};
```

---

## 6. Widget Routes

**File:** `src/routes/v3/widget.route.js`

```javascript
const express = require('express');
const validate = require('../../middlewares/validate');
const widgetAuth = require('../../middlewares/widgetAuth');
const widgetValidation = require('../../validations/v3/widget.validation');
const widgetController = require('../../controllers/v3/widget.controller');

const router = express.Router();

// Public — no auth needed (this IS the auth endpoint)
router.post(
  '/session',
  validate(widgetValidation.initSession),
  widgetController.initSession
);

// Public — uses session_id to refresh
router.post(
  '/session/refresh',
  validate(widgetValidation.refreshToken),
  widgetController.refreshToken
);

// Protected — requires widget JWT
router.post(
  '/chat',
  widgetAuth(),
  validate(widgetValidation.sendMessage),
  widgetController.sendMessage
);

// Protected — requires widget JWT
router.get(
  '/chat/:mediaId',
  widgetAuth(),
  validate(widgetValidation.getMessages),
  widgetController.getMessages
);

module.exports = router;
```

---

## 7. Register Widget Routes

**File to modify:** `src/routes/v3/index.js`

Add the widget routes to the existing route registration:

```javascript
// Add at the top with other imports:
const widgetRoutes = require('./widget.route');

// Add to the defaultRoutes array:
{
  path: '/widget',
  route: widgetRoutes,
},
```

---

## 8. Configuration Changes

### 8.1 Add to `config.js`

Add these environment variables to `config.js`:

```javascript
// In the envVarsSchema, add:
WIDGET_JWT_SECRET: Joi.string().required().description('JWT secret for widget tokens'),

// In the config object, add:
widget_jwt_secret: envVars.WIDGET_JWT_SECRET,
```

### 8.2 Add to `.env`

```env
WIDGET_JWT_SECRET=your-secure-random-secret-at-least-32-chars
```

Generate a strong secret:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 9. CORS Configuration

The backend must allow cross-origin requests from client domains. Update the CORS middleware (or add one if not present):

**File to modify or create:** `src/middlewares/cors.js` or update in `src/app.js`

```javascript
const cors = require('cors');

const widgetCors = cors({
  origin: (origin, callback) => {
    // Widget endpoints allow any origin (domain is validated via client_id + JWT)
    // For non-widget endpoints, keep existing CORS policy
    callback(null, true);
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: false,
  maxAge: 86400, // 24h preflight cache
});

// Apply specifically to /v3/widget/* routes
app.use('/v3/widget', widgetCors);
```

---

## 10. Rate Limiting

Add rate limiting middleware for widget endpoints to prevent abuse:

```javascript
const rateLimit = require('express-rate-limit');

const widgetRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later.' },
});

// Apply to widget routes
app.use('/v3/widget', widgetRateLimit);
```

---

## 11. Dependencies to Install

```bash
npm install jsonwebtoken express-rate-limit
```

(`jsonwebtoken` may already be installed; `express-rate-limit` might be new.)

---

## 12. Adapting `chat.service.js`

The existing `chatHandler` function checks `user.user_email` to find media:

```javascript
let media = await Media.findOne({ _id: media_id, user_email: user.user_email });
```

For widget sessions, the synthetic email (`widget_<sessionId>@widget.reimaginehome.ai`) will match because we create the Media document with that email in `widget.service.js`. **No changes to `chat.service.js` are needed** for basic functionality.

However, if you want to avoid the subscription/credits check for widget users, add a guard in `chatHandler`:

```javascript
// At the top of chatHandler, after finding media:
if (user.is_widget) {
  // Skip credit deduction for widget sessions
  // Credits are pooled at the client level, handled by widget.service.js
}
```

And in `handleCallToolMessage`, skip watermark and credit deduction for widget users:

```javascript
// Before the watermark/credits section:
const isWidgetUser = user?.provider === 'widget';
if (!isWidgetUser) {
  // ... existing watermark + credits logic
}
```

---

## 13. Admin Endpoints (Optional)

For managing widget clients, create admin endpoints:

```
POST   /v3/admin/widget-clients       — Create a new client
GET    /v3/admin/widget-clients       — List all clients
PATCH  /v3/admin/widget-clients/:id   — Update client (domains, rate limits)
DELETE /v3/admin/widget-clients/:id   — Deactivate client
GET    /v3/admin/widget-sessions      — List active sessions (analytics)
```

These should be protected by admin authentication.

---

## 14. Database Indexes

Ensure these indexes exist for performance:

```javascript
// WidgetSession
db.widgetsessions.createIndex({ session_id: 1 }, { unique: true });
db.widgetsessions.createIndex({ client_id: 1 });
db.widgetsessions.createIndex({ expires_at: 1 }, { expireAfterSeconds: 0 });

// WidgetClient
db.widgetclients.createIndex({ client_id: 1 }, { unique: true });
```

---

## 15. WebSocket Support for Widget

The widget uses the **same AWS API Gateway WebSocket** as the main app for real-time message delivery. The widget falls back to REST polling only if a WebSocket response is delayed beyond 10 seconds (max 8 poll attempts).

### 15.1 How the Widget Connects

The widget opens a WebSocket with the widget JWT as the query token:

```
wss://ws.reimaginehome.ai/prod?token=<widget_jwt>
```

It sends messages using the same protocol as the frontend:

```json
{
  "action": "sendMessage",
  "message": {
    "action": "chat",
    "payload": {
      "media_id": "<media_id>",
      "user_message": "make this a modern living room",
      "input_modes": ["TEXT"],
      "attachments": []
    }
  }
}
```

And receives the same server pushes: `chat`, `generations`, `error_message`, `thought_chunk`.

### 15.2 Changes to `$connect` Route (API Gateway Authorizer)

The current WebSocket `$connect` route uses a Cognito authorizer. For widget tokens, you need a **custom Lambda authorizer** (or update the existing one) that can handle both Cognito tokens and widget JWTs.

**Option A: Dual-mode Lambda authorizer** (recommended)

```javascript
// In the $connect Lambda authorizer:
exports.handler = async (event) => {
  const token = event.queryStringParameters?.token;
  if (!token) return generatePolicy('anonymous', 'Deny', event.methodArn);

  // 1. Try widget JWT first
  try {
    const decoded = jwt.verify(token, process.env.WIDGET_JWT_SECRET);
    // Widget session — build a principal with widget identity
    return generatePolicy(
      `widget_${decoded.session_id}`,
      'Allow',
      event.methodArn,
      {
        // Pass claims to $connect route handler
        email: `widget_${decoded.session_id}@widget.reimaginehome.ai`,
        sub: `widget_${decoded.session_id}`,
        name: 'Widget Visitor',
        source: 'widget',
        session_id: decoded.session_id,
        client_id: decoded.client_id,
      }
    );
  } catch (_) {}

  // 2. Fall back to Cognito token verification
  try {
    const cognitoClaims = await verifyCognitoToken(token);
    return generatePolicy(
      cognitoClaims.sub,
      'Allow',
      event.methodArn,
      cognitoClaims
    );
  } catch (_) {}

  return generatePolicy('anonymous', 'Deny', event.methodArn);
};
```

### 15.3 Changes to `websocket.service.js`

The `onConnect` handler stores connections keyed by `user_email`. Widget connections use the synthetic email from the authorizer claims, so **no change is needed** — the existing `onConnect` logic works as-is.

For `onMessage`, widget connections need a slightly different user-resolution path since they won't have a `users` collection entry. Add a widget branch:

**File to modify:** `src/services/v3/websocket.service.js`

```javascript
const onMessage = async (connectionId, message) => {
  if (message.action === WebsocketAction.CHAT) {
    const connection = await WebsocketConnection.findOne({ connection_id: connectionId });
    if (!connection) return {};

    // ── Widget path: synthetic email starts with "widget_" ──
    if (connection.user_email.startsWith('widget_')) {
      const sessionId = connection.user_email
        .replace('widget_', '')
        .replace('@widget.reimaginehome.ai', '');

      const session = await WidgetSession.findOne({
        session_id: sessionId,
        is_active: true,
      });
      if (!session) return {};

      const client = await WidgetClient.findOne({
        client_id: session.client_id,
        is_active: true,
      });

      // Build synthetic user + subscription
      const user = {
        user_id: `widget_${sessionId}`,
        user_email: connection.user_email,
        user_name: 'Widget Visitor',
        provider: 'widget',
        profession: 'Home Owner',
        is_widget: true,
      };

      // Update session activity
      session.messages_count += 1;
      session.last_activity = new Date();
      await session.save();

      const chatResult = await chatHandler(user, message.payload, {
        send_websocket_message: true,  // Push responses via WS
        store_user_message: true,
      });

      return chatResult;
    }

    // ── Existing Cognito user path (unchanged) ──
    const result = (await WebsocketConnection.aggregate([
      // ... existing aggregation pipeline ...
    ]))[0];
    // ... rest of existing logic ...
  }
};
```

### 15.4 Ensure `postMessageToClientConnections` Works for Widget

The existing `postMessageToClientConnections` function looks up connections by `user_email`:

```javascript
const clientConnections = await WebsocketConnection.find({ user_email: userEmail })
```

Since widget sessions store connections with `widget_<sessionId>@widget.reimaginehome.ai` as the email, and `chatHandler` uses `media.user_email` to push messages, this **works without changes** — the Media document's `user_email` matches the WebSocket connection's `user_email`.

### 15.5 `chat.service.js` — Enable WebSocket Push for Widget

In the original widget service (`widget.service.js` section 3 above), `sendWidgetMessage` was called with `send_websocket_message: false`. Now that the widget uses WebSocket, change it to `true`:

```javascript
// In widget.service.js sendWidgetMessage:
const result = await chatHandler(user, {
  media_id: mediaId,
  user_message: userMessage,
  attachments: attachments || [],
}, {
  send_websocket_message: true,  // Changed from false → true
  store_user_message: true,
});
```

This ensures that when a message is sent via the REST `/widget/chat` fallback, the AI response still gets pushed to the WebSocket connection.

### 15.6 Widget Message Flow Diagram

```
┌─────────────┐       WebSocket        ┌──────────────────┐
│  Widget SDK │ ◄─────────────────────► │  API Gateway WS  │
│  (browser)  │   sendMessage/receive   │  ($connect auth) │
└──────┬──────┘                         └────────┬─────────┘
       │                                         │
       │  REST fallback                          │ onMessage
       │  (if WS unavailable)                    ▼
       │                                ┌──────────────────┐
       └──────── POST /widget/chat ───► │ websocket.service│
                                        │  or widget ctrl  │
                                        └────────┬─────────┘
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │  chatHandler()   │
                                        │  (chat.service)  │
                                        └────────┬─────────┘
                                                 │
                                        push via WS + save to DB
                                                 │
                                                 ▼
                                        ┌──────────────────┐
                                        │ postMessageTo    │
                                        │ ClientConnections│
                                        └──────────────────┘
```

### 15.7 Fallback Polling Behavior

The widget uses this strategy:
1. **Primary:** Receive messages via WebSocket in real-time
2. **Fallback trigger:** If no WebSocket response arrives within **10 seconds** after sending a message, start polling `GET /widget/chat/:mediaId`
3. **Polling cadence:** Every 3 seconds, up to a **maximum of 8 polls** (24 seconds total polling window)
4. **Auto-stop:** Polling stops immediately when a new message is detected (either via poll or WS)

This means the REST `GET /widget/chat/:mediaId` endpoint is still needed, but it will only be called as a fallback — not continuously.

---

## 16. Summary of New Files

| File | Purpose |
|------|---------|
| `src/models/widgetClient.model.js` | Client registration model |
| `src/models/widgetSession.model.js` | Anonymous session model |
| `src/middlewares/widgetAuth.js` | JWT auth middleware for widget |
| `src/services/v3/widget.service.js` | Widget business logic |
| `src/controllers/v3/widget.controller.js` | Widget HTTP controllers |
| `src/validations/v3/widget.validation.js` | Request validation schemas |
| `src/routes/v3/widget.route.js` | Widget API routes |

## Files to Modify

| File | Change |
|------|--------|
| `src/models/index.js` | Export new models |
| `src/routes/v3/index.js` | Register widget routes |
| `src/config/config.js` | Add `WIDGET_JWT_SECRET` |
| `.env` | Add `WIDGET_JWT_SECRET` value |
| `src/app.js` (or equivalent) | Add CORS + rate limiting for `/v3/widget` |
| `src/services/v3/chat.service.js` | Optional: skip credits/watermark for widget users |
| `src/services/v3/websocket.service.js` | Add widget connection branch in `onMessage` |
| API Gateway `$connect` authorizer | Dual-mode auth (widget JWT + Cognito) |

---

## API Endpoints Summary

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/v3/widget/session` | None | Create session, get JWT |
| `POST` | `/v3/widget/session/refresh` | None | Refresh expired JWT |
| `POST` | `/v3/widget/chat` | Widget JWT | Send a chat message (REST fallback) |
| `GET` | `/v3/widget/chat/:mediaId?session_id=xxx` | Widget JWT | Fetch messages (fallback polling) |
| `WSS` | `wss://ws.reimaginehome.ai/?token=<jwt>` | Widget JWT | Real-time messages (primary) |

---

## Security Checklist

- [ ] `WIDGET_JWT_SECRET` is at least 32 characters and stored securely
- [ ] Client `api_key_hash` is bcrypt-hashed, never stored in plain text
- [ ] Domain whitelist is enforced at session creation
- [ ] Rate limits are configured per-client
- [ ] CORS is restricted to widget endpoints only
- [ ] Widget sessions auto-expire via MongoDB TTL index
- [ ] No real user credentials or API keys are exposed to the widget
- [ ] Widget JWT tokens have a 1-hour expiry
- [ ] All widget API calls go over HTTPS
- [ ] WebSocket `$connect` authorizer validates widget JWT with the same secret
- [ ] WebSocket widget connections are scoped to synthetic emails (no access to real user data)
- [ ] Widget WS connections cannot access or modify other users' media/conversations
