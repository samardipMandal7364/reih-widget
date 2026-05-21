import { h, Fragment } from 'preact';
import { useState, useRef, useCallback, useEffect } from 'preact/hooks';
import studioModalCSS from './studio-modal.css';
import {
  IconBrandPlus,
  IconClose,
  IconChevrons,
  IconSearch,
  IconSend,
  IconImage,
  IconBudget,
  IconPlus,
  IconReset,
  IconGoogle,
} from './icons';
import {
  DEFAULT_ROOMS,
  DEFAULT_PILLS,
  DEFAULT_HISTORY,
  DEFAULT_STAGED_URL,
} from './defaultStudioData';

/** @type {WeakMap<Node, boolean>} */
const v4StylesInjectedInto = new WeakMap();

/** @param {string} cssText @param {Node | null | undefined} mountNode Inject into shadow root when embedding; defaults to document.head */
function injectV4Styles(cssText, mountNode) {
  if (typeof document === 'undefined') return;
  const target = mountNode ?? document.head;
  if (!(target && 'appendChild' in target) || v4StylesInjectedInto.get(target)) return;
  const el = document.createElement('style');
  el.setAttribute('data-reih-v4', 'studio-modal');
  el.textContent = cssText;
  target.appendChild(el);
  v4StylesInjectedInto.set(target, true);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function splitFromClientX(cardEl, clientX) {
  if (!cardEl) return 50;
  const r = cardEl.getBoundingClientRect();
  if (r.width <= 0) return 50;
  return clamp(((clientX - r.left) / r.width) * 100, 0, 100);
}

/**
 * V4 studio modal — structural clone of the reference HTML (topbar, before/after
 * card with slider, room strip, right talk panel, history, signup overlay).
 */
export function StudioModal({
  styleMount,
  isOpen = true,
  onClose,
  rooms = DEFAULT_ROOMS,
  initialSplit = 52.874743326488705,
  afterLabel = 'RICHER EVENING M…',
  agentLine,
  pills = DEFAULT_PILLS,
  historyItems = DEFAULT_HISTORY,
  historyRoomName = 'living room',
  historyCountLabel = '2 edits',
  shopBudgetInitial = '12 000 zł',
  partnerSsoName = '',
  showGenLoader = false,
  signupHeadline = 'Type your own ideas',
  signupSub = 'Sign up to describe exactly what you want. Takes 10 seconds, totally free.',
  showAttChip = true,
}) {
  injectV4Styles(studioModalCSS, styleMount);

  const [split, setSplit] = useState(initialSplit);
  const [activeRoom, setActiveRoom] = useState(0);
  const [historyActiveId, setHistoryActiveId] = useState(
    () => historyItems.find((i) => i.active)?.id || historyItems[0]?.id
  );
  const [signupOpen, setSignupOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [budget, setBudget] = useState(shopBudgetInitial);
  const [prompt, setPrompt] = useState('');
  const [dragging, setDragging] = useState(false);

  const cardRef = useRef(null);

  const room = rooms[activeRoom] || rooms[0];
  const origUrl = room?.originalUrl || '';
  const stagedUrl = room?.stagedUrl || DEFAULT_STAGED_URL;
  const roomLabel = room?.label || 'Living room';
  const origBg = room?.thumbBg || 'rgb(92, 122, 140)';

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (e) => {
      setSplit(splitFromClientX(cardRef.current, e.clientX));
    };
    const onUp = () => setDragging(false);

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [dragging]);

  const onSliderPointerDown = useCallback((e) => {
    e.preventDefault();
    cardRef.current?.setPointerCapture?.(e.pointerId);
    setDragging(true);
    setSplit(splitFromClientX(cardRef.current, e.clientX));
  }, []);

  const backdropClass = `modal-backdrop${isOpen ? ' open' : ''}`;
  const splitKey = `${split.toFixed(4)}%`;

  const agentMsg = agentLine ?? h(
    Fragment,
    null,
    'Done — ',
    h('em', null, 'richer evening mood'),
    '. Want to refine?'
  );

  const genLoaderDots = h(
    'div',
    { class: 'gen-loader-dots' },
    h('span', null),
    h('span', null),
    h('span', null)
  );

  const genLoader = h(
    'div',
    {
      class: `gen-loader${showGenLoader ? ' is-visible' : ''}`,
      id: 'gen-loader',
      'aria-hidden': showGenLoader ? 'false' : 'true',
    },
    h(
      'div',
      { class: 'gen-loader-card' },
      h('div', { class: 'gen-loader-mark' }, h(IconBrandPlus, null)),
      h('div', { class: 'gen-loader-text' }, 'Reimagining your space'),
      genLoaderDots
    )
  );

  const roomThumbs = rooms.map((r, idx) =>
    h('div', {
      key: r.id || String(idx),
      class: `room-thumb${idx === activeRoom ? ' active' : ''}`,
      'data-room': r.id ?? String(idx),
      style: {
        backgroundImage: r.originalUrl ? `url("${r.originalUrl}")` : undefined,
        backgroundColor: r.thumbBg || origBg,
      },
      onClick: () => setActiveRoom(idx),
      role: 'button',
      tabIndex: 0,
      onKeyDown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setActiveRoom(idx);
        }
      },
    })
  );

  const studioCardInner = h(
    'div',
    {
      class: 'studio-card is-staged',
      id: 'studio-card',
      ref: cardRef,
      style: {
        '--split': splitKey,
        // width: '100%',
        minHeight: 0,
        boxSizing: 'border-box',
        margin: '15px',
        borderRadius: '18px',
      },
    },
    h('div', {
      class: 'studio-img original',
      id: 'studio-orig',
      style: {
        backgroundImage: origUrl ? `url("${origUrl}")` : undefined,
        backgroundColor: origBg,
      },
    }),
    h('div', {
      class: 'studio-img staged',
      id: 'studio-staged',
      style: {
        clipPath: `inset(0px 0px 0px ${splitKey})`,
        backgroundImage: stagedUrl ? `url("${stagedUrl}")` : undefined,
        backgroundColor: origBg,
        filter: 'none',
      },
    }),
    h('div', { class: 'tag before' }, 'Before'),
    h(
      'div',
      { class: 'tag after' },
      h(
        'span',
        { id: 'after-label' },
        afterLabel.startsWith('+') ? afterLabel : `+ ${afterLabel}`
      )
    ),
    h(
      'div',
      { class: 'studio-card-foot', id: 'studio-card-foot' },
      h('div', { class: 'studio-room-label', id: 'studio-room-label' }, roomLabel)
    ),
    h('div', {
      class: 'slider-zone',
      id: 'slider-zone',
      onPointerDown: onSliderPointerDown,
    }),
    h('div', { class: 'slider-line', id: 'slider-line', style: { left: splitKey } }),
    h(
      'div',
      {
        class: 'slider-handle',
        id: 'slider-handle',
        style: { left: splitKey },
        onPointerDown: onSliderPointerDown,
        role: 'slider',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
        'aria-valuenow': String(Math.round(split)),
        'aria-label': 'Before and after comparison',
      },
      h(IconChevrons, null)
    ),
    h(
      'div',
      { class: 'room-strip', id: 'studio-room-strip' },
      h('div', { class: 'room-strip-track' }, roomThumbs)
    ),
    genLoader
  );

  const studioCard = h(
    'div',
    {
      class: 'studio-stage',
      style: {
        width: '100%',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
      },
    },
    studioCardInner
  );

  const agentPills = h(
    'div',
    { class: `agent-pills${shopOpen ? ' is-hidden' : ''}`, id: 'agent-pills' },
    pills.map((p, i) =>
      h(
        'button',
        {
          key: `${p.text}-${i}`,
          type: 'button',
          class: `agent-pill${p.disabled ? ' disabled' : ''}`,
          disabled: p.disabled,
        },
        h('span', { class: 'pill-text' }, p.text)
      )
    )
  );

  const shopReveal = h(
    'div',
    { class: `shop-reveal${shopOpen ? ' is-visible' : ''}`, id: 'shop-reveal' },
    h('div', { class: 'shop-reveal-mark' }, '$'),
    h('div', { class: 'shop-reveal-text' },
      'Real products for ',
      h('em', { id: 'shop-item' }, 'this'),
      '. Your budget?'
    ),
    h('input', {
      class: 'shop-reveal-input',
      id: 'shop-budget',
      type: 'text',
      value: budget,
      'aria-label': 'Budget',
      onInput: (e) => setBudget(e.currentTarget.value),
    }),
    h('button', { type: 'button', class: 'shop-reveal-apply', id: 'shop-apply' }, 'Find products →'),
    h(
      'button',
      {
        type: 'button',
        class: 'shop-reveal-skip',
        id: 'shop-skip',
        onClick: () => setShopOpen(false),
      },
      'skip'
    )
  );

  const agentRow = h(
    'div',
    { class: 'agent-row' },
    h(
      'div',
      { class: 'agent-msg-line' },
      h('div', { class: 'agent-mark' }, h(IconBrandPlus, null)),
      h('div', { class: 'agent-msg', id: 'agent-text' }, agentMsg)
    ),
    agentPills,
    shopReveal,
    h(
      'div',
      { class: 'agent-extras' },
      h(
        'button',
        {
          type: 'button',
          class: 'extra-link',
          id: 'seed-other',
          onClick: () => setSignupOpen(true),
        },
        'or type something specific →'
      )
    )
  );

  const inspirationChip = showAttChip
    ? h(
        'div',
        { class: 'att-chip', id: 'att-chip-inspiration' },
        h('span', { class: 'att-name' }, 'Inspiration'),
        h(
          'div',
          { class: 'mini-slots' },
          h('div', { class: 'mini-slot' }, h(IconPlus, null)),
          h('div', { class: 'mini-slot' }, h(IconPlus, null)),
          h('div', { class: 'mini-slot' }, h(IconPlus, null))
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'att-remove',
            'data-remove': 'inspiration',
            'aria-label': 'Remove inspiration',
          },
          h(IconClose, { 'stroke-width': '2.5' })
        )
      )
    : null;

  const panelTalk = h(
    'div',
    { class: 'panel-card panel-talk' },
    agentRow,
    h('div', { class: 'card-divider', 'aria-hidden': 'true' }),
    h(
      'div',
      { class: 'composer visible' },
      h(
        'div',
        { class: 'composer-bar' },
        h(IconSearch, null),
        h('input', {
          id: 'prompt-input',
          type: 'text',
          placeholder: "describe what you want — e.g. 'leather sofa'",
          value: prompt,
          onInput: (e) => setPrompt(e.currentTarget.value),
        }),
        h(
          'button',
          {
            type: 'button',
            class: 'send-inline',
            id: 'send-btn',
            'aria-label': 'Send',
          },
          h(IconSend, null)
        )
      ),
      h(
        'div',
        { class: 'composer-extras' },
        h(
          'button',
          { type: 'button', class: 'composer-add-ref', id: 'att-inspiration' },
          h(IconImage, null),
          h('span', null, 'Add inspiration image(s)')
        ),
        h(
          'button',
          {
            type: 'button',
            class: 'composer-add-ref',
            id: 'att-shoppable',
            onClick: () => setShopOpen(true),
          },
          h(IconBudget, null),
          h('span', null, 'Set a shoppable budget')
        )
      ),
      inspirationChip
    ),
    h(
      'div',
      { class: 'reset-row visible', id: 'reset-row' },
      h(
        'button',
        { type: 'button', class: 'btn-reset', id: 'btn-reset' },
        h(IconReset, null),
        'Reset all edits'
      )
    )
  );

  const historyListItems = historyItems.map((item) =>
    h(
      'div',
      {
        key: item.id,
        class: `history-item${item.id === historyActiveId ? ' active' : ''}`,
        onClick: () => setHistoryActiveId(item.id),
        role: 'button',
        tabIndex: 0,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setHistoryActiveId(item.id);
          }
        },
      },
      h('div', {
        class: 'history-thumb',
        style: {
          backgroundImage: item.thumbUrl ? `url('${item.thumbUrl}')` : undefined,
          filter: 'none',
        },
      }),
      h(
        'div',
        { class: 'history-meta' },
        h('div', { class: 'history-label' }, item.label),
        h(
          'div',
          { class: 'history-sub' },
          h('span', { class: 'history-time' }, item.sub),
          item.id === historyActiveId
            ? h('span', { class: 'history-current-badge' }, 'current')
            : null
        )
      )
    )
  );

  const panelHistory = h(
    'div',
    { class: 'panel-history' },
    h(
      'div',
      { class: 'history-head' },
      h(
        'span',
        { class: 'history-title' },
        'Your edits on ',
        h('em', { id: 'history-room-name' }, historyRoomName)
      ),
      h('span', { class: 'history-count', id: 'history-count' }, historyCountLabel)
    ),
    h('div', { class: 'history-list', id: 'history-list' }, historyListItems)
  );

  const studioPanel = h('div', { class: 'studio-panel' }, panelTalk, panelHistory);

  const modalContent = h('div', { class: 'modal-content' }, studioCard, studioPanel);

  const signupCard = h(
    'div',
    { class: 'signup-card', role: 'dialog', 'aria-labelledby': 'signup-headline' },
    h(
      'button',
      {
        type: 'button',
        class: 'signup-close',
        id: 'signup-close',
        'aria-label': 'Close signup',
        onClick: () => setSignupOpen(false),
      },
      h(IconClose, null)
    ),
    h(
      'div',
      { class: 'signup-brand' },
      h('div', { class: 'signup-mark' }, h(IconBrandPlus, null)),
      h('div', { class: 'signup-brand-name' }, 'Reimagine')
    ),
    h('h2', { class: 'signup-headline', id: 'signup-headline' }, signupHeadline),
    h('p', { class: 'signup-sub', id: 'signup-sub' }, signupSub),
    h('div', { class: 'signup-thumbs', id: 'signup-thumbs' }),
    h(
      'div',
      { class: 'signup-form' },
      h('input', {
        class: 'signup-input',
        type: 'email',
        placeholder: 'you@email.com',
        autoComplete: 'email',
      }),
      h('button', { type: 'button', class: 'signup-primary', id: 'signup-primary' }, 'Sign up free')
    ),
    h('div', { class: 'signup-divider' }, h('span', null, 'or')),
    h(
      'div',
      { class: 'signup-sso' },
      h(
        'button',
        { type: 'button', class: 'signup-sso-btn signup-sso-google', id: 'signup-sso-google' },
        h(IconGoogle, null),
        'Continue with Google'
      ),
      h(
        'button',
        {
          type: 'button',
          class: 'signup-sso-btn signup-sso-partner',
          id: 'signup-sso-partner',
        },
        'Continue with ',
        h('span', { id: 'signup-partner-name' }, partnerSsoName)
      )
    ),
    h(
      'button',
      {
        type: 'button',
        class: 'signup-skip',
        id: 'signup-skip',
        onClick: () => setSignupOpen(false),
      },
      'Skip for now →'
    )
  );

  const signupOverlay = h(
    'div',
    {
      class: `signup-overlay${signupOpen ? ' is-open' : ''}`,
      id: 'signup-overlay',
      'aria-hidden': signupOpen ? 'false' : 'true',
    },
    signupCard
  );

  const modalTopbar = h(
    'div',
    { class: 'modal-topbar' },
    h(
      'div',
      { class: 'modal-brand' },
      h('div', { class: 'brand-mark' }, h(IconBrandPlus, null)),
      h(
        'div',
        { class: 'brand-text-stack' },
        h('span', { class: 'brand-name' }, 'Reimagine'),
        h('span', { class: 'powered-by' }, 'Powered by reimaginehome.ai')
      )
    ),
    h(
      'div',
      { class: 'modal-actions' },
      h(
        'button',
        {
          type: 'button',
          class: 'btn-close',
          id: 'btn-close',
          onClick: onClose,
          'aria-label': 'Close',
        },
        h(IconClose, null)
      )
    )
  );

  const modalShell = h('div', { class: 'modal' }, modalTopbar, modalContent, signupOverlay);

  return h(
    'div',
    { class: 'reih-v4' },
    h('div', { class: backdropClass, id: 'modal-backdrop' }, modalShell)
  );
}

export default StudioModal;
