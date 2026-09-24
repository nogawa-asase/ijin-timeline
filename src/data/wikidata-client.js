import { parsePerson } from './person-parser.js';

/** @typedef {import('./person-parser.js').Person} Person */

const API_URL = 'https://www.wikidata.org/w/api.php';
const TIMEOUT_MS = 10_000;
// 人間でない・生年がない項目を除いた後でも候補が残るよう、表示件数より多めに検索する。
// 「織田」のように名字の項目が上位を占める語があるため、10件では候補が1件しか残らないことがある
const SEARCH_LIMIT = 20;
const MAX_CANDIDATES = 7;

/** 通信失敗・タイムアウト・不正な応答を表すエラー */
export class WikidataError extends Error {
  /**
   * @param {string} message
   * @param {{ cause?: unknown }} [options]
   */
  constructor(message, options) {
    super(message, options);
    this.name = 'WikidataError';
  }
}

/**
 * 呼び出し元の中断とタイムアウトの両方で止まるAbortControllerを作る。
 *
 * @param {AbortSignal|undefined} signal
 * @returns {{ controller: AbortController, isTimedOut: () => boolean, dispose: () => void }}
 */
function createRequestController(signal) {
  const controller = new AbortController();
  let isTimedOut = false;
  const timeoutId = setTimeout(() => {
    isTimedOut = true;
    controller.abort();
  }, TIMEOUT_MS);
  const abortByCaller = () => controller.abort();
  signal?.addEventListener('abort', abortByCaller, { once: true });

  return {
    controller,
    isTimedOut: () => isTimedOut,
    dispose: () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', abortByCaller);
    },
  };
}

/**
 * Wikidata APIにGETリクエストを送り、JSONを返す。
 *
 * @param {Record<string, string>} params  action などのパラメータ
 * @param {AbortSignal} [signal]
 * @returns {Promise<Object>}
 * @throws {WikidataError}  通信失敗・タイムアウト・不正な応答のとき
 * @throws {DOMException}   呼び出し元に中断されたとき(name: 'AbortError')
 */
async function requestApi(params, signal) {
  signal?.throwIfAborted();
  const query = new URLSearchParams({ ...params, format: 'json', origin: '*' });
  const request = createRequestController(signal);

  try {
    const response = await fetch(`${API_URL}?${query}`, { signal: request.controller.signal });
    if (!response.ok) {
      throw new WikidataError(`HTTPステータス ${response.status}`);
    }
    // 混雑時はJSONでない文章が返ることがあるため、読み取りの失敗も不正な応答として扱う
    const body = await response.json().catch((error) => {
      throw new WikidataError('応答がJSONではありません', { cause: error });
    });
    if (body === null || typeof body !== 'object' || 'error' in body) {
      throw new WikidataError('APIがエラーを返しました', { cause: body?.error });
    }
    return body;
  } catch (error) {
    if (signal?.aborted) {
      throw signal.reason ?? error;
    }
    if (request.isTimedOut()) {
      throw new WikidataError('タイムアウトしました', { cause: error });
    }
    if (error instanceof WikidataError) {
      throw error;
    }
    throw new WikidataError('通信に失敗しました', { cause: error });
  } finally {
    request.dispose();
  }
}

/**
 * 名前の一部から候補のIDを検索する。
 *
 * @param {string} query
 * @param {AbortSignal} [signal]
 * @returns {Promise<string[]>}
 */
async function searchEntityIds(query, signal) {
  const body = await requestApi(
    {
      action: 'wbsearchentities',
      search: query,
      language: 'ja',
      uselang: 'ja',
      type: 'item',
      limit: String(SEARCH_LIMIT),
    },
    signal,
  );
  if (!Array.isArray(body.search)) {
    throw new WikidataError('検索結果の形式が不正です');
  }
  return body.search.map((result) => result?.id).filter((id) => typeof id === 'string');
}

/**
 * IDの一覧から、ラベル・説明・生没年などをまとめて取得する。
 *
 * @param {string[]} ids  1件以上
 * @param {AbortSignal} [signal]
 * @returns {Promise<Record<string, Object>>}  entities
 */
async function fetchEntities(ids, signal) {
  const body = await requestApi(
    {
      action: 'wbgetentities',
      ids: ids.join('|'),
      props: 'labels|descriptions|claims',
      languages: 'ja|mul|en',
    },
    signal,
  );
  if (body.entities === null || typeof body.entities !== 'object') {
    throw new WikidataError('詳細取得の結果の形式が不正です');
  }
  return body.entities;
}

/**
 * 名前の一部から人物候補を検索する。
 *
 * @param {string} query  入力文字列(呼び出し側で前後の空白を除去し、100文字に切り詰め済み。1文字以上)
 * @param {number} currentYear  存命判定に使う現在の年
 * @param {AbortSignal} [signal]  前の検索を中断するためのシグナル
 * @returns {Promise<Person[]>}  最大7件。人間かつ生年を持つ人物のみ。検索結果の順を保つ
 * @throws {WikidataError}  通信失敗・タイムアウト・不正な応答のとき
 */
export async function searchPeople(query, currentYear, signal) {
  const ids = await searchEntityIds(query, signal);
  if (ids.length === 0) {
    return [];
  }
  const entities = await fetchEntities(ids, signal);
  return ids
    .map((id) => parsePerson(entities[id] ?? null, currentYear))
    .filter((person) => person !== null)
    .slice(0, MAX_CANDIDATES);
}
