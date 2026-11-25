/**
 * createSeats.js — thin back-compat wrapper around SeatLayoutBuilder.
 *
 * Public API unchanged:
 *   createSeats(bounds[, options]) -> { mesh, data, sectionBounds, outlines, controller }
 *   computeSectionBounds(seats), createSectionOutlines(seats)
 *
 * First build is byte-identical to the previous implementation (same generator, same loop
 * order, same RNG seeds), so existing numeric seat ids and saved photo billboards stay valid.
 */

import {
  createSeatLayoutBuilder,
  createSectionOutlines
} from './seatLayoutBuilder.js';
import {
  computeSectionBounds,
  seatKey,
  parseSeatKey
} from './seatLayout.js';
import {
  buildArenaSeatLayout,
  createLegacyDecor
} from './proceduralSeatLayout.js';

export { computeSectionBounds, createSectionOutlines };
export { seatKey, parseSeatKey };

export function createSeats(bounds, options) {
  const generated = buildArenaSeatLayout();
  const placements = options && Array.isArray(options.placements) ? options.placements : generated.placements;
  const perTier = generated.perTier;

  const controller = createSeatLayoutBuilder(Object.assign({
    placements,
    decor: createLegacyDecor(),
    name: 'Seats'
  }, options || {}));

  const { mesh, data, sectionBounds, outlines } = controller;

  console.info(
    `[Seats] ${data.length.toLocaleString()} seats generated in ` +
    `${Object.keys(sectionBounds).length} sections ` +
    `(lower ${perTier.lower}, club ${perTier.club}, upper ${perTier.upper}) ` +
    `capacity ${controller.capacity}`
  );

  return { mesh, data, sectionBounds, outlines, controller, placements };
}

export default createSeats;
