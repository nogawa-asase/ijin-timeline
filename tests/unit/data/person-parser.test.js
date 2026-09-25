import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsePerson, parseYearValue } from '../../../src/data/person-parser.js';

const CURRENT_YEAR = 2026;

/**
 * tests/fixtures/ のエンティティを読み込む。
 * @param {string} fileName
 */
function loadEntity(fileName) {
  return JSON.parse(readFileSync(new URL(`../../fixtures/${fileName}`, import.meta.url)));
}

/**
 * 生年・没年の値を1つ持つ、条件を変えるための加工用エンティティを作る。
 * @param {Object} claims  P31以外のclaims
 * @param {Object} [overrides]
 */
function createEntity(claims, overrides = {}) {
  return {
    id: 'Q1',
    labels: { ja: { value: 'テスト人物' } },
    descriptions: { ja: { value: '説明' } },
    claims: {
      P31: [{ mainsnak: { snaktype: 'value', datavalue: { value: { id: 'Q5' } } }, rank: 'normal' }],
      ...claims,
    },
    ...overrides,
  };
}

/**
 * 時刻の値を持つclaimを作る。
 * @param {string} time
 * @param {string} [rank]
 * @param {number} [precision]
 */
function timeClaim(time, rank = 'normal', precision = 11) {
  return { mainsnak: { snaktype: 'value', datavalue: { value: { time, precision } } }, rank };
}

/**
 * 項目を値に持つclaimを作る(職業など)。
 * @param {string} id
 * @param {string} [rank]
 */
function itemClaim(id, rank = 'normal') {
  return { mainsnak: { snaktype: 'value', datavalue: { value: { id } } }, rank };
}

// 教育上の観点からフィルタリングする職業の例: Q1079215(AV女優)
const FILTERED_OCCUPATION_ID = 'Q1079215';
// Q82955: 政治家
const POLITICIAN_ID = 'Q82955';
const BIRTH_CLAIMS = { P569: [timeClaim('+1971-01-01T00:00:00Z')] };

describe('parseYearValue', () => {
  it('紀元後の年を読み取る', () => {
    assert.deepEqual(parseYearValue('+1534-06-23T00:00:00Z', 11), { year: 1534, precision: 'year' });
  });

  it('紀元前の年を負数として読み取る', () => {
    assert.deepEqual(parseYearValue('-0551-00-00T00:00:00Z', 9), { year: -551, precision: 'year' });
  });

  it('精度8は年代とし、10の倍数に切り下げる', () => {
    assert.deepEqual(parseYearValue('+1534-00-00T00:00:00Z', 8), { year: 1530, precision: 'decade' });
  });

  it('精度7以下は世紀とし、年はそのまま保持する', () => {
    assert.deepEqual(parseYearValue('+1100-00-00T00:00:00Z', 7), { year: 1100, precision: 'century' });
    assert.deepEqual(parseYearValue('-0500-00-00T00:00:00Z', 6), { year: -500, precision: 'century' });
  });

  it('年が0の場合はnullを返す', () => {
    assert.equal(parseYearValue('+0000-00-00T00:00:00Z', 9), null);
  });

  it('形式が不正な場合はnullを返す', () => {
    assert.equal(parseYearValue('1534', 9), null);
  });
});

describe('parsePerson', () => {
  it('年単位の生没年を持つ人物をPersonに変換する', () => {
    const person = parsePerson(loadEntity('Q171411-oda-nobunaga.json'), CURRENT_YEAR);
    assert.deepEqual(person, {
      id: 'Q171411',
      label: '織田信長',
      description: '日本の戦国時代から安土桃山時代にかけての武将・大名・公卿',
      birth: { year: 1534, precision: 'year' },
      death: { year: 1582, precision: 'year' },
      lifeStatus: 'deceased',
    });
  });

  it('紀元前の人物は推奨ランクの値を優先して読み取る', () => {
    // 孔子は通常ランクに前552年・前551年(日付付き)、推奨ランクに前551年(年精度)がある
    const person = parsePerson(loadEntity('Q4604-confucius.json'), CURRENT_YEAR);
    assert.deepEqual(person.birth, { year: -551, precision: 'year' });
    assert.deepEqual(person.death, { year: -479, precision: 'year' });
  });

  it('推奨ランクの年代・世紀単位の値をあいまいな年として読み取る', () => {
    const person = parsePerson(loadEntity('Q81731-murasaki-shikibu.json'), CURRENT_YEAR);
    assert.deepEqual(person.birth, { year: 970, precision: 'decade' });
    assert.deepEqual(person.death, { year: 1100, precision: 'century' });
  });

  it('紀元前の世紀単位の値を読み取る', () => {
    const person = parsePerson(loadEntity('Q6691-homer.json'), CURRENT_YEAR);
    assert.deepEqual(person.birth, { year: -900, precision: 'century' });
  });

  it('没年が「不明な値」の人物は没年不明とする', () => {
    const person = parsePerson(loadEntity('Q1334304-izumo-no-okuni.json'), CURRENT_YEAR);
    assert.equal(person.death, null);
    assert.equal(person.lifeStatus, 'unknown');
  });

  it('没年がなく生年が120年以内の人物は存命とする', () => {
    const person = parsePerson(loadEntity('Q937659-habu-yoshiharu.json'), CURRENT_YEAR);
    assert.equal(person.death, null);
    assert.equal(person.lifeStatus, 'living');
  });

  it('没年がなく生年が120年より前の人物は没年不明とする', () => {
    const entity = createEntity({ P569: [timeClaim('+1800-01-01T00:00:00Z')] });
    assert.equal(parsePerson(entity, CURRENT_YEAR).lifeStatus, 'unknown');
  });

  it('生年がちょうど120年前の人物は存命とする', () => {
    const entity = createEntity({ P569: [timeClaim('+1906-01-01T00:00:00Z')] });
    assert.equal(parsePerson(entity, CURRENT_YEAR).lifeStatus, 'living');
  });

  it('没年が「値なし」の人物は没年データなしとして存命判定する', () => {
    const entity = createEntity({
      P569: [timeClaim('+1970-01-01T00:00:00Z')],
      P570: [{ mainsnak: { snaktype: 'novalue' }, rank: 'normal' }],
    });
    assert.equal(parsePerson(entity, CURRENT_YEAR).lifeStatus, 'living');
  });

  it('没年の年が0など不正な場合は没年データなしとして扱う', () => {
    const entity = createEntity({
      P569: [timeClaim('+1100-01-01T00:00:00Z')],
      P570: [timeClaim('+0000-00-00T00:00:00Z')],
    });
    const person = parsePerson(entity, CURRENT_YEAR);
    assert.equal(person.death, null);
    assert.equal(person.lifeStatus, 'unknown');
  });

  it('非推奨ランクの値は使わない', () => {
    const entity = createEntity({
      P569: [timeClaim('+1500-01-01T00:00:00Z', 'deprecated'), timeClaim('+1534-01-01T00:00:00Z')],
    });
    assert.equal(parsePerson(entity, CURRENT_YEAR).birth.year, 1534);
  });

  it('推奨ランクがなければ応答の順で最初の値を使う', () => {
    const entity = createEntity({
      P569: [timeClaim('+1534-01-01T00:00:00Z'), timeClaim('+1535-01-01T00:00:00Z')],
    });
    assert.equal(parsePerson(entity, CURRENT_YEAR).birth.year, 1534);
  });

  it('人間でないエンティティはnullを返す', () => {
    assert.equal(parsePerson(loadEntity('Q1053-molybdenum.json'), CURRENT_YEAR), null);
  });

  it('生年が「不明な値」の人物はnullを返す', () => {
    assert.equal(parsePerson(loadEntity('Q234451-himiko.json'), CURRENT_YEAR), null);
  });

  it('生年がない人物はnullを返す', () => {
    assert.equal(parsePerson(createEntity({}), CURRENT_YEAR), null);
  });

  it('生年の年が0の人物はnullを返す', () => {
    const entity = createEntity({ P569: [timeClaim('+0000-00-00T00:00:00Z')] });
    assert.equal(parsePerson(entity, CURRENT_YEAR), null);
  });

  it('教育上の観点からフィルタリングする職業の人物はnullを返す', () => {
    const entity = createEntity({ ...BIRTH_CLAIMS, P106: [itemClaim(FILTERED_OCCUPATION_ID)] });
    assert.equal(parsePerson(entity, CURRENT_YEAR), null);
  });

  it('複数の職業のうち1つでも教育上の観点からフィルタリングする職業ならnullを返す', () => {
    const entity = createEntity({
      ...BIRTH_CLAIMS,
      P106: [itemClaim(POLITICIAN_ID), itemClaim(FILTERED_OCCUPATION_ID)],
    });
    assert.equal(parsePerson(entity, CURRENT_YEAR), null);
  });

  it('教育上の観点からフィルタリングする職業でない人物はPersonに変換する', () => {
    const entity = createEntity({ ...BIRTH_CLAIMS, P106: [itemClaim(POLITICIAN_ID)] });
    assert.equal(parsePerson(entity, CURRENT_YEAR)?.id, 'Q1');
  });

  it('教育上の観点からフィルタリングする職業が非推奨ランクならPersonに変換する', () => {
    const entity = createEntity({
      ...BIRTH_CLAIMS,
      P106: [itemClaim(FILTERED_OCCUPATION_ID, 'deprecated')],
    });
    assert.equal(parsePerson(entity, CURRENT_YEAR)?.id, 'Q1');
  });

  it('削除済み・存在しない項目はnullを返す', () => {
    assert.equal(parsePerson({ id: 'Q999999999', missing: '' }, CURRENT_YEAR), null);
  });

  it('日本語ラベルがなければ多言語共通ラベルを使う', () => {
    const entity = createEntity(
      { P569: [timeClaim('+1853-01-01T00:00:00Z')] },
      { labels: { mul: { value: 'Vincent van Gogh' }, en: { value: 'Van Gogh' } } },
    );
    assert.equal(parsePerson(entity, CURRENT_YEAR).label, 'Vincent van Gogh');
  });

  it('日本語・多言語共通ラベルがなければ英語ラベルを使う', () => {
    const entity = createEntity(
      { P569: [timeClaim('+1853-01-01T00:00:00Z')] },
      { labels: { en: { value: 'Van Gogh' } } },
    );
    assert.equal(parsePerson(entity, CURRENT_YEAR).label, 'Van Gogh');
  });

  it('ラベルがなければWikidataのIDを表示名にする', () => {
    const entity = createEntity({ P569: [timeClaim('+1853-01-01T00:00:00Z')] }, { labels: {} });
    assert.equal(parsePerson(entity, CURRENT_YEAR).label, 'Q1');
  });

  it('日本語の説明がなければ説明は空文字にする', () => {
    const entity = createEntity(
      { P569: [timeClaim('+1853-01-01T00:00:00Z')] },
      { descriptions: { en: { value: 'Dutch painter' } } },
    );
    assert.equal(parsePerson(entity, CURRENT_YEAR).description, '');
  });
});
