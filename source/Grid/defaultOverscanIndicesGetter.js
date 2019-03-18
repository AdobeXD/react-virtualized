// @flow

import type {OverscanIndicesGetterParams, OverscanIndices} from './types';

export const SCROLL_DIRECTION_BACKWARD = -1;
export const SCROLL_DIRECTION_FORWARD = 1;

export const SCROLL_DIRECTION_HORIZONTAL = 'horizontal';
export const SCROLL_DIRECTION_VERTICAL = 'vertical';

/**
 * Calculates the number of cells to overscan before and after a specified range.
 * This function ensures that overscanning doesn't exceed the available cells.
 */

export default function defaultOverscanIndicesGetter({
  cellCount,
  overscanCellsCount,
  scrollDirection,
  startIndex,
  stopIndex,
}: OverscanIndicesGetterParams): OverscanIndices {
  // TODO: Move to application. Making buffer cells in both directions
  debugger;
  return {
    overscanStartIndex: Math.max(0, startIndex - overscanCellsCount),
    overscanStopIndex: Math.min(cellCount - 1, stopIndex + overscanCellsCount),
  };
}
