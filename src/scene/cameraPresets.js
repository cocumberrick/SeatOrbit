// Camera views are framed around the arena's measured rink and bowl dimensions.
export const CAMERA_PRESETS = {
  overview: {
    label: 'Arena Overview',
    position: [88, 142, 96],
    target: [0, 0, 0]
  },
  gameNightOverview: {
    label: 'Game Night Overview',
    // A lower diagonal establishes the lit ice, bowl tiers and center-hung board together.
    position: [94, 112, 77],
    target: [0, 1, 0]
  },
  fieldLevel: {
    label: 'Ice Level',
    // Rink-side position just above the glass, angled down enough to show the ice
    // instead of grazing the surface graphics.
    position: [18.5, -2.8, 0],
    target: [0, -7.8, 0]
  },
  exterior: {
    label: 'Exterior View',
    position: [118, 67, 95],
    target: [0, 12, 0]
  },
  walk: {
    label: 'Walk / Jump Mode',
    // Start on the ice with clear access to the rink, seating tiers and concourses.
    position: [0, -6.85, 0],
    target: [0, -6.85, -20]
  }
};
