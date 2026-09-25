// person-input.js 専用の、状態表示の文言。person-input.js からのみ import する
export const MESSAGE_SEARCHING = '検索中…';
const MESSAGE_NOT_FOUND = '該当する人物が見つかりませんでした';
const MESSAGE_NOT_FOUND_SHORT_QUERY =
  '該当する人物が見つかりませんでした。名前をもう少し長く入力してみてください';
// この文字数以下の検索語は短い入力とみなす。「紫」のように人物以外の項目が検索結果の上位を占めやすいため
const SHORT_QUERY_LENGTH = 2;
export const MESSAGE_FETCH_ERROR = 'データを取得できませんでした。時間をおいて試してください';

/**
 * 候補が0件のときに表示するメッセージを返す。
 * 短い入力では、続けて入力すれば見つかる可能性があることを案内する。
 *
 * @param {string} query  前後の空白を除いた検索語
 * @returns {string}
 */
export function notFoundMessageOf(query) {
  // サロゲートペアの文字も1文字として数える
  return Array.from(query).length <= SHORT_QUERY_LENGTH
    ? MESSAGE_NOT_FOUND_SHORT_QUERY
    : MESSAGE_NOT_FOUND;
}
