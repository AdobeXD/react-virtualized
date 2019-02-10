/** @flow */

import type {CellRangeRendererParams} from './types';

function foreachKey(
  rowStartIndex,
  rowStopIndex,
  columnStartIndex,
  columnStopIndex,
  callback,
) {
  for (let rowIndex = rowStartIndex; rowIndex <= rowStopIndex; rowIndex++) {
    for (
      let columnIndex = columnStartIndex;
      columnIndex <= columnStopIndex;
      columnIndex++
    ) {
      let key = getKey(rowIndex, columnIndex);
      callback(key);
    }
  }
}

// function checkValuesUnique(values) {
//   let newSet = new Set();
//   for (let value of values) {
//     if (newSet.has(value)) {
//       debugger;
//     } else {
//       newSet.add(value);
//     }
//   }
// }

class ReusableKeyCache {
  constructor() {
    this.lastMap = new Map();
  }

  static symbol = Symbol('ReusableKeyCache_symbol');
  static getReusableKeyCache(cellCache) {
    let reusableKeyCache = cellCache[ReusableKeyCache.symbol];
    if (reusableKeyCache == null) {
      reusableKeyCache = cellCache[
        ReusableKeyCache.symbol
      ] = new ReusableKeyCache();
    }
    return reusableKeyCache;
  }

  getReusableKeyMap(
    rowStartIndex,
    rowStopIndex,
    columnStartIndex,
    columnStopIndex,
  ) {
    // so, each thing has to get it's own shit
    let newMap = new Map();
    let usedKeys = [];
    let lastMap = this.lastMap;
    let nextKey = 1;

    foreachKey(
      rowStartIndex,
      rowStopIndex,
      columnStartIndex,
      columnStopIndex,
      key => {
        let lastKey = lastMap.get(key);
        if (lastKey != null) {
          newMap.set(key, lastKey);
          usedKeys[lastKey] = true;
        }
      },
    );

    foreachKey(
      rowStartIndex,
      rowStopIndex,
      columnStartIndex,
      columnStopIndex,
      key => {
        let newKey = newMap.get(key);
        if (newKey == null) {
          // find new key for this
          while (newKey == null) {
            if (!usedKeys[nextKey]) {
              newKey = nextKey;
            }
            nextKey++;
          }
        }
        newMap.set(key, newKey);
        usedKeys[newKey] = true;
      },
    );

    this.lastMap = newMap;
    return newMap;
  }
}

function getKey(rowIndex, columnIndex) {
  return `${rowIndex}-${columnIndex}`;
}

/**
 * Default implementation of cellRangeRenderer used by Grid.
 * This renderer supports cell-caching while the user is scrolling.
 */

export default function defaultCellRangeRenderer({
  cellCache,
  cellRenderer,
  columnSizeAndPositionManager,
  columnStartIndex,
  columnStopIndex,
  deferredMeasurementCache,
  horizontalOffsetAdjustment,
  isScrolling,
  isScrollingOptOut,
  parent, // Grid (or List or Table)
  rowSizeAndPositionManager,
  rowStartIndex,
  rowStopIndex,
  styleCache,
  verticalOffsetAdjustment,
  visibleColumnIndices,
  visibleRowIndices,
}: CellRangeRendererParams) {
  const renderedCells = [];

  let reusableKeyCache = ReusableKeyCache.getReusableKeyCache(cellCache);
  let reusableKeyMap = reusableKeyCache.getReusableKeyMap(
    rowStartIndex,
    rowStopIndex,
    columnStartIndex,
    columnStopIndex,
  );
  //  console.log('+++++++', JSON.stringify(Array.from(reusableKeyMap.values())));

  // Browsers have native size limits for elements (eg Chrome 33M pixels, IE 1.5M pixes).
  // User cannot scroll beyond these size limitations.
  // In order to work around this, ScalingCellSizeAndPositionManager compresses offsets.
  // We should never cache styles for compressed offsets though as this can lead to bugs.
  // See issue #576 for more.
  const areOffsetsAdjusted =
    columnSizeAndPositionManager.areOffsetsAdjusted() ||
    rowSizeAndPositionManager.areOffsetsAdjusted();

  const canCacheStyle = !isScrolling && !areOffsetsAdjusted;

  for (let rowIndex = rowStartIndex; rowIndex <= rowStopIndex; rowIndex++) {
    let rowDatum = rowSizeAndPositionManager.getSizeAndPositionOfCell(rowIndex);

    for (
      let columnIndex = columnStartIndex;
      columnIndex <= columnStopIndex;
      columnIndex++
    ) {
      let columnDatum = columnSizeAndPositionManager.getSizeAndPositionOfCell(
        columnIndex,
      );
      let isVisible =
        columnIndex >= visibleColumnIndices.start &&
        columnIndex <= visibleColumnIndices.stop &&
        rowIndex >= visibleRowIndices.start &&
        rowIndex <= visibleRowIndices.stop;
      let key = getKey(rowIndex, columnIndex);
      let reuseKey = reusableKeyMap.get(key).toString();
      let style;

      // Cache style objects so shallow-compare doesn't re-render unnecessarily.
      if (canCacheStyle && styleCache[key]) {
        style = styleCache[key];
      } else {
        // In deferred mode, cells will be initially rendered before we know their size.
        // Don't interfere with CellMeasurer's measurements by setting an invalid size.
        if (
          deferredMeasurementCache &&
          !deferredMeasurementCache.has(rowIndex, columnIndex)
        ) {
          // Position not-yet-measured cells at top/left 0,0,
          // And give them width/height of 'auto' so they can grow larger than the parent Grid if necessary.
          // Positioning them further to the right/bottom influences their measured size.
          style = {
            height: 'auto',
            left: 0,
            position: 'absolute',
            top: 0,
            width: 'auto',
          };
        } else {
          style = {
            height: rowDatum.size,
            left: columnDatum.offset + horizontalOffsetAdjustment,
            position: 'absolute',
            top: rowDatum.offset + verticalOffsetAdjustment,
            width: columnDatum.size,
          };

          styleCache[key] = style;
        }
      }

      let cellRendererParams = {
        columnIndex,
        isScrolling,
        isVisible,
        key: reuseKey,
        parent,
        rowIndex,
        style,
      };

      let renderedCell;

      // Avoid re-creating cells while scrolling.
      // This can lead to the same cell being created many times and can cause performance issues for "heavy" cells.
      // If a scroll is in progress- cache and reuse cells.
      // This cache will be thrown away once scrolling completes.
      // However if we are scaling scroll positions and sizes, we should also avoid caching.
      // This is because the offset changes slightly as scroll position changes and caching leads to stale values.
      // For more info refer to issue #395
      //
      // If isScrollingOptOut is specified, we always cache cells.
      // For more info refer to issue #1028
      if (
        (isScrollingOptOut || isScrolling) &&
        !horizontalOffsetAdjustment &&
        !verticalOffsetAdjustment
      ) {
        if (!cellCache[key]) {
          cellCache[key] = cellRenderer(cellRendererParams);
        }

        renderedCell = cellCache[key];
        if (renderedCell && renderedCell.key !== reuseKey) {
          // this prevents a previously cached cell from using a wrong and possibly duplicate key
          renderedCell = Object.assign({}, renderedCell, {key: reuseKey});
        }

        // If the user is no longer scrolling, don't cache cells.
        // This makes dynamic cell content difficult for users and would also lead to a heavier memory footprint.
      } else {
        renderedCell = cellRenderer(cellRendererParams);
      }

      if (renderedCell == null || renderedCell === false) {
        continue;
      }

      if (process.env.NODE_ENV !== 'production') {
        warnAboutMissingStyle(parent, renderedCell);
      }

      renderedCells.push(renderedCell);
    }
  }

  // checkValuesUnique(renderedCells.map(cell => cell.key));

  renderedCells.sort((a, b) => {
    return parseInt(b.key) - parseInt(a.key);
  });

  return renderedCells;
}

function warnAboutMissingStyle(parent, renderedCell) {
  if (process.env.NODE_ENV !== 'production') {
    if (renderedCell) {
      // If the direct child is a CellMeasurer, then we should check its child
      // See issue #611
      if (renderedCell.type && renderedCell.type.__internalCellMeasurerFlag) {
        renderedCell = renderedCell.props.children;
      }

      if (
        renderedCell &&
        renderedCell.props &&
        renderedCell.props.style === undefined &&
        parent.__warnedAboutMissingStyle !== true
      ) {
        parent.__warnedAboutMissingStyle = true;

        console.warn(
          'Rendered cell should include style property for positioning.',
        );
      }
    }
  }
}
