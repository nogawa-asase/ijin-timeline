import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { comparePeople, lifespanOf } from '../../../src/logic/comparison.js';

const CURRENT_YEAR = 2026;

/**
 * テスト用のPersonを作る。
 * @param {string} label
 * @param {number} birthYear
 * @param {number|null} deathYear
 * @param {Object} [overrides]
 */
function createPerson(label, birthYear, deathYear, overrides = {}) {
  return {
    id: `Q-${label}`,
    label,
    description: '',
    birth: { year: birthYear, precision: 'year' },
    death: deathYear === null ? null : { year: deathYear, precision: 'year' },
    lifeStatus: deathYear === null ? 'living' : 'deceased',
    ...overrides,
  };
}

const nobunaga = createPerson('織田信長', 1534, 1582);
const ieyasu = createPerson('徳川家康', 1543, 1616);

describe('lifespanOf', () => {
  it('故人は生年と没年の天文学的年を返す', () => {
    assert.deepEqual(lifespanOf(nobunaga, CURRENT_YEAR), {
      startAstroYear: 1534,
      endAstroYear: 1582,
    });
  });

  it('存命の人物は現在の年を終了年とする', () => {
    const living = createPerson('存命', 1970, null);
    assert.equal(lifespanOf(living, CURRENT_YEAR).endAstroYear, CURRENT_YEAR);
  });

  it('没年不明の人物は終了年をnullとする', () => {
    const unknown = createPerson('不明', 1100, null, { lifeStatus: 'unknown' });
    assert.equal(lifespanOf(unknown, CURRENT_YEAR).endAstroYear, null);
  });
});

describe('comparePeople', () => {
  it('重なりがある場合は重なり期間と年齢関係を返す', () => {
    const result = comparePeople(nobunaga, ieyasu, CURRENT_YEAR);
    assert.equal(result.kind, 'overlap');
    assert.equal(result.elder, nobunaga);
    assert.equal(result.younger, ieyasu);
    assert.deepEqual(result.overlapStart, { year: 1543, precision: 'year' });
    assert.deepEqual(result.overlapEnd, { year: 1582, precision: 'year' });
    assert.equal(result.overlapYears, 39);
    assert.equal(result.ageAtBirth, 9);
    assert.equal(result.isOngoing, false);
    assert.equal(result.approximate, false);
  });

  it('入力の順番が逆でも先に生まれた人物をelderとする', () => {
    const result = comparePeople(ieyasu, nobunaga, CURRENT_YEAR);
    assert.equal(result.elder, nobunaga);
    assert.equal(result.younger, ieyasu);
  });

  it('後に生まれた人物が先に亡くなった場合はその没年で重なりが終わる', () => {
    const elder = createPerson('長寿', 1500, 1600);
    const younger = createPerson('短命', 1520, 1550);
    const result = comparePeople(elder, younger, CURRENT_YEAR);
    assert.deepEqual(result.overlapEnd, { year: 1550, precision: 'year' });
    assert.equal(result.overlapYears, 30);
  });

  it('重なりがない場合は空白期間の年数を返す', () => {
    const early = createPerson('A', 1100, 1150);
    const late = createPerson('B', 1200, 1250);
    const result = comparePeople(early, late, CURRENT_YEAR);
    assert.equal(result.kind, 'gap');
    assert.equal(result.elder, early);
    assert.equal(result.gapYears, 50);
  });

  it('先の人物が亡くなった年に後の人物が生まれた場合は重なり0年とする', () => {
    const early = createPerson('A', 1100, 1150);
    const late = createPerson('B', 1150, 1200);
    const result = comparePeople(early, late, CURRENT_YEAR);
    assert.equal(result.kind, 'overlap');
    assert.equal(result.overlapYears, 0);
  });

  it('先の人物が亡くなった翌年に後の人物が生まれた場合は空白1年とする', () => {
    const early = createPerson('A', 1100, 1150);
    const late = createPerson('B', 1151, 1200);
    const result = comparePeople(early, late, CURRENT_YEAR);
    assert.equal(result.kind, 'gap');
    assert.equal(result.gapYears, 1);
  });

  it('同じ年に生まれた場合は1人目をelderとし年齢差0とする', () => {
    const first = createPerson('A', 1600, 1650);
    const second = createPerson('B', 1600, 1700);
    const result = comparePeople(second, first, CURRENT_YEAR);
    assert.equal(result.elder, second);
    assert.equal(result.ageAtBirth, 0);
  });

  it('没年不明の人物を含む場合は判定不可とする', () => {
    const unknown = createPerson('不明', 1100, null, { lifeStatus: 'unknown' });
    const result = comparePeople(nobunaga, unknown, CURRENT_YEAR);
    assert.equal(result.kind, 'undetermined');
    assert.deepEqual(result.unknownPeople, [unknown]);
  });

  it('2人とも存命の場合は現在まで続く重なりとする', () => {
    const a = createPerson('A', 1960, null);
    const b = createPerson('B', 1990, null);
    const result = comparePeople(a, b, CURRENT_YEAR);
    assert.equal(result.kind, 'overlap');
    assert.equal(result.isOngoing, true);
    assert.equal(result.overlapYears, 36);
    assert.deepEqual(result.overlapEnd, { year: CURRENT_YEAR, precision: 'year' });
  });

  it('故人と存命の人物では故人の没年で重なりが終わる', () => {
    const deceased = createPerson('A', 1920, 2000);
    const living = createPerson('B', 1970, null);
    const result = comparePeople(deceased, living, CURRENT_YEAR);
    assert.equal(result.isOngoing, false);
    assert.equal(result.overlapYears, 30);
  });

  it('あいまいな年を含む場合はapproximateをtrueにする', () => {
    const vague = createPerson('A', 1530, 1600, {
      birth: { year: 1530, precision: 'decade' },
    });
    const result = comparePeople(vague, ieyasu, CURRENT_YEAR);
    assert.equal(result.approximate, true);
    assert.equal(result.ageAtBirth, 8); // 1530年代の代表年1535から1543まで
  });

  it('紀元前の人物同士では0年を考慮せず正しい年数を返す', () => {
    const confucius = createPerson('孔子', -551, -479);
    const socrates = createPerson('ソクラテス', -470, -399);
    const result = comparePeople(confucius, socrates, CURRENT_YEAR);
    assert.equal(result.kind, 'gap');
    assert.equal(result.gapYears, 9);
  });

  it('紀元前と紀元後をまたぐ重なりでは0年がない分1年少なくなる', () => {
    const a = createPerson('A', -4, 30);
    const b = createPerson('B', -2, 60);
    const result = comparePeople(a, b, CURRENT_YEAR);
    assert.equal(result.overlapYears, 31);
    assert.equal(result.ageAtBirth, 2);
  });
});
