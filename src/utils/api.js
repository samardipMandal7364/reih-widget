const API_TIMEOUT = 30000;
const TOKEN_REFRESH_BUFFER = 60000;

export function generateSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

const GENERATION_POLL_INTERVAL = 3000;
const GENERATION_POLL_TIMEOUT = 120000;

export function createApiClient(config) {
  const { apiBaseUrl, apiBaseUrlV2 } = config;
  const v2BaseUrl = apiBaseUrlV2 || (apiBaseUrl ? apiBaseUrl.replace(/\/v3\/?$/, '/v2') : '');
  const isDirectAuth = !!config.bearerToken;
  let token = config.bearerToken || null;
  let tokenExpiry = config.bearerToken ? Date.now() + 86400000 : 0;
  let refreshPromise = null;

  async function request(method, path, body, extraHeaders = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...extraHeaders,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT);

    try {
      const res = await fetch(`${apiBaseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 401) {
        token = null;
        tokenExpiry = 0;
        throw new AuthError('Session expired. Please refresh.');
      }

      if (res.status === 403) {
        throw new DomainError('This domain is not authorized to use this widget.');
      }

      if (res.status === 429) {
        throw new RateLimitError('Too many requests. Please wait a moment.');
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new ApiError(err.message || `Request failed (${res.status})`, res.status);
      }

      return res.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out. Please try again.', 408);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function initSession(domain, clientId) {
    const data = await request('POST', '/widget/session', {
      domain,
      client_id: clientId,
    });
    token = data.token;
    tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
    return data;
  }

  async function refreshToken(sessionId) {
    if (isDirectAuth) return { token };
    if (refreshPromise) return refreshPromise;

    refreshPromise = request('POST', '/widget/session/refresh', {
      session_id: sessionId,
    })
      .then((data) => {
        token = data.token;
        tokenExpiry = Date.now() + (data.expires_in || 3600) * 1000;
        refreshPromise = null;
        return data;
      })
      .catch((err) => {
        refreshPromise = null;
        throw err;
      });

    return refreshPromise;
  }

  async function sendMessage(sessionId, mediaId, message, attachments = []) {
    if (isDirectAuth) {
      return { success: true, message: null, media_id: mediaId };
    }
    return request('POST', '/widget/chat', {
      session_id: sessionId,
      media_id: mediaId,
      user_message: message,
      attachments,
    });
  }

  async function getMessages(sessionId, mediaId) {
    if (isDirectAuth) {
      return { messages: [] };
    }
    return request('GET', `/widget/chat/${mediaId}?session_id=${sessionId}`);
  }

  async function uploadImage(sessionId, file) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('session_id', sessionId);

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT * 2);

    try {
      const res = await fetch(`${apiBaseUrl}/widget/upload`, {
        method: 'POST',
        headers,
        body: formData,
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new ApiError(err.message || 'Upload failed', res.status);
      }

      return res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  function isTokenValid() {
    if (isDirectAuth) return !!token;
    return token && Date.now() < tokenExpiry - TOKEN_REFRESH_BUFFER;
  }

  function getToken() {
    return token;
  }

  function clearToken() {
    token = null;
    tokenExpiry = 0;
  }

  function setToken(newToken) {
    token = newToken;
    tokenExpiry = Date.now() + 86400000;
  }

  async function requestV2(method, path, body) {
    if (!v2BaseUrl) {
      throw new ApiError('V2 API base URL is not configured', 500);
    }
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API_TIMEOUT * 4);

    try {
      const res = await fetch(`${v2BaseUrl}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      if (res.status === 401) throw new AuthError('Session expired. Please refresh.');
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new ApiError(err.message || `Request failed (${res.status})`, res.status);
      }
      return res.json();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new ApiError('Request timed out. Please try again.', 408);
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function getMediaV2(mediaId) {
    return requestV2('GET', `/media/${mediaId}`);
  }

  async function getMediaV3(mediaId) {
    if (!apiBaseUrl) {
      throw new ApiError('V3 API base URL is not configured', 500);
    }
    return request('GET', `/media/${mediaId}`);
  }

  async function getMedia(mediaId, apiVersion) {
    return apiVersion === 'v2' ? getMediaV2(mediaId) : getMediaV3(mediaId);
  }

  async function createGeneration(payload) {
    console.log('[ReihAPI] POST /generate', payload);
    return requestV2('POST', '/generate', payload);
  }

  async function getGenerationJob(generationId) {
    return requestV2('GET', `/generate/${generationId}`);
  }

  async function pollGenerationUntilDone(generationId) {
    const start = Date.now();
    while (Date.now() - start < GENERATION_POLL_TIMEOUT) {
      const job = await getGenerationJob(generationId);
      console.log('[ReihAPI] Poll /generate/' + generationId, job.job_status);
      if (job.job_status === 'error') {
        throw new ApiError(job.message || 'Generation failed', 500);
      }
      if (job.job_status === 'done') return job;
      await new Promise((r) => setTimeout(r, GENERATION_POLL_INTERVAL));
    }
    throw new ApiError('Generation timed out. Please try again.', 408);
  }

  function buildV2GeneratePayload({ media, mediaId, comment, config }) {
    const solutionName = config.solutionName || 'REDESIGN_FURNISHED_ROOM';
    const url = media?.url || config.propertyImage;
    const spaceType = media?.space_type || config.spaceType || 'living room';
    const maskUrl = media?.mask_url || '';

    return {
      media_id: mediaId,
      url,
      space_type: spaceType,
      solution_name: solutionName,
      mask_url: maskUrl,
      generation_input: {
        designing_for: config.designingFor || 'Homeowners',
        design_theme: config.designTheme || 'Modern',
        masking_category: 'furnishing',
        color_and_pattern_preference: '',
        user_instructions: comment,
      },
    };
  }

  return {
    initSession,
    refreshToken,
    sendMessage,
    getMessages,
    uploadImage,
    isTokenValid,
    getToken,
    clearToken,
    setToken,
    getMediaV2,
    getMediaV3,
    getMedia,
    createGeneration,
    pollGenerationUntilDone,
    buildV2GeneratePayload,
  };
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export class AuthError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AuthError';
  }
}

export class DomainError extends Error {
  constructor(message) {
    super(message);
    this.name = 'DomainError';
  }
}

export class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}

