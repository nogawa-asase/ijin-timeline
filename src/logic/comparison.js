import { MAX_LIFESPAN_YEARS, representativeYear } from './years.js';

/** @typedef {import('../data/person-parser.js').Person} Person */
/** @typedef {import('./years.js').YearValue} YearValue */

/**
 * @typedef {Object} Comparison
 * @property {'overlap'|'gap'|'undetermined'} kind  重なりあり / 重なりなし / 判定不可
 * @property {Person} [elder]         先に生まれた人物
 * @property {Person} [younger]       後に生まれた人物
 * @property {YearValue} [overlapStart]  重なり開始年(youngerの生年。kind='overlap'のとき)
 * @property {YearValue} [overlapEnd]    重なり終了年(先に亡くなった人物の没年。isOngoingのときは現在の年)
 * @property {number} [overlapStartAstroYear]  重なり開始年の天文学的年(描画用)
 * @property {number} [overlapEndAstroYear]    重なり終了年の天文学的年(描画用)
 * @property {boolean} [isOngoing]    2人とも存命で、重なりが現在まで続いているか
 * @property {number} [overlapYears]  重なり年数(kind='overlap'のとき)
 * @property {number} [ageAtBirth]    youngerが生まれたときのelderの年齢(kind='overlap'のとき)
 * @property {number|null} [gapYears]  elderの没年からyoungerの生年までの年数(kind='gap'のとき)。
 *                                     youngerが生年不明で計算できない場合はnull
 * @property {number} [deathGapYears]  elderの没年からyoungerの没年までの年数(gapYearsがnullのとき)
 * @property {Person[]} [unknownPeople]  没年不明の人物(kind='undetermined'のとき)
 * @property {Person[]} [unknownBirthPeople]  生年不明の人物(kind='undetermined'のとき)
 * @property {boolean} approximate    あいまいな年を含むかどうか
 */

/**
 * 人物の生存期間を天文学的年で返す。
 *
 * @param {Person} person
 * @param {number} currentYear  存命人物の終了年として使う
 * @returns {{ startAstroYear: number|null, endAstroYear: number|null }}
 *   開始年は生年不明のとき、終了年は没年不明のときnull
 */
export function lifespanOf(person, currentYear) {
  const startAstroYear = person.birth === null ? null : representativeYear(person.birth);
  if (person.lifeStatus === 'living') {
    return { startAstroYear, endAstroYear: currentYear };
  }
  if (person.lifeStatus === 'deceased' && person.death !== null) {
    return { startAstroYear, endAstroYear: representativeYear(person.death) };
  }
  return { startAstroYear, endAstroYear: null };
}

/**
 * 生年・没年のいずれかが年単位でないかどうかを返す。
 *
 * @param {Person[]} people
 * @returns {boolean}
 */
function hasApproximateYear(people) {
  return people.some(
    (person) =>
      (person.birth !== null && person.birth.precision !== 'year') ||
      (person.death !== null && person.death.precision !== 'year'),
  );
}

/**
 * 生存期間の終了年を表すYearValueを返す(存命なら現在の年)。
 *
 * @param {Person} person
 * @param {number} currentYear
 * @returns {YearValue}
 */
function endYearValueOf(person, currentYear) {
  if (person.lifeStatus === 'living' || person.death === null) {
    return { year: currentYear, precision: 'year' };
  }
  return person.death;
}

/**
 * 生年不明の人物と、生年・没年がわかる(または存命の)相手を比べる。
 * 同じ時代でないことが確実な場合だけ重なりなしとし、それ以外は判定不可にする。
 *
 * @param {Person} birthUnknown  生年不明の人物(lifeStatus = 'deceased')
 * @param {Person} other          生年がわかり、没年不明でない人物
 * @param {number} currentYear
 * @param {boolean} approximate
 * @returns {Comparison}
 */
function compareWithBirthUnknown(birthUnknown, other, currentYear, approximate) {
  const deathAstroYear = /** @type {number} */ (lifespanOf(birthUnknown, currentYear).endAstroYear);
  const otherSpan = lifespanOf(other, currentYear);
  const otherStartAstroYear = /** @type {number} */ (otherSpan.startAstroYear);
  const otherEndAstroYear = /** @type {number} */ (otherSpan.endAstroYear);

  // 生年不明の人物が亡くなった後に相手が生まれた場合は、空白の年数まで確定する
  if (otherStartAstroYear > deathAstroYear) {
    return {
      kind: 'gap',
      elder: birthUnknown,
      younger: other,
      gapYears: otherStartAstroYear - deathAstroYear,
      approximate,
    };
  }
  // 寿命の目安より前に相手が亡くなっていれば、生年不明の人物は相手の死後に生まれている
  const deathGapYears = deathAstroYear - otherEndAstroYear;
  if (deathGapYears > MAX_LIFESPAN_YEARS) {
    return {
      kind: 'gap',
      elder: other,
      younger: birthUnknown,
      gapYears: null,
      deathGapYears,
      approximate,
    };
  }
  return {
    kind: 'undetermined',
    unknownPeople: [],
    unknownBirthPeople: [birthUnknown],
    approximate,
  };
}

/**
 * 2人の生存期間を比べ、重なり・年齢関係・空白期間を計算する。
 *
 * @param {Person} a  1人目(同じ年に生まれた場合は先に生まれた側として扱う)
 * @param {Person} b  2人目
 * @param {number} currentYear  存命人物の終了年として使う
 * @returns {Comparison}
 */
export function comparePeople(a, b, currentYear) {
  const approximate = hasApproximateYear([a, b]);

  const unknownPeople = [a, b].filter((person) => person.lifeStatus === 'unknown');
  const unknownBirthPeople = [a, b].filter((person) => person.birth === null);
  if (unknownPeople.length === 0 && unknownBirthPeople.length === 1) {
    const [birthUnknown] = unknownBirthPeople;
    const other = birthUnknown === a ? b : a;
    return compareWithBirthUnknown(birthUnknown, other, currentYear, approximate);
  }
  if (unknownPeople.length > 0 || unknownBirthPeople.length > 0) {
    return { kind: 'undetermined', unknownPeople, unknownBirthPeople, approximate };
  }

  const aSpan = lifespanOf(a, currentYear);
  const bSpan = lifespanOf(b, currentYear);
  const isAElder = aSpan.startAstroYear <= bSpan.startAstroYear;
  const [elder, younger] = isAElder ? [a, b] : [b, a];
  const [elderSpan, youngerSpan] = isAElder ? [aSpan, bSpan] : [bSpan, aSpan];

  // 判定不可・生年不明を先に除外しているため、ここでは開始年・終了年は必ず数値になる
  const elderStartAstroYear = /** @type {number} */ (elderSpan.startAstroYear);
  const elderEndAstroYear = /** @type {number} */ (elderSpan.endAstroYear);
  const youngerEndAstroYear = /** @type {number} */ (youngerSpan.endAstroYear);
  const overlapStartAstroYear = /** @type {number} */ (youngerSpan.startAstroYear);

  if (overlapStartAstroYear > elderEndAstroYear) {
    return {
      kind: 'gap',
      elder,
      younger,
      gapYears: overlapStartAstroYear - elderEndAstroYear,
      approximate,
    };
  }

  // 同じ年に終わる場合は先に生まれた人物の没年を採用する
  const isElderEndFirst = elderEndAstroYear <= youngerEndAstroYear;
  const overlapEndAstroYear = Math.min(elderEndAstroYear, youngerEndAstroYear);
  const firstEnded = isElderEndFirst ? elder : younger;

  return {
    kind: 'overlap',
    elder,
    younger,
    overlapStart: younger.birth,
    overlapEnd: endYearValueOf(firstEnded, currentYear),
    overlapStartAstroYear,
    overlapEndAstroYear,
    isOngoing: elder.lifeStatus === 'living' && younger.lifeStatus === 'living',
    overlapYears: overlapEndAstroYear - overlapStartAstroYear,
    ageAtBirth: overlapStartAstroYear - elderStartAstroYear,
    approximate,
  };
}
