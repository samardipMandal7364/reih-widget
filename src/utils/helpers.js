export function sanitizeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return isToday ? time : `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

export function debounce(fn, ms) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

export function parseMarkdown(text) {
  if (!text) return '';
  return text
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br/>');
}

export function getDomainFromUrl() {
  try {
    return window.location.hostname;
  } catch (_) {
    return '';
  }
}

export function isMobileViewport() {
  try {
    return window.innerWidth <= 480;
  } catch (_) {
    return false;
  }
}

const QUICK_OPTION_SECTION_PATTERNS = [
  /\*\*Quick Actions:\*\*\s*((?:[-*]\s*.+\s*)+)/i,
  /\*\*Quick Options:\*\*\s*((?:[-*]\s*.+\s*)+)/i,
  /\*\*Suggestions:\*\*\s*((?:[-*]\s*.+\s*)+)/i,
  /\*\*Try these:\*\*\s*((?:[-*]\s*.+\s*)+)/i,
  /(?<!\*)Quick Actions:\s*((?:[-*]\s*.+\s*)+)/i,
  /(?<!\*)Quick Options:\s*((?:[-*]\s*.+\s*)+)/i,
  /(?<!\*)Suggestions:\s*((?:[-*]\s*.+\s*)+)/i,
  /(?<!\*)Try these:\s*((?:[-*]\s*.+\s*)+)/i,
];

export function parseQuickOptionsFromText(markdownText) {
  if (!markdownText) return [];
  for (const pattern of QUICK_OPTION_SECTION_PATTERNS) {
    const match = markdownText.match(pattern);
    if (!match) continue;
    return match[1]
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') || line.startsWith('*'))
      .map((line) => line.replace(/^[-*]\s*/, '').trim())
      .filter((text) => text.length > 0 && text.length < 100);
  }
  return [];
}

export function stripQuickOptionSections(markdownText) {
  if (!markdownText) return '';
  let cleaned = markdownText;
  for (const pattern of QUICK_OPTION_SECTION_PATTERNS) {
    cleaned = cleaned.replace(pattern, '');
  }
  return cleaned.trim();
}

/** call_tool card stays visible until a generation_output arrives after it */
export function isActiveCallToolMessage(msg, allMessages = []) {
  if (msg?.content?.type !== 'call_tool') return false;
  const idx = allMessages.findIndex((m) => m._id === msg._id);
  if (idx < 0) return true;
  return !allMessages.slice(idx + 1).some(
    (m) => m.content?.type === 'generation_output' && m.content?.preview_url
  );
}

export function hasActiveGeneratingCard(messages = []) {
  return messages.some((m) => isActiveCallToolMessage(m, messages));
}

/** Whether a message should appear in the chat list */
export function isVisibleChatMessage(msg, allMessages = []) {
  if (!msg) return false;
  if (msg.content?.type === 'chat_initialize') return false;
  if (msg.content?.type === 'thoughts') return false;
  if (msg.content?.type === 'call_tool') {
    return isActiveCallToolMessage(msg, allMessages);
  }
  if (msg.author === 'user' && msg.echo === true) {
    return false;
  }
  return true;
}

/** Merge generation_output chat messages from a generations WebSocket payload */
export function mergeGenerationOutputsFromWs(messages, genData) {
  const outputs = genData?.generation_output_ids;
  if (!Array.isArray(outputs) || outputs.length === 0) {
    return messages;
  }

  const next = [...messages];

  const originalUrl =
    genData.url || genData.input_url || genData.original_url ||
    genData.source_url || genData.input_image_url || genData.media_url || '';

  outputs.forEach((output) => {
    if (!output?.preview_url) return;

    const existingIdx = next.findIndex(
      (m) =>
        m.author === 'ai_agent' &&
        m.content?.type === 'generation_output' &&
        m.content?.generation_output_id === output._id
    );

    const content = {
      type: 'generation_output',
      generation_output_id: output._id,
      preview_url: output.preview_url,
      action_name: output.action_name || 'Generated',
      ...(originalUrl && { original_url: originalUrl }),
      ...(output.original_url && { original_url: output.original_url }),
      ...(output.input_url && { original_url: output.input_url }),
      ...(output.shopping_list && { shopping_list: output.shopping_list }),
      ...(output.shopping_list_id && { shopping_list_id: output.shopping_list_id }),
      ...(genData.smart_reply && { smart_reply: genData.smart_reply }),
    };

    if (existingIdx >= 0) {
      next[existingIdx] = {
        ...next[existingIdx],
        content: { ...next[existingIdx].content, ...content },
      };
    } else {
      next.push({
        _id: output._id,
        author: 'ai_agent',
        comment: '',
        content,
        createdAt: new Date().toISOString(),
        media_id: genData.media_id,
      });
    }
  });

  return next;
}

export function collectGenerationOutputMessages(messages) {
  return (messages || []).filter(
    (m) => m.content?.type === 'generation_output' && m.content?.preview_url
  );
}

export function getQuickOptionsForMessage(msg) {
  const fromArray = msg?.content?.smart_reply;
  if (Array.isArray(fromArray) && fromArray.length > 0) {
    return fromArray;
  }
  const text = msg?.content?.text || msg?.comment || '';
  return parseQuickOptionsFromText(text);
}

/** Build REimagineHome CDN URL: /{env}/{projectId}/{mediaId}/original.jpg */
export function buildMediaCdnUrl({
  projectId,
  mediaId,
  cdnEnv = 'dev',
  cdnBaseUrl = 'https://cdn-2.reimaginehome.ai',
} = {}) {
  if (!projectId || !mediaId) return '';
  const env = String(cdnEnv || 'dev').replace(/^\/|\/$/g, '');
  const base = String(cdnBaseUrl || 'https://cdn-2.reimaginehome.ai').replace(/\/$/, '');
  return `${base}/${env}/${projectId}/${mediaId}/original.jpg`;
}

/** Resolve display URL from API response and/or projectId + mediaId config */
export function resolveMediaImageUrl(media, config = {}) {
  const fromMedia = extractMediaImageUrl(media);
  if (fromMedia) return fromMedia;

  const projectId =
    config.projectId ||
    config.project_id ||
    media?.project_id ||
    media?.projectId;
  const mediaId =
    config.mediaId ||
    config.media_id ||
    media?._id ||
    media?.media_id ||
    media?.id;

  if (projectId && mediaId) {
    return buildMediaCdnUrl({
      projectId,
      mediaId,
      cdnEnv: config.cdnEnv || config.apiEnv || 'dev',
      cdnBaseUrl: config.cdnBaseUrl,
    });
  }

  return config.propertyImage || '';
}

/** Resolve display URL from v2/v3 media API response */
export function extractMediaImageUrl(media) {
  if (!media) return '';

  const projectId = media.project_id || media.projectId;
  const mediaId = media._id || media.media_id || media.id;
  if (projectId && mediaId) {
    const fromCdn = buildMediaCdnUrl({
      projectId,
      mediaId,
      cdnEnv: media.env || media.environment || media.cdn_env || 'dev',
      cdnBaseUrl: media.cdn_base_url || media.cdnBaseUrl,
    });
    if (fromCdn) return fromCdn;
  }

  const direct =
    media.url ||
    media.image_url ||
    media.original_url ||
    media.preview_url ||
    media.input_url ||
    media.source_url ||
    media.signed_url ||
    media.input_image_url ||
    media.original_image_url ||
    media.media_url ||
    media.thumbnail_url ||
    media.photo_url ||
    media.src ||
    media.image;

  if (direct && typeof direct === 'string') return direct;

  const nested =
    media.metadata?.url ||
    media.metadata?.image_url ||
    media.metadata?.original_url ||
    media.original?.url ||
    media.input?.url;

  if (nested && typeof nested === 'string') return nested;

  if (Array.isArray(media.images) && media.images[0]) {
    const img = media.images[0];
    const u = typeof img === 'string' ? img : img.url || img.src || img.image_url;
    if (u) return u;
  }

  for (const val of Object.values(media)) {
    if (typeof val === 'string' && /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|svg)/i.test(val)) {
      return val;
    }
  }

  return '';
}
