import { h } from 'preact';
import { CompareSlider } from './CompareSlider';
import { GeneratingBackdrop } from './GeneratingBackdrop';

export function PreviewPanel({
  mediaLoading,
  displayImageUrl,
  beforeImageUrl,
  selectedGeneration,
  generatedImages,
  onSelectGeneration,
  isGenerating,
  generatingTitle,
}) {
  const showCompare =
    selectedGeneration?.content?.preview_url && beforeImageUrl && !isGenerating;

  return (
    h('div', { class: 'reih-v3-preview' },
      h('div', { class: 'reih-v3-preview__stage' },
        mediaLoading && !displayImageUrl
          ? h('div', { class: 'reih-v3-preview__loading' },
              h('div', { class: 'reih-spinner' }),
              h('p', null, 'Loading image…')
            )
          : isGenerating
          ? h(GeneratingBackdrop, {
              imageUrl: beforeImageUrl || displayImageUrl,
              title: generatingTitle || 'Generating…',
            })
          : showCompare
          ? h(CompareSlider, {
              beforeSrc: beforeImageUrl,
              afterSrc: selectedGeneration.content.preview_url,
              beforeLabel: 'Original',
              afterLabel: 'Reimagined',
            })
          : displayImageUrl
          ? h('img', {
              src: displayImageUrl,
              alt: 'Space preview',
              class: 'reih-v3-preview__image',
              loading: 'lazy',
            })
          : h('div', { class: 'reih-v3-preview__placeholder' },
              h('svg', { viewBox: '0 0 24 24', width: 48, height: 48, fill: '#9ca3af' },
                h('path', { d: 'M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z' })
              ),
              h('p', null, 'Your reimagined design will appear here')
            )
      ),
      generatedImages.length > 0 &&
        h('div', { class: 'reih-v3-preview__thumbs' },
          h('p', { class: 'reih-v3-preview__thumbs-title' }, 'Recent designs'),
          h('div', { class: 'reih-v3-preview__thumbs-scroll' },
            generatedImages.map((gen) =>
              h('button', {
                key: gen._id,
                type: 'button',
                class: `reih-v3-thumb${selectedGeneration?._id === gen._id ? ' reih-v3-thumb--active' : ''}`,
                onClick: () => onSelectGeneration(gen),
                'aria-label': gen.content?.action_name || 'Generated design',
              },
                h('img', {
                  src: gen.content.preview_url,
                  alt: gen.content.action_name || 'Generated',
                  loading: 'lazy',
                })
              )
            )
          )
        )
    )
  );
}
