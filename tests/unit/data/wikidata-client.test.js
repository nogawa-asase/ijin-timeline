import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchPeople, WikidataError } from '../../../src/data/wikidata-client.js';

const CURRENT_YEAR = 2026;

/**
 * tests/fixtures/ のエンティティを読み込む。
 * @param {string} fileName
 */
function loadEntity(fileName) {
  return JSON.parse(readFileSync(new URL(`../../fixtures/${fileName}`, import.meta.url)));
}

const oda = loadEntity('Q171411-oda-nobunaga.json');
const molybdenum = loadEntity('Q1053-molybdenum.json');

/**
 * JSONを返すResponseを作る。
 * @param {unknown} body
 * @param {number} [status]
 */
function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/**
 * 検索と詳細取得の応答を返すfetchの代わりを作る。
 * @param {Object} searchBody
 * @param {Object} [entitiesBody]
 */
function stubFetch(searchBody, entitiesBody) {
  return mock.fn(async (url) => {
    const action = new URL(url).searchParams.get('action');
    return jsonResponse(action === 'wbsearchentities' ? searchBody : entitiesBody);
  });
}

describe('searchPeople', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    mock.timers.reset();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('検索と詳細取得の2リクエストで人間の候補だけを返す', async () => {
    globalThis.fetch = stubFetch(
      { search: [{ id: 'Q1053' }, { id: 'Q171411' }] },
      { entities: { Q1053: molybdenum, Q171411: oda } },
    );

    const people = await searchPeople('信長', CURRENT_YEAR);

    assert.equal(globalThis.fetch.mock.callCount(), 2);
    assert.deepEqual(
      people.map((person) => person.id),
      ['Q171411'],
    );
  });

  it('検索語と必要なパラメータをURLに含める', async () => {
    globalThis.fetch = stubFetch({ search: [{ id: 'Q171411' }] }, { entities: { Q171411: oda } });

    await searchPeople('織田 信長', CURRENT_YEAR);

    const searchUrl = new URL(globalThis.fetch.mock.calls[0].arguments[0]);
    assert.equal(searchUrl.origin, 'https://www.wikidata.org');
    assert.equal(searchUrl.searchParams.get('search'), '織田 信長');
    assert.equal(searchUrl.searchParams.get('language'), 'ja');
    assert.equal(searchUrl.searchParams.get('origin'), '*');
    const entitiesUrl = new URL(globalThis.fetch.mock.calls[1].arguments[0]);
    assert.equal(entitiesUrl.searchParams.get('ids'), 'Q171411');
    assert.equal(entitiesUrl.searchParams.get('props'), 'labels|descriptions|claims');
  });

  it('検索結果が0件なら詳細取得をせず空配列を返す', async () => {
    globalThis.fetch = stubFetch({ search: [] });

    const people = await searchPeople('該当なし', CURRENT_YEAR);

    assert.deepEqual(people, []);
    assert.equal(globalThis.fetch.mock.callCount(), 1);
  });

  it('候補は検索結果の順を保ち最大7件にする', async () => {
    const ids = Array.from({ length: 10 }, (_, index) => `Q${index + 1}`);
    const entities = Object.fromEntries(ids.map((id) => [id, { ...oda, id }]));
    globalThis.fetch = stubFetch({ search: ids.map((id) => ({ id })) }, { entities });

    const people = await searchPeople('信長', CURRENT_YEAR);

    assert.deepEqual(
      people.map((person) => person.id),
      ids.slice(0, 7),
    );
  });

  it('詳細取得で存在しない項目は候補から除外する', async () => {
    globalThis.fetch = stubFetch(
      { search: [{ id: 'Q999' }, { id: 'Q171411' }] },
      { entities: { Q999: { id: 'Q999', missing: '' }, Q171411: oda } },
    );

    const people = await searchPeople('信長', CURRENT_YEAR);

    assert.deepEqual(
      people.map((person) => person.id),
      ['Q171411'],
    );
  });

  it('HTTPステータスが200以外ならWikidataErrorを投げる', async () => {
    globalThis.fetch = mock.fn(async () => jsonResponse({}, 503));
    await assert.rejects(searchPeople('信長', CURRENT_YEAR), WikidataError);
  });

  it('応答にerrorがあればWikidataErrorを投げる', async () => {
    globalThis.fetch = mock.fn(async () => jsonResponse({ error: { code: 'x' } }));
    await assert.rejects(searchPeople('信長', CURRENT_YEAR), WikidataError);
  });

  it('応答がJSONでなければWikidataErrorを投げる', async () => {
    globalThis.fetch = mock.fn(async () => new Response('You are making too many requests'));
    await assert.rejects(searchPeople('信長', CURRENT_YEAR), WikidataError);
  });

  it('ネットワークエラーならWikidataErrorを投げる', async () => {
    globalThis.fetch = mock.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    await assert.rejects(searchPeople('信長', CURRENT_YEAR), WikidataError);
  });

  it('10秒以内に応答がなければWikidataErrorを投げる', async () => {
    mock.timers.enable({ apis: ['setTimeout'] });
    globalThis.fetch = mock.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason));
        }),
    );

    const promise = searchPeople('信長', CURRENT_YEAR);
    mock.timers.tick(10_000);

    await assert.rejects(promise, (error) => {
      assert.ok(error instanceof WikidataError);
      assert.match(error.message, /タイムアウト/);
      return true;
    });
    mock.timers.reset();
  });

  it('呼び出し元に中断された場合はAbortErrorを投げる', async () => {
    globalThis.fetch = mock.fn(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(signal.reason));
        }),
    );
    const controller = new AbortController();

    const promise = searchPeople('信長', CURRENT_YEAR, controller.signal);
    controller.abort();

    await assert.rejects(promise, { name: 'AbortError' });
  });

  it('中断済みのシグナルでは通信しない', async () => {
    globalThis.fetch = mock.fn();
    const controller = new AbortController();
    controller.abort();

    await assert.rejects(searchPeople('信長', CURRENT_YEAR, controller.signal), {
      name: 'AbortError',
    });
    assert.equal(globalThis.fetch.mock.callCount(), 0);
  });
});
