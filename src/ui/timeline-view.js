import { comparePeople } from '../logic/comparison.js';
import { computeTicks, computeTimeRange, drawSpanOf } from '../logic/timeline-scale.js';
import { formatYearValue } from '../logic/years.js';
import { drawPersonRow, endLabelOf, ROW_HEIGHT } from './timeline/person-row.js';
import { appendText, createSvgElement } from './timeline/svg.js';

/** @typedef {import('../data/person-parser.js').Person} Person */
/** @typedef {import('./timeline/person-row.js').TimelineRow} TimelineRow */
/** @typedef {import('./timeline/person-row.js').Layout} Layout */

// 目盛りのラベル(最長で「前1000」程度)が左右にはみ出さない余白
const MARGIN_X = 24;
const PLOT_TOP = 8;
const AXIS_AREA_HEIGHT = 32;
// 重なりが1年未満でも見えるようにする最小の幅
const MIN_OVERLAP_WIDTH = 2;

/**
 * 表示範囲と画面幅から、座標変換などの配置情報を作る。
 *
 * @param {TimelineRow[]} rows
 * @param {number} width
 * @returns {{ layout: Layout, height: number, range: import('../logic/timeline-scale.js').TimeRange }}
 */
function createLayout(rows, width) {
  const range = computeTimeRange(rows.map((row) => row.span));
  const { rangeStart, rangeEnd } = range;
  const plotWidth = width - MARGIN_X * 2;
  const toX = (astroYear) =>
    MARGIN_X + ((astroYear - rangeStart) / (rangeEnd - rangeStart)) * plotWidth;
  const axisY = PLOT_TOP + rows.length * ROW_HEIGHT;
  return {
    layout: { width, toX, plotTop: PLOT_TOP, axisY },
    height: axisY + AXIS_AREA_HEIGHT,
    range,
  };
}

/**
 * 目盛り・縦の補助線・軸を描く。
 *
 * @param {SVGElement} svg
 * @param {Layout} layout
 * @param {import('../logic/timeline-scale.js').Tick[]} ticks
 */
function drawAxis(svg, layout, ticks) {
  const { width, toX, plotTop, axisY } = layout;
  svg.append(createSvgElement('line', { x1: 0, y1: axisY, x2: width, y2: axisY }, 'timeline-axis'));
  for (const tick of ticks) {
    const x = toX(tick.astroYear);
    svg.append(createSvgElement('line', { x1: x, y1: plotTop, x2: x, y2: axisY }, 'timeline-grid'));
    appendText(svg, tick.label, { x, y: axisY + 18, 'text-anchor': 'middle' }, 'timeline-tick-label');
  }
}

/**
 * 先頭の2人の生存期間が重なる区間に背景を塗る。
 *
 * @param {SVGElement} svg
 * @param {Layout} layout
 * @param {TimelineRow[]} rows
 * @param {number} currentYear
 */
function drawOverlap(svg, layout, rows, currentYear) {
  if (rows.length < 2) {
    return;
  }
  const comparison = comparePeople(rows[0].person, rows[1].person, currentYear);
  if (comparison.kind !== 'overlap') {
    return;
  }
  const startX = layout.toX(/** @type {number} */ (comparison.overlapStartAstroYear));
  const endX = layout.toX(/** @type {number} */ (comparison.overlapEndAstroYear));
  const width = Math.max(MIN_OVERLAP_WIDTH, endX - startX);
  svg.append(
    createSvgElement(
      'rect',
      { x: startX, y: layout.plotTop, width, height: layout.axisY - layout.plotTop },
      'timeline-overlap',
    ),
  );
}

/**
 * スクリーンリーダー向けに、タイムラインの内容の要約を作る。
 *
 * @param {TimelineRow[]} rows
 * @returns {string} 例: "織田信長 1534年〜1582年、徳川家康 1543年〜1616年のタイムライン"
 */
function describeTimeline(rows) {
  const summaries = rows.map(({ person }) => {
    return `${person.label} ${formatYearValue(person.birth)}〜${endLabelOf(person)}`;
  });
  return `${summaries.join('、')}のタイムライン`;
}

/**
 * 選択済みの人物からSVGのタイムラインを描画する。人物がいなければ中身を空にする。
 * SVGは表示された状態で呼ぶこと(文字の幅を測るため)。
 *
 * @param {SVGSVGElement} svg
 * @param {(Person|null)[]} slots  入力欄ごとの選択済み人物(未選択はnull)
 * @param {number} currentYear
 * @param {number} width  描画幅(px)。コンテナの幅から算出
 */
export function renderTimeline(svg, slots, currentYear, width) {
  /** @type {TimelineRow[]} */
  const rows = [];
  slots.forEach((person, index) => {
    if (person !== null) {
      rows.push({ person, slotNumber: index + 1, span: drawSpanOf(person, currentYear) });
    }
  });

  svg.replaceChildren();
  if (rows.length === 0) {
    svg.removeAttribute('aria-label');
    return;
  }

  const { layout, height, range } = createLayout(rows, width);
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(height));
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('aria-label', describeTimeline(rows));

  // 後から描いたものが上に重なるため、背景(重なり区間・目盛り)を先に描く
  drawOverlap(svg, layout, rows, currentYear);
  drawAxis(svg, layout, computeTicks(range));
  rows.forEach((row, rowIndex) => drawPersonRow(svg, layout, row, rowIndex));
}
