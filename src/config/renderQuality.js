export const QUALITY_MODE = Object.freeze({
  LITE: 1,
  STANDARD: 2,
  ULTRA: 3
});

export const QUALITY_LEVELS = Object.freeze([
  Object.freeze({
    id: QUALITY_MODE.LITE,
    key: 'lite',
    label: 'Lite',
    pixelRatio: 1,
    description: 'Core arena, seats and saved fan flags with the crowd and show effects disabled.'
  }),
  Object.freeze({
    id: QUALITY_MODE.STANDARD,
    key: 'standard',
    label: 'Standard',
    pixelRatio: 1.5,
    description: 'Balanced arena with seated fans, fan flags and the video board.'
  }),
  Object.freeze({
    id: QUALITY_MODE.ULTRA,
    key: 'ultra',
    label: 'Ultra',
    pixelRatio: 2,
    description: 'Full crowd density, premium details and the complete arena light show.'
  })
]);

export function normalizeQualityMode(mode) {
  const value = Number(mode);
  return QUALITY_LEVELS.some((level) => level.id === value) ? value : QUALITY_MODE.STANDARD;
}

export function getQualityLevel(mode) {
  const normalizedMode = normalizeQualityMode(mode);
  return QUALITY_LEVELS.find((level) => level.id === normalizedMode);
}
