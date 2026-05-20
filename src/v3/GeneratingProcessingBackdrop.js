/** Ported from MediaChatModal/GeneratingProcessingBackdrop */
import { h } from 'preact';
import { getThumbnail } from './utils';

export function GeneratingProcessingBackdrop({
  imageUrl,
  title = 'Generating...',
  radialBackdropOnly = false,
  class: rootClass = '',
}) {
  const originalImageSrc =
    imageUrl &&
    (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')
      ? imageUrl
      : getThumbnail(imageUrl));

  const hasTitle = title != null && (typeof title !== 'string' || title.trim().length > 0);

  const loader = h('div', { class: 'mcm-dashed-loader', 'aria-hidden': 'true' });

  const titleNode = hasTitle
    ? h('div', {
      class: originalImageSrc
        ? 'mcm-gen-backdrop__title mcm-gen-backdrop__title--overlay'
        : 'mcm-gen-backdrop__title',
    }, title)
    : null;

  const loaderBlock = hasTitle
    ? h('div', { class: 'mcm-gen-backdrop__stack' }, loader, titleNode)
    : h('div', { class: 'mcm-gen-backdrop__loader-wrap' }, loader);

  if (!originalImageSrc) {
    return h('div', { class: `mcm-gen-backdrop mcm-gen-backdrop--standalone ${rootClass}` }, loaderBlock);
  }

  return (
    h('div', { class: `mcm-gen-backdrop mcm-gen-backdrop--with-image ${rootClass}` },
      h('img', {
        class: 'mcm-gen-backdrop__img',
        src: originalImageSrc,
        alt: '',
        loading: 'lazy',
      }),
      h('div', {
        class: `mcm-gen-backdrop__overlay${radialBackdropOnly ? ' mcm-gen-backdrop__overlay--radial' : ''}`,
        'aria-hidden': 'true',
      }),
      h('div', { class: 'mcm-gen-backdrop__layer' }, loaderBlock)
    )
  );
}
