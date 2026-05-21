/** Shared SVG marks and UI icons for V4 studio modal — h() factories */
import { h } from 'preact';

/** Lime tile mark: black + (parent supplies lime background). */
export function IconBrandPlus(props) {
  return h(
    'svg',
    {
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: '#0a0a0a',
      'stroke-width': 2.25,
      'stroke-linecap': 'round',
      'aria-hidden': 'true',
      ...props,
    },
    h('path', { d: 'M12 5.5v13M5.5 12h13' })
  );
}

export function IconStar(props) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'currentColor', ...props },
    h('path', { d: 'M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z' })
  );
}

export function IconClose(props) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', ...props },
    h('path', { d: 'M6 6l12 12M6 18L18 6' })
  );
}

export function IconChevrons(props) {
  const { strokeWidth = '2.5', ...rest } = props || {};
  return h('svg', {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': strokeWidth,
    ...rest,
  },
  h('path', { d: 'M8 5l-5 7 5 7M16 5l5 7-5 7' })
  );
}

export function IconComposer(props) {
  return h('svg', { class: 'composer-ic', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', ...props },
    h('path', { d: 'M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1 16.1-3.8z' })
  );
}

/** Magnifying glass — composer bar (matches product reference). */
export function IconSearch(props) {
  return h(
    'svg',
    {
      class: 'composer-ic',
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-width': 1.75,
      'stroke-linecap': 'round',
      ...props,
    },
    h('circle', { cx: '11', cy: '11', r: '6.75' }),
    h('path', { d: 'M20 20l-4.2-4.2' })
  );
}

export function IconSend(props) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', ...props },
    h('path', { d: 'M5 12h14M13 5l7 7-7 7' })
  );
}

export function IconImage(props) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', ...props },
    h('rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }),
    h('circle', { cx: '9', cy: '9', r: '2' }),
    h('path', { d: 'M21 15l-5-5L5 21' })
  );
}

export function IconBudget(props) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', ...props },
    h('path', { d: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 1 1 0 7H6' })
  );
}

export function IconPlus(props) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', ...props },
    h('path', { d: 'M12 5v14M5 12h14' })
  );
}

export function IconReset(props) {
  return h('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', ...props },
    h('path', { d: 'M3 12a9 9 0 1 1 3 6.7M3 19v-6h6' })
  );
}

export function IconGoogle(props) {
  return h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', ...props },
    h('path', { d: 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z', fill: '#4285F4' }),
    h('path', { d: 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z', fill: '#34A853' }),
    h('path', { d: 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z', fill: '#FBBC05' }),
    h('path', { d: 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z', fill: '#EA4335' })
  );
}
