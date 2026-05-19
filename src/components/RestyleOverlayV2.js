import { h } from 'preact';
import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { CompareSlider } from './CompareSlider';

export function RestyleOverlayV2({
  isOpen,
  onClose,
  config,
  apiClient,
  mediaId,
  media,
  mediaImageUrl,
  mediaLoading,
}) {
  const [comment, setComment] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [afterImage, setAfterImage] = useState(null);
  const textareaRef = useRef(null);

  const beforeImage = mediaImageUrl || '';

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e) => { if (e.key === 'Escape' && !isGenerating) onClose(); };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isOpen, isGenerating, onClose]);

  const handleGenerate = useCallback(async () => {
    const text = comment.trim();
    if (!text || !mediaId || isGenerating) return;

    setError(null);
    setIsGenerating(true);
    setAfterImage(null);

    try {
      const payload = apiClient.buildV2GeneratePayload({
        media,
        mediaId,
        comment: text,
        config,
      });

      const job = await apiClient.createGeneration(payload);
      const result = await apiClient.pollGenerationUntilDone(job._id);

      const outputs = result.generation_output_ids || [];
      const url = outputs[0]?.output_url || outputs[0]?.preview_url;
      if (!url) {
        throw new Error('No output image returned');
      }
      setAfterImage(url);
    } catch (err) {
      console.error('[ReihV2] Generation error:', err);
      setError(err.message || 'Failed to generate. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [comment, mediaId, media, config, apiClient, isGenerating]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleGenerate();
    }
  }, [handleGenerate]);

  if (!isOpen) return null;

  return (
    h('div', { class: 'reih-overlay' },
      h('div', { class: 'reih-overlay-backdrop', onClick: isGenerating ? undefined : onClose }),
      h('div', { class: 'reih-overlay-container' },
        h('div', { class: 'reih-overlay-header' },
          h('div', { class: 'reih-overlay-brand' },
            config.logoUrl
              ? h('img', { src: config.logoUrl, alt: config.title, class: 'reih-overlay-logo' })
              : h('div', { class: 'reih-overlay-logo-default' },
                  h('svg', { viewBox: '0 0 24 24', width: 20, height: 20, fill: '#fff' },
                    h('path', { d: 'M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z' })
                  )
                ),
            h('span', { class: 'reih-overlay-title' }, config.title || 'REimagineHome'),
          ),
          h('button', {
            class: 'reih-overlay-close',
            onClick: onClose,
            disabled: isGenerating,
            'aria-label': 'Close overlay',
          },
            h('svg', { viewBox: '0 0 24 24', width: 24, height: 24 },
              h('path', {
                d: 'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
                fill: 'currentColor',
              })
            )
          )
        ),
        h('div', { class: 'reih-overlay-body' },
          h('div', { class: 'reih-overlay-preview reih-overlay-preview--v2' },
            (isGenerating && !afterImage) || (mediaLoading && !beforeImage)
              ? h('div', { class: 'reih-v2-generating' },
                  h('div', { class: 'reih-spinner' }),
                  h('p', null, mediaLoading ? 'Loading image...' : 'Generating your design...'),
                  h('p', { class: 'reih-v2-generating-hint' },
                    mediaLoading ? 'Fetching your property photo' : 'This may take a minute'
                  )
                )
              : afterImage
                ? h(CompareSlider, {
                    beforeSrc: beforeImage,
                    afterSrc: afterImage,
                    beforeLabel: 'Original',
                    afterLabel: 'Restyled',
                  })
                : beforeImage
                  ? h('img', {
                      src: beforeImage,
                      alt: 'Original',
                      class: 'reih-overlay-preview-img',
                    })
                  : h('div', { class: 'reih-overlay-preview-placeholder' },
                      h('p', null, 'Original image')
                    )
          ),
          h('div', { class: 'reih-overlay-side reih-overlay-side--v2' },
            h('div', { class: 'reih-v2-side-content' },
              h('h3', null, config.welcomeTitle || 'Restyle This Space'),
              h('p', { class: 'reih-v2-side-desc' },
                config.welcomeDescription || 'Describe the style you want and we\'ll generate a new look for this room.'
              ),
              h('div', { class: 'reih-v2-comment-area' },
                h('textarea', {
                  ref: textareaRef,
                  class: 'reih-v2-comment',
                  placeholder: config.placeholder || 'e.g. Modern minimalist with warm lighting...',
                  rows: 4,
                  value: comment,
                  disabled: isGenerating,
                  onInput: (e) => setComment(e.target.value),
                  onKeyDown: handleKeyDown,
                }),
                error && h('div', { class: 'reih-msg reih-msg--error' }, error),
                h('button', {
                  class: 'reih-v2-generate-btn',
                  onClick: handleGenerate,
                  disabled: isGenerating || !comment.trim() || !mediaId,
                },
                  isGenerating ? 'Generating...' : 'Generate Design'
                )
              )
            )
          )
        )
      )
    )
  );
}