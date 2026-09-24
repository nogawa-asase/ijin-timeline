// timeline-view.js 専用の、人物1人分の行(名前・線・生没年)の描画。timeline-view.js からのみ import する
import { formatYearValue } from '../../logic/years.js';
import { appendText, createSvgElement, measureText } from './svg.js';

/** @typedef {import('../../data/person-parser.js').Person} Person */
/** @typedef {import('../../logic/timeline-scale.js').DrawSpan} DrawSpan */

/**
 * @typedef {Object} TimelineRow
 * @property {Person} person
 * @property {number} slotNumber  入力欄の番号(1始まり)。線の色を決める
 * @property {DrawSpan} span
 */

/**
 * @typedef {Object} Layout
 * @property {number} width
 * @property {(astroYear: number) => number} toX  天文学的年 → x座標
 * @property {number} plotTop     人物の行の上端
 * @property {number} axisY       目盛りの軸のy座標
 */

export const ROW_HEIGHT = 60;
const NAME_OFFSET_Y = 16;
const LINE_OFFSET_Y = 30;
const LABEL_BELOW_OFFSET_Y = 50;
const LABEL_GAP = 4;
const ARROW_LENGTH = 10;
const ARROW_HALF_HEIGHT = 7;
const DASHED_RATIO = 0.1;
const MIN_DASHED_LENGTH = 20;

/**
 * 線の両端のうち、点線にする長さを返す(あいまいな年の端)。
 *
 * @param {Person} person
 * @param {number} lineLength
 * @returns {{ startDashed: number, endDashed: number }}
 */
function dashedLengthsOf(person, lineLength) {
  const dashedLength = Math.max(MIN_DASHED_LENGTH, lineLength * DASHED_RATIO);
  // 線が短いときに両端の点線が重ならないよう、それぞれ線の半分までにする
  const limitedLength = Math.min(dashedLength, lineLength / 2);
  const isBirthApproximate = person.birth.precision !== 'year';
  const isDeathApproximate = person.death !== null && person.death.precision !== 'year';
  return {
    startDashed: isBirthApproximate ? limitedLength : 0,
    endDashed: isDeathApproximate ? limitedLength : 0,
  };
}

/**
 * 人物の線を描く(点線の端、存命の矢印を含む)。
 *
 * @param {SVGElement} svg
 * @param {TimelineRow} row
 * @param {number} startX
 * @param {number} endX
 * @param {number} lineY
 */
function drawLifeLine(svg, row, startX, endX, lineY) {
  const { person, slotNumber, span } = row;
  const colorClass = `is-person-${slotNumber}`;
  const drawSegment = (fromX, toX, isDashed) => {
    if (toX <= fromX) {
      return;
    }
    const className = `timeline-line ${colorClass}${isDashed ? ' is-dashed' : ''}`;
    svg.append(createSvgElement('line', { x1: fromX, y1: lineY, x2: toX, y2: lineY }, className));
  };

  // 没年不明は線全体を点線にするため、あいまいな年の端の点線は重ねない
  if (span.isTentativeEnd) {
    drawSegment(startX, endX, true);
    return;
  }

  const isLiving = person.lifeStatus === 'living';
  const lineEndX = isLiving ? Math.max(startX, endX - ARROW_LENGTH) : endX;
  const { startDashed, endDashed } = dashedLengthsOf(person, lineEndX - startX);
  drawSegment(startX, startX + startDashed, true);
  drawSegment(startX + startDashed, lineEndX - endDashed, false);
  drawSegment(lineEndX - endDashed, lineEndX, true);

  if (isLiving) {
    const points = [
      `${lineEndX},${lineY - ARROW_HALF_HEIGHT}`,
      `${endX},${lineY}`,
      `${lineEndX},${lineY + ARROW_HALF_HEIGHT}`,
    ].join(' ');
    svg.append(createSvgElement('polygon', { points }, `timeline-arrow ${colorClass}`));
  }
}

/**
 * 線の右端に表示する文字列を返す。
 *
 * @param {Person} person
 * @returns {string}
 */
export function endLabelOf(person) {
  if (person.lifeStatus === 'living') {
    return '存命';
  }
  if (person.lifeStatus === 'unknown' || person.death === null) {
    return '没年不明';
  }
  return formatYearValue(person.death);
}

/**
 * 生年・没年のラベルを線の両端に描く。入りきらない場合は線の下に端を揃えて描く。
 *
 * @param {SVGElement} svg
 * @param {Layout} layout
 * @param {TimelineRow} row
 * @param {{ startX: number, endX: number, lineY: number, belowY: number }} position
 */
function drawYearLabels(svg, layout, row, position) {
  const { startX, endX, lineY, belowY } = position;
  const textY = lineY + 4;

  const birthSvg = appendText(
    svg,
    formatYearValue(row.person.birth),
    { x: startX - LABEL_GAP, y: textY, 'text-anchor': 'end' },
    'timeline-year',
  );
  const birthWidth = measureText(birthSvg);
  const isBirthBelow = birthWidth + LABEL_GAP > startX;
  if (isBirthBelow) {
    birthSvg.setAttribute('x', String(startX));
    birthSvg.setAttribute('y', String(belowY));
    birthSvg.setAttribute('text-anchor', 'start');
  }

  const endSvg = appendText(
    svg,
    endLabelOf(row.person),
    { x: endX + LABEL_GAP, y: textY, 'text-anchor': 'start' },
    'timeline-year',
  );
  const endWidth = measureText(endSvg);
  if (endWidth + LABEL_GAP > layout.width - endX) {
    // 線が短く、下に置いた生年のラベルと重なる場合は、生年のラベルの後ろに並べる
    const minEndX = isBirthBelow ? startX + birthWidth + LABEL_GAP * 2 + endWidth : 0;
    endSvg.setAttribute('x', String(Math.max(endX, minEndX)));
    endSvg.setAttribute('y', String(belowY));
    endSvg.setAttribute('text-anchor', 'end');
  }
}

/**
 * 人物1人分の行(名前・線・生没年)を描く。
 *
 * @param {SVGElement} svg
 * @param {Layout} layout
 * @param {TimelineRow} row
 * @param {number} rowIndex
 */
export function drawPersonRow(svg, layout, row, rowIndex) {
  const rowTop = layout.plotTop + rowIndex * ROW_HEIGHT;
  const startX = layout.toX(row.span.startAstroYear);
  const endX = layout.toX(row.span.endAstroYear);
  const lineY = rowTop + LINE_OFFSET_Y;

  const nameSvg = appendText(
    svg,
    row.person.label,
    { x: startX, y: rowTop + NAME_OFFSET_Y },
    'timeline-name',
  );
  // 右端に近い人物の名前が画面外にはみ出さないよう、左に寄せる
  const maxNameX = layout.width - measureText(nameSvg);
  nameSvg.setAttribute('x', String(Math.max(0, Math.min(startX, maxNameX))));

  drawLifeLine(svg, row, startX, endX, lineY);
  drawYearLabels(svg, layout, row, {
    startX,
    endX,
    lineY,
    belowY: rowTop + LABEL_BELOW_OFFSET_Y,
  });
}
