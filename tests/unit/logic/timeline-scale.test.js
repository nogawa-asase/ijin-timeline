import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawSpanOf,
  computeTimeRange,
  chooseTickStep,
  computeTicks,
} from '../../../src/logic/timeline-scale.js';

const CURRENT_YEAR = 2026;

describe('drawSpanOf', () => {
  it('故人は生年から没年までの期間を返す', () => {
    const person = {
      birth: { year: 1534, precision: 'year' },
      death: { year: 1582, precision: 'year' },
      lifeStatus: 'deceased',
    };
    assert.deepEqual(drawSpanOf(person, CURRENT_YEAR), {
      startAstroYear: 1534,
      endAstroYear: 1582,
      isTentativeStart: false,
      isTentativeEnd: false,
    });
  });

  it('没年不明の人物は生年+50年を仮の終了年とする', () => {
    const person = { birth: { year: 1100, precision: 'year' }, death: null, lifeStatus: 'unknown' };
    assert.deepEqual(drawSpanOf(person, CURRENT_YEAR), {
      startAstroYear: 1100,
      endAstroYear: 1150,
      isTentativeStart: false,
      isTentativeEnd: true,
    });
  });

  it('生年不明の人物は没年−50年を仮の開始年とする', () => {
    const person = { birth: null, death: { year: 248, precision: 'year' }, lifeStatus: 'deceased' };
    assert.deepEqual(drawSpanOf(person, CURRENT_YEAR), {
      startAstroYear: 198,
      endAstroYear: 248,
      isTentativeStart: true,
      isTentativeEnd: false,
    });
  });

  it('存命の人物は現在の年までの期間を返す', () => {
    const person = { birth: { year: 1970, precision: 'year' }, death: null, lifeStatus: 'living' };
    assert.equal(drawSpanOf(person, CURRENT_YEAR).endAstroYear, CURRENT_YEAR);
  });
});

describe('computeTimeRange', () => {
  it('期間の10%を左右の余白とする', () => {
    const range = computeTimeRange([
      { startAstroYear: 1534, endAstroYear: 1582 },
      { startAstroYear: 1543, endAstroYear: 1616 },
    ]);
    // 期間82年の10% → 8年
    assert.deepEqual(range, { rangeStart: 1526, rangeEnd: 1624 });
  });

  it('期間が短い場合でも余白は最低5年とする', () => {
    const range = computeTimeRange([{ startAstroYear: 1600, endAstroYear: 1620 }]);
    assert.deepEqual(range, { rangeStart: 1595, rangeEnd: 1625 });
  });
});

describe('chooseTickStep', () => {
  it('目盛りが8本以下になる最小の間隔を選ぶ', () => {
    // 1526〜1624: 20年間隔で1540〜1620の5本、10年間隔だと10本
    assert.equal(chooseTickStep({ rangeStart: 1526, rangeEnd: 1624 }), 20);
  });

  it('短い範囲では1年間隔を選ぶ', () => {
    assert.equal(chooseTickStep({ rangeStart: 2000, rangeEnd: 2006 }), 1);
  });

  it('非常に長い範囲では1000年間隔を選び8本を超えることを許容する', () => {
    assert.equal(chooseTickStep({ rangeStart: -10000, rangeEnd: 2000 }), 1000);
  });
});

describe('computeTicks', () => {
  it('目盛りのラベルは歴史的年で表記する', () => {
    const ticks = computeTicks({ rangeStart: 1526, rangeEnd: 1624 });
    assert.deepEqual(
      ticks.map((tick) => tick.label),
      ['1540', '1560', '1580', '1600', '1620'],
    );
  });

  it('紀元前の目盛りは歴史的年の切りのよい年に置く', () => {
    const ticks = computeTicks({ rangeStart: -560, rangeEnd: -470 });
    // 90年の範囲は20年間隔。前560年は天文学的年 -559
    assert.deepEqual(ticks[0], { astroYear: -559, label: '前560' });
  });

  it('紀元前と紀元後をまたぐ範囲では0年の目盛りを置かない', () => {
    const ticks = computeTicks({ rangeStart: -9, rangeEnd: 35 });
    const labels = ticks.map((tick) => tick.label);
    assert.ok(!labels.includes('0'));
    assert.ok(labels.includes('前10'));
    assert.ok(labels.includes('10'));
  });
});
