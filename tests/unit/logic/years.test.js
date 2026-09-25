import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toAstronomical,
  fromAstronomical,
  yearsBetween,
  formatYearValue,
  formatAxisYear,
  representativeYear,
  formatLifespan,
} from '../../../src/logic/years.js';

describe('toAstronomical / fromAstronomical', () => {
  it('紀元後の年はそのままの値になる', () => {
    assert.equal(toAstronomical(1534), 1534);
    assert.equal(fromAstronomical(1534), 1534);
  });

  it('前1年は天文学的年の0になる', () => {
    assert.equal(toAstronomical(-1), 0);
    assert.equal(fromAstronomical(0), -1);
  });

  it('前551年は天文学的年の-550になる', () => {
    assert.equal(toAstronomical(-551), -550);
    assert.equal(fromAstronomical(-550), -551);
  });
});

describe('yearsBetween', () => {
  it('紀元後同士では単純な差を返す', () => {
    assert.equal(yearsBetween(1543, 1582), 39);
  });

  it('紀元前と紀元後をまたぐと0年がない分1年少なくなる', () => {
    assert.equal(yearsBetween(-4, 30), 33);
  });

  it('紀元前同士では単純な差を返す', () => {
    assert.equal(yearsBetween(-551, -479), 72);
  });
});

describe('formatYearValue', () => {
  it('紀元後の年単位の年は「1534年」と表記する', () => {
    assert.equal(formatYearValue({ year: 1534, precision: 'year' }), '1534年');
  });

  it('紀元前の年は「前」を付けて表記する', () => {
    assert.equal(formatYearValue({ year: -551, precision: 'year' }), '前551年');
  });

  it('年代単位の年は「1530年代」と表記する', () => {
    assert.equal(formatYearValue({ year: 1530, precision: 'decade' }), '1530年代');
  });

  it('紀元前の年代単位の年は「前550年代」と表記する', () => {
    assert.equal(formatYearValue({ year: -550, precision: 'decade' }), '前550年代');
  });

  it('世紀単位の年は「6世紀頃」と表記する', () => {
    assert.equal(formatYearValue({ year: 550, precision: 'century' }), '6世紀頃');
  });

  it('世紀の区切りの年(600年)は前の世紀として表記する', () => {
    assert.equal(formatYearValue({ year: 600, precision: 'century' }), '6世紀頃');
    assert.equal(formatYearValue({ year: 501, precision: 'century' }), '6世紀頃');
  });

  it('紀元前の世紀単位の年は「前6世紀頃」と表記する', () => {
    assert.equal(formatYearValue({ year: -551, precision: 'century' }), '前6世紀頃');
  });
});

describe('formatAxisYear', () => {
  it('紀元後の年は数字だけで表記する', () => {
    assert.equal(formatAxisYear(1600), '1600');
  });

  it('紀元前の年は「前」を付けて表記する', () => {
    assert.equal(formatAxisYear(-500), '前500');
  });
});

describe('representativeYear', () => {
  it('年単位の年はその年の天文学的年を返す', () => {
    assert.equal(representativeYear({ year: 1534, precision: 'year' }), 1534);
    assert.equal(representativeYear({ year: -551, precision: 'year' }), -550);
  });

  it('年代単位の年は年代の中央を返す', () => {
    assert.equal(representativeYear({ year: 1530, precision: 'decade' }), 1535);
  });

  it('紀元前の年代単位の年は年代の中央を天文学的年で返す', () => {
    // 前550年代の中央 = 前555年 = 天文学的年 -554
    assert.equal(representativeYear({ year: -550, precision: 'decade' }), -554);
  });

  it('世紀単位の年は世紀の中央を返す', () => {
    assert.equal(representativeYear({ year: 600, precision: 'century' }), 550);
  });

  it('紀元前の世紀単位の年は世紀の中央を天文学的年で返す', () => {
    // 前6世紀の中央 = 前550年 = 天文学的年 -549
    assert.equal(representativeYear({ year: -551, precision: 'century' }), -549);
  });
});

describe('formatLifespan', () => {
  const birth = { year: 1534, precision: 'year' };

  it('没年がある人物は「生年–没年」と表記する', () => {
    const death = { year: 1582, precision: 'year' };
    assert.equal(formatLifespan(birth, death, 'deceased'), '1534年–1582年');
  });

  it('存命の人物は没年を空けて表記する', () => {
    assert.equal(formatLifespan({ year: 1960, precision: 'year' }, null, 'living'), '1960年–');
  });

  it('没年不明の人物は没年を「?」と表記する', () => {
    assert.equal(formatLifespan({ year: 1100, precision: 'year' }, null, 'unknown'), '1100年–?');
  });

  it('生年不明の人物は生年を「?」と表記する', () => {
    assert.equal(formatLifespan(null, { year: 248, precision: 'year' }, 'deceased'), '?–248年');
  });

  it('紀元前の人物は生没年の両方に「前」を付ける', () => {
    const text = formatLifespan(
      { year: -551, precision: 'year' },
      { year: -479, precision: 'year' },
      'deceased',
    );
    assert.equal(text, '前551年–前479年');
  });
});
