import { lifespanOf } from './comparison.js';
import { formatAxisYear, fromAstronomical, toAstronomical } from './years.js';

/** @typedef {import('../data/person-parser.js').Person} Person */

/**
 * @typedef {Object} DrawSpan
 * @property {number} startAstroYear  線の左端(天文学的年)
 * @property {number} endAstroYear    線の右端(天文学的年)
 * @property {boolean} isTentativeEnd  没年不明のため右端が仮の年かどうか
 */

/**
 * @typedef {Object} TimeRange
 * @property {number} rangeStart  表示範囲の左端(天文学的年)
 * @property {number} rangeEnd    表示範囲の右端(天文学的年)
 */

/**
 * @typedef {Object} Tick
 * @property {number} astroYear  目盛りの位置(天文学的年)
 * @property {string} label      目盛りのラベル(例: "1600", "前500")
 */

// 没年不明の人物は、生年からこの年数だけ線を引いて仮の終了年とする
const TENTATIVE_LIFESPAN_YEARS = 50;
const MIN_PADDING_YEARS = 5;
const PADDING_RATIO = 0.1;
const MAX_TICK_COUNT = 8;
const TICK_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

/**
 * 人物の線を描く期間を返す。没年不明の人物は仮の終了年を使う。
 *
 * @param {Person} person
 * @param {number} currentYear
 * @returns {DrawSpan}
 */
export function drawSpanOf(person, currentYear) {
  const { startAstroYear, endAstroYear } = lifespanOf(person, currentYear);
  if (endAstroYear === null) {
    return {
      startAstroYear,
      endAstroYear: startAstroYear + TENTATIVE_LIFESPAN_YEARS,
      isTentativeEnd: true,
    };
  }
  return { startAstroYear, endAstroYear, isTentativeEnd: false };
}

/**
 * すべての線が収まり、左右に余白を持つ表示範囲を返す。
 *
 * @param {DrawSpan[]} spans  1件以上
 * @returns {TimeRange}
 */
export function computeTimeRange(spans) {
  const minAstroYear = Math.min(...spans.map((span) => span.startAstroYear));
  const maxAstroYear = Math.max(...spans.map((span) => span.endAstroYear));
  const span = maxAstroYear - minAstroYear;
  const padding = Math.max(MIN_PADDING_YEARS, Math.round(span * PADDING_RATIO));
  return { rangeStart: minAstroYear - padding, rangeEnd: maxAstroYear + padding };
}

/**
 * 表示範囲内で、歴史的年が間隔の倍数になる年(0年を除く)を列挙する。
 *
 * @param {TimeRange} range
 * @param {number} step
 * @returns {number[]} 歴史的年の一覧
 */
function listTickYears(range, step) {
  // 天文学的年ではなく歴史的年の倍数に置くのは、紀元前のラベルを「前500」のように切りよくするため
  const firstYear = Math.ceil(fromAstronomical(range.rangeStart) / step) * step;
  const years = [];
  for (let year = firstYear; toAstronomical(year) <= range.rangeEnd; year += step) {
    if (year !== 0 && toAstronomical(year) >= range.rangeStart) {
      years.push(year);
    }
  }
  return years;
}

/**
 * 目盛りが最大8本になる最小の間隔を返す。どの間隔でも8本を超える場合は最大の間隔を返す。
 *
 * @param {TimeRange} range
 * @returns {number} 目盛りの間隔(年)
 */
export function chooseTickStep(range) {
  const rangeYears = range.rangeEnd - range.rangeStart;
  const step = TICK_STEPS.find(
    // 数え上げる前に概算で絞り、長い範囲で1年刻みを列挙する無駄を避ける
    (candidate) =>
      rangeYears / candidate <= MAX_TICK_COUNT + 1 &&
      listTickYears(range, candidate).length <= MAX_TICK_COUNT,
  );
  return step ?? TICK_STEPS[TICK_STEPS.length - 1];
}

/**
 * 表示範囲の目盛りの一覧を返す。
 *
 * @param {TimeRange} range
 * @returns {Tick[]}
 */
export function computeTicks(range) {
  const step = chooseTickStep(range);
  return listTickYears(range, step).map((year) => ({
    astroYear: toAstronomical(year),
    label: formatAxisYear(year),
  }));
}
