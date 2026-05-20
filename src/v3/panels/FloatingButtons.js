/** Ported from MediaChatModal/DesignPanelRight/FloatingButtons */
import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';

const COMPARE_ICON = h('svg', { viewBox: '0 0 24 24', width: 20, height: 20 },
  h('path', {
    d: 'M10 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h5v2h2V1h-2v2zm0 15H5l5-6v6zm4-15v2h5v13l-5-6v9h5c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-5z',
    fill: 'currentColor',
  })
);

const SHARE_ICON = h('svg', { viewBox: '0 0 24 24', width: 20, height: 20 },
  h('path', {
    d: 'M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92-1.31-2.92-2.92-2.92z',
    fill: 'currentColor',
  })
);

const DOWNLOAD_ICON = h('svg', { viewBox: '0 0 24 24', width: 20, height: 20 },
  h('path', {
    d: 'M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z',
    fill: 'currentColor',
  })
);

export function FloatingButtons({
  showCompareImages,
  setShowCompareImages,
  hasGenerations,
  disable,
  isHovered,
  onDownload,
  onShare,
}) {
  const [activeButton, setActiveButton] = useState(null);

  const click = useCallback((type, fn) => {
    setActiveButton(type);
    fn();
    setTimeout(() => setActiveButton(null), 200);
  }, []);

  if (!hasGenerations) return null;

  return (
    h('div', { class: `mcm-floating-btns${disable ? ' mcm-floating-btns--disabled' : ''}` },
      h('div'),
      h('div', { class: 'mcm-floating-btns__right' },
        h('button', {
          type: 'button',
          class: `mcm-floating-btn${activeButton === 'compare' ? ' mcm-floating-btn--active' : ''}${showCompareImages ? ' mcm-floating-btn--compare-on' : ''}`,
          title: 'Compare',
          onClick: () => click('compare', () => setShowCompareImages(!showCompareImages)),
        }, COMPARE_ICON),

        h('button', {
          type: 'button',
          class: `mcm-floating-btn${activeButton === 'share' ? ' mcm-floating-btn--active' : ''}`,
          title: 'Share',
          onClick: () => click('share', () => { if (onShare) onShare(); }),
        }, SHARE_ICON),

        h('button', {
          type: 'button',
          class: `mcm-floating-btn${activeButton === 'download' ? ' mcm-floating-btn--active' : ''}`,
          title: 'Download',
          onClick: () => click('download', () => { if (onDownload) onDownload(); }),
        }, DOWNLOAD_ICON),
      )
    )
  );
}
