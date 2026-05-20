import {
  collectGenerationOutputMessages,
  hasActiveGeneratingCard,
} from '../utils/helpers';

export function getThumbnail(url) {
  if (!url) return '';
  return url;
}

export function buildGenerationsFromMessages(messages, isGenerating) {
  const outputs = collectGenerationOutputMessages(messages);
  if (outputs.length === 0 && !isGenerating) return [];

  const generation_output_ids = outputs.map((m) => ({
    _id: m.content?.generation_output_id || m._id,
    preview_url: m.content?.preview_url,
    action_name: m.content?.action_name || 'Generated',
    original_url: m.content?.original_url,
    input_url: m.content?.input_url,
  }));

  const list = [{
    _id: 'widget_gen_batch',
    status: 'completed',
    generation_output_ids,
  }];

  if (isGenerating) {
    list.push({
      _id: 'widget_gen_processing',
      status: 'processing',
      job_status: 'processing',
      generation_output_ids: [{ _id: null }],
    });
  }

  return list;
}

export function buildMediaDetail({
  mediaId,
  mediaImageUrl,
  messages,
  selectedGenerationOutputId,
  isGenerating,
}) {
  return {
    _id: mediaId,
    url: mediaImageUrl,
    imgSrc: mediaImageUrl,
    messages: messages || [],
    generations: buildGenerationsFromMessages(messages, isGenerating),
    selectedGenerationId: selectedGenerationOutputId,
  };
}

export function getLastGeneratedPreviewDisplayUrl(mediaDetail) {
  const gens = mediaDetail?.generations;
  if (!gens?.length) return mediaDetail?.url || mediaDetail?.imgSrc || '';
  for (let i = gens.length - 1; i >= 0; i--) {
    const outputs = gens[i]?.generation_output_ids || [];
    for (let j = outputs.length - 1; j >= 0; j--) {
      if (outputs[j]?.preview_url) return outputs[j].preview_url;
    }
  }
  return mediaDetail?.url || mediaDetail?.imgSrc || '';
}

export function extractAllThinkingLabels(text) {
  if (!text?.trim()) return [];
  const regex = /\*\*([^*]+)\*\*/g;
  const labels = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match[1]) labels.push(match[1].trim());
  }
  return labels;
}

export function getActiveThinkingLabelAtDisplayPos(fullText, displayPos) {
  if (!fullText?.length) return null;
  const pos = Math.min(Math.max(0, Number(displayPos) || 0), fullText.length);
  if (pos <= 0) return null;

  const slice = fullText.slice(0, pos);
  const delimCount = (slice.match(/\*\*/g) || []).length;
  if (delimCount % 2 === 1) {
    const afterLast = slice.slice(slice.lastIndexOf('**') + 2);
    const partial = afterLast.trim();
    if (partial) return partial;
  }

  const labels = extractAllThinkingLabels(slice);
  return labels.length ? labels[labels.length - 1] : null;
}

export function isMessageGenerating(messages) {
  return hasActiveGeneratingCard(messages) || messages.some(
    (m) => m.content?.type === 'call_tool' || m.content?.type === 'analyzing'
  );
}
