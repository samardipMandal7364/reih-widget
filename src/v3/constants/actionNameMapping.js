/**
 * Human-readable labels for generation action_name values (aligned with main app ACTION_NAME_MAPPING).
 */
export const ACTION_NAME_MAPPING = {
  VIRTUAL_STAGING: 'Virtually Staged',
  VIRTUAL_STAGING_V2: 'Virtually Staged',
  IMAGE_ENHANCEMENT: 'Image enhancement',
  DECLUTTER: 'Declutter',
  SKY_REPLACEMENT: 'Sky replacement',
  LAWN_REPLACEMENT: 'Lawn enhancement',
  PAINT: 'Paint',
  FLOOR: 'Flooring',
  REMOVE_WATERMARK: 'Remove watermark',
  ORIGINAL: 'Original',
  Original: 'Original',
  GENERATED: 'Generated',
  Generated: 'Generated',
};

export function mapActionName(actionName) {
  if (!actionName) return '';
  return ACTION_NAME_MAPPING[actionName] || actionName;
}
