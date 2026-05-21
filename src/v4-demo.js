import { h, render } from 'preact';
import { useState } from 'preact/hooks';
import { StudioModal } from './v4/StudioModal';

function V4Demo() {
  const [open, setOpen] = useState(true);
  if (!open) {
    return h('div', { style: 'padding:48px;font-family:system-ui;text-align:center' },
      h('p', { style: 'margin-bottom:16px;color:#374151' }, 'V4 studio modal closed.'),
      h('button', {
        type: 'button',
        onClick: () => setOpen(true),
        style:
          'padding:12px 20px;border-radius:10px;border:none;background:#111827;color:#fff;font-weight:600;cursor:pointer',
      }, 'Open again'));
  }
  return h(StudioModal, {
    isOpen: open,
    onClose: () => setOpen(false),
  });
}

const mount = document.getElementById('v4-root');
if (mount) {
  render(h(V4Demo), mount);
}
