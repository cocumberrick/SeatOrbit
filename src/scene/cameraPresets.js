// Camera views are framed around the arena's measured rink and bowl dimensions.
export const CAMERA_PRESETS = {
  overview: {
    label: 'Arena Overview',
    // A wider diagonal gives the bowl room around its outside edge.
    position: [118, 176, 102],
    // Portrait framing turns the rink's long axis into screen height, leaving
    // the narrower end-to-end dimension across the phone screen.
    mobilePosition: [112, 168, 0],
    target: [0, 4, 0]
  },
  gameNightOverview: {
    label: 'Game Night Overview',
    // A lower diagonal establishes the lit ice, bowl tiers and center-hung board together.
    position: [130, 166, 100],
    mobilePosition: [126, 174, 0],
    target: [0, 4, 0]
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
