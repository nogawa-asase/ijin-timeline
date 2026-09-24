/**
 * @typedef {Object} YearValue
 * @property {number} year  歴史的な西暦年。紀元前は負数(前551年 = -551)。0は存在しない
 * @property {'year'|'decade'|'century'} precision  年の確かさ
 */

/** @typedef {'deceased'|'living'|'unknown'} LifeStatus */

/**
 * 歴史的年を、0年を含む連続した数値(天文学的年)に変換する。
 *
 * @param {number} year  歴史的年(紀元前は負数)
 * @returns {number} 天文学的年(前1年 = 0、前551年 = -550)
 */
export function toAstronomical(year) {
  return year < 0 ? year + 1 : year;
}

/**
 * 天文学的年を歴史的年に変換する。
 *
 * @param {number} astroYear  天文学的年
 * @returns {number} 歴史的年(0 → -1)
 */
export function fromAstronomical(astroYear) {
  return astroYear <= 0 ? astroYear - 1 : astroYear;
}

/**
 * 2つの歴史的年の差(年数)を返す。西暦に0年がないことを考慮する。
 *
 * @param {number} fromYear  開始年(紀元前は負数)
 * @param {number} toYear    終了年(紀元前は負数)
 * @returns {number} 年数(例: yearsBetween(-4, 30) === 33)
 */
export function yearsBetween(fromYear, toYear) {
  return toAstronomical(toYear) - toAstronomical(fromYear);
}

/**
 * 歴史的年が属する世紀を返す(紀元前も正の数で返す)。
 *
 * @param {number} year  歴史的年
 * @returns {number} 世紀(600 → 6、501 → 6、-551 → 6)
 */
function centuryOf(year) {
  const absoluteYear = Math.abs(year);
  return Math.floor((absoluteYear - 1) / 100) + 1;
}

/**
 * 年の値を日本語で表記する。
 *
 * @param {YearValue} yearValue
 * @returns {string} 例: "1534年", "前551年", "1530年代", "6世紀頃", "前6世紀頃"
 */
export function formatYearValue(yearValue) {
  const { year, precision } = yearValue;
  const prefix = year < 0 ? '前' : '';

  if (precision === 'century') {
    return `${prefix}${centuryOf(year)}世紀頃`;
  }
  if (precision === 'decade') {
    return `${prefix}${Math.abs(year)}年代`;
  }
  return `${prefix}${Math.abs(year)}年`;
}

/**
 * 目盛り用の短い年の表記を返す。
 *
 * @param {number} year  歴史的年
 * @returns {string} 例: "1600", "前500"
 */
export function formatAxisYear(year) {
  return year < 0 ? `前${-year}` : `${year}`;
}

/**
 * 描画・計算に使う代表年を天文学的年で返す。あいまいな年は期間の中央を代表とする。
 *
 * @param {YearValue} yearValue
 * @returns {number} 天文学的年
 */
export function representativeYear(yearValue) {
  const { year, precision } = yearValue;

  if (precision === 'decade') {
    // 年代の値は先頭年(紀元前は絶対値が小さい側)なので、過去側に5年ずらすと中央になる
    return toAstronomical(year < 0 ? year - 5 : year + 5);
  }
  if (precision === 'century') {
    const middleYear = (centuryOf(year) - 1) * 100 + 50;
    return toAstronomical(year < 0 ? -middleYear : middleYear);
  }
  return toAstronomical(year);
}

/**
 * 生年と没年をまとめて表記する(括弧は付けない)。
 *
 * @param {YearValue} birth
 * @param {YearValue|null} death
 * @param {LifeStatus} lifeStatus
 * @returns {string} 例: "1534年–1582年"、存命は "1960年–"、没年不明は "1100年–?"
 */
export function formatLifespan(birth, death, lifeStatus) {
  const birthText = formatYearValue(birth);
  if (lifeStatus === 'living') {
    return `${birthText}–`;
  }
  if (lifeStatus === 'unknown' || death === null) {
    return `${birthText}–?`;
  }
  return `${birthText}–${formatYearValue(death)}`;
}
