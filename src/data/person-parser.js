/** @typedef {import('../logic/years.js').YearValue} YearValue */
/** @typedef {import('../logic/years.js').LifeStatus} LifeStatus */

/**
 * @typedef {Object} Person
 * @property {string} id           WikidataのID(例: "Q171411")
 * @property {string} label        表示名(日本語 → 多言語共通 → 英語 → IDの順で使う)
 * @property {string} description  短い説明(日本語。なければ空文字)
 * @property {YearValue} birth     生年
 * @property {YearValue|null} death  没年(ない場合はnull)
 * @property {LifeStatus} lifeStatus  没年の状態
 */

// Q5: 人間
const HUMAN_ID = 'Q5';
// P31: 分類(instance of)
const INSTANCE_OF = 'P31';
// P569: 生年月日
const DATE_OF_BIRTH = 'P569';
// P570: 死亡年月日
const DATE_OF_DEATH = 'P570';
// 記録上の最長寿命(122歳)を目安に、これより新しい生年で没年がなければ存命とみなす
const MAX_LIFESPAN_YEARS = 120;
// ja の次に mul(全言語共通ラベル)を見るのは、名前を mul だけに登録している人物がいるため
const LABEL_LANGUAGES = ['ja', 'mul', 'en'];

// Wikidataの精度: 9 = 年、8 = 年代、7 = 世紀(それより粗い精度も世紀として扱う)
const PRECISION_YEAR = 9;
const PRECISION_DECADE = 8;

/**
 * Wikidataの時刻文字列と精度をYearValueに変換する。
 *
 * @param {string} time  例: "+1534-06-23T00:00:00Z", "-0551-00-00T00:00:00Z"
 * @param {number} precision  Wikidataの精度(9=年, 8=年代, 7=世紀 など)
 * @returns {YearValue|null}  形式が不正、または年が0の場合はnull
 */
export function parseYearValue(time, precision) {
  const match = /^([+-])(\d+)-/.exec(time);
  if (match === null || typeof precision !== 'number') {
    return null;
  }
  const absoluteYear = Number(match[2]);
  const year = match[1] === '-' ? -absoluteYear : absoluteYear;
  if (year === 0) {
    return null;
  }

  if (precision >= PRECISION_YEAR) {
    return { year, precision: 'year' };
  }
  if (precision === PRECISION_DECADE) {
    // 前1〜前9年の年代は切り下げると0年になるため、世紀として扱う
    const decadeYear = Math.trunc(year / 10) * 10;
    return decadeYear === 0 ? { year, precision: 'century' } : { year: decadeYear, precision: 'decade' };
  }
  return { year, precision: 'century' };
}

/**
 * 複数の値から使う値を1つ選ぶ(A1)。deprecatedを除き、preferredがあればその先頭、なければ先頭。
 *
 * @param {Object[]|undefined} claims  entity.claims[プロパティ番号]
 * @returns {Object|null}  選んだ値のmainsnak。値がなければnull
 */
function selectMainSnak(claims) {
  if (!Array.isArray(claims)) {
    return null;
  }
  const usableClaims = claims.filter((claim) => claim?.rank !== 'deprecated' && claim.mainsnak);
  const selected =
    usableClaims.find((claim) => claim.rank === 'preferred') ?? usableClaims[0] ?? null;
  return selected === null ? null : selected.mainsnak;
}

/**
 * mainsnakの時刻の値をYearValueに変換する。
 *
 * @param {Object} mainSnak
 * @returns {YearValue|null}
 */
function yearValueOfSnak(mainSnak) {
  const value = mainSnak.datavalue?.value;
  if (typeof value?.time !== 'string') {
    return null;
  }
  return parseYearValue(value.time, value.precision);
}

/**
 * 人間(P31にQ5を含む)かどうかを返す。
 *
 * @param {Object} claims
 * @returns {boolean}
 */
function isHuman(claims) {
  const instanceClaims = claims[INSTANCE_OF];
  if (!Array.isArray(instanceClaims)) {
    return false;
  }
  return instanceClaims.some((claim) => claim?.mainsnak?.datavalue?.value?.id === HUMAN_ID);
}

/**
 * 生年を読み取る。値がない・不明な値・不正な値の場合はnull。
 *
 * @param {Object} claims
 * @returns {YearValue|null}
 */
function parseBirth(claims) {
  const mainSnak = selectMainSnak(claims[DATE_OF_BIRTH]);
  if (mainSnak === null || mainSnak.snaktype !== 'value') {
    return null;
  }
  return yearValueOfSnak(mainSnak);
}

/**
 * 没年と没年の状態を読み取る。
 *
 * @param {Object} claims
 * @param {YearValue} birth
 * @param {number} currentYear
 * @returns {{ death: YearValue|null, lifeStatus: LifeStatus }}
 */
function parseDeath(claims, birth, currentYear) {
  const mainSnak = selectMainSnak(claims[DATE_OF_DEATH]);
  if (mainSnak?.snaktype === 'somevalue') {
    return { death: null, lifeStatus: 'unknown' };
  }
  const death = mainSnak?.snaktype === 'value' ? yearValueOfSnak(mainSnak) : null;
  if (death !== null) {
    return { death, lifeStatus: 'deceased' };
  }
  // 没年データがない(novalue・不正な値を含む)場合は、生年から存命かどうかを判断する
  const isLiving = birth.year >= currentYear - MAX_LIFESPAN_YEARS;
  return { death: null, lifeStatus: isLiving ? 'living' : 'unknown' };
}

/**
 * 言語ごとの値から、優先順に最初に見つかった文字列を返す。
 *
 * @param {Object|undefined} valuesByLanguage  例: entity.labels
 * @param {string[]} languages
 * @returns {string|null}
 */
function pickText(valuesByLanguage, languages) {
  for (const language of languages) {
    const text = valuesByLanguage?.[language]?.value;
    if (typeof text === 'string' && text !== '') {
      return text;
    }
  }
  return null;
}

/**
 * wbgetentitiesのエンティティ1件をPersonに変換する。
 *
 * @param {Object} entity  wbgetentitiesのentities[id]
 * @param {number} currentYear  存命判定に使う現在の年
 * @returns {Person|null}  削除済み・人間でない・生年がない場合はnull
 */
export function parsePerson(entity, currentYear) {
  if (entity === null || typeof entity !== 'object' || 'missing' in entity) {
    return null;
  }
  const { id, claims } = entity;
  if (typeof id !== 'string' || claims === null || typeof claims !== 'object') {
    return null;
  }
  if (!isHuman(claims)) {
    return null;
  }
  const birth = parseBirth(claims);
  if (birth === null) {
    return null;
  }

  return {
    id,
    label: pickText(entity.labels, LABEL_LANGUAGES) ?? id,
    // 英語の説明は子供には読みにくいため、ラベルと違い日本語以外にはフォールバックしない
    description: pickText(entity.descriptions, ['ja']) ?? '',
    birth,
    ...parseDeath(claims, birth, currentYear),
  };
}
