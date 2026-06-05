/**
 * Normalize and apply tenant branding from init/configure config.
 * Supports flat options (primaryColor, logoUrl) and a nested `branding` object.
 */

var DEFAULT_PRIMARY = '#6C63FF';
var DEFAULT_SECONDARY = '#07A2AA';
var DEFAULT_TEXT_PRIMARY = '#0F0F31';
var DEFAULT_TEXT_SECONDARY = '#6b7280';

/**
 * @param {Record<string, unknown>|null|undefined} config
 * @returns {Record<string, string|undefined>}
 */
export function parseBranding(config) {
  if (!config || typeof config !== 'object') return {};

  var nested =
    config.branding && typeof config.branding === 'object' ? config.branding : {};

  function pick() {
    for (var i = 0; i < arguments.length; i++) {
      var v = arguments[i];
      if (v != null && v !== '') return String(v);
    }
    return undefined;
  }

  var primaryColor = pick(nested.primaryColor, config.primaryColor);
  var secondaryColor = pick(
    nested.secondaryColor,
    nested.accentColor,
    config.secondaryColor,
    config.accentColor
  );

  return {
    primaryColor: primaryColor,
    secondaryColor: secondaryColor,
    textPrimary: pick(nested.textPrimary, config.textPrimary),
    textSecondary: pick(nested.textSecondary, config.textSecondary),
    gradientBorder: pick(nested.gradientBorder, config.gradientBorder),
    logoUrl: pick(nested.logoUrl, config.logoUrl),
    fontFamily: pick(nested.fontFamily, config.fontFamily),
    fontFamilyHeading: pick(
      nested.fontFamilyHeading,
      nested.fontSerif,
      config.fontFamilyHeading,
      config.fontSerif
    ),
    title: pick(
      nested.widgetTitle,
      nested.title,
      config.widgetTitle,
      config.title
    ),
    subtitle: pick(nested.subtitle, config.subtitle),
    poweredByText: pick(nested.poweredByText, config.poweredByText),
    poweredByUrl: pick(nested.poweredByUrl, config.poweredByUrl),
  };
}

/**
 * @param {string|undefined} primary
 * @param {string|undefined} secondary
 * @param {string|undefined} custom
 */
export function buildGradientBorder(primary, secondary, custom) {
  if (custom) return custom;
  var a = primary || DEFAULT_PRIMARY;
  var b = secondary || DEFAULT_SECONDARY;
  return 'linear-gradient(88.19deg, ' + a + ' 1.53%, ' + b + ' 98.47%)';
}

/**
 * Apply CSS variables and font on a DOM element (iframe documentElement or host trigger).
 * @param {HTMLElement|null|undefined} el
 * @param {ReturnType<typeof parseBranding>} branding
 */
export function applyBrandingToElement(el, branding) {
  if (!el || !branding) return;

  if (branding.primaryColor) {
    el.style.setProperty('--reih-primary', branding.primaryColor);
    el.style.setProperty('--tenant-primary', branding.primaryColor);
    el.style.setProperty('--reih-accent', branding.primaryColor);
  }

  if (branding.secondaryColor) {
    el.style.setProperty('--reih-accent-teal', branding.secondaryColor);
  }

  if (branding.textPrimary) {
    el.style.setProperty('--reih-text-primary', branding.textPrimary);
    el.style.setProperty('--tenant-text-primary', branding.textPrimary);
  }

  if (branding.textSecondary) {
    el.style.setProperty('--reih-text-secondary', branding.textSecondary);
    el.style.setProperty('--tenant-text-secondary', branding.textSecondary);
  }

  var gradient = buildGradientBorder(
    branding.primaryColor,
    branding.secondaryColor,
    branding.gradientBorder
  );
  el.style.setProperty('--reih-gradient-border', gradient);
  el.style.setProperty('--tenant-gradient-border', gradient);

  if (branding.fontFamily) {
    el.style.setProperty('--reih-font-family', branding.fontFamily);
    el.style.setProperty('--v4-font-sans', branding.fontFamily);
    el.style.fontFamily = branding.fontFamily;
  }

  if (branding.fontFamilyHeading) {
    el.style.setProperty('--reih-font-family-heading', branding.fontFamilyHeading);
    el.style.setProperty('--v4-font-serif', branding.fontFamilyHeading);
  }
}

/**
 * Flatten branding into top-level config fields used by components.
 * @param {Record<string, unknown>|null|undefined} config
 */
export function mergeConfigWithBranding(config) {
  if (!config || typeof config !== 'object') return config;

  var branding = parseBranding(config);
  var merged = Object.assign({}, config, { branding: branding });

  if (branding.primaryColor) merged.primaryColor = branding.primaryColor;
  if (branding.logoUrl) merged.logoUrl = branding.logoUrl;
  if (branding.title) merged.title = branding.title;
  if (branding.subtitle) merged.subtitle = branding.subtitle;
  if (branding.fontFamily) merged.fontFamily = branding.fontFamily;
  if (branding.fontFamilyHeading) merged.fontFamilyHeading = branding.fontFamilyHeading;
  if (branding.textPrimary) merged.textPrimary = branding.textPrimary;
  if (branding.textSecondary) merged.textSecondary = branding.textSecondary;
  if (branding.poweredByText) merged.poweredByText = branding.poweredByText;
  if (branding.poweredByUrl) merged.poweredByUrl = branding.poweredByUrl;

  return merged;
}

/**
 * @param {HTMLElement|null|undefined} el
 * @param {Record<string, unknown>|null|undefined} config
 */
export function applyBrandingFromConfig(el, config) {
  applyBrandingToElement(el, parseBranding(config));
}
