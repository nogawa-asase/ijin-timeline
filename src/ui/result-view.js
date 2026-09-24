import { comparePeople } from '../logic/comparison.js';
import { formatYearValue } from '../logic/years.js';

/** @typedef {import('../data/person-parser.js').Person} Person */
/** @typedef {import('../logic/comparison.js').Comparison} Comparison */

const APPROXIMATE_NOTE = '※生没年があいまいな人物を含むため、目安です';

/**
 * 重なりがある場合の文章を組み立てる。
 *
 * @param {Comparison} comparison  kind = 'overlap'
 * @returns {string[]}
 */
function buildOverlapSentences(comparison) {
  const { elder, younger, overlapStart, overlapEnd, overlapYears, ageAtBirth, isOngoing } =
    /** @type {Required<Comparison>} */ (comparison);
  const startText = formatYearValue(overlapStart);
  const durationText = overlapYears === 0 ? '1年足らずの間' : `約${overlapYears}年間`;

  let periodSentence;
  if (isOngoing) {
    periodSentence = `${startText}から現在までの${durationText}、同じ時代を生きています`;
  } else if (overlapYears === 0) {
    periodSentence = `${startText}の${durationText}、同じ時代を生きていました`;
  } else {
    const endText = formatYearValue(overlapEnd);
    periodSentence = `${startText}〜${endText}の${durationText}、同じ時代を生きていました`;
  }

  const ageSentence =
    ageAtBirth === 0
      ? '2人は同じ年に生まれました'
      : `${younger.label}が生まれたとき、${elder.label}は約${ageAtBirth}歳でした`;

  return [periodSentence, ageSentence];
}

/**
 * 比較結果を文章の一覧にする(機能設計書 A5 の文章パターン)。
 *
 * @param {Comparison} comparison
 * @returns {string[]}
 */
function buildSentences(comparison) {
  if (comparison.kind === 'undetermined') {
    const names = (comparison.unknownPeople ?? []).map((person) => person.label).join('と');
    return [`${names}の没年が不明なため、同じ時代かどうかを判定できません`];
  }
  if (comparison.kind === 'gap') {
    // 亡くなった年に生まれた場合は重なり0年(overlap)になるため、gapYearsは常に1以上
    const { elder, younger, gapYears } = /** @type {Required<Comparison>} */ (comparison);
    return [`${elder.label}が亡くなってから約${gapYears}年後に、${younger.label}が生まれました`];
  }
  return buildOverlapSentences(comparison);
}

/**
 * 2人が選択されているとき、比較結果の文章を表示する。1人以下のときは空にする。
 *
 * @param {HTMLElement} container  aria-live="polite" の領域
 * @param {(Person|null)[]} slots  入力欄ごとの選択済み人物
 * @param {number} currentYear
 */
export function renderResult(container, slots, currentYear) {
  const people = slots.filter((person) => person !== null);
  if (people.length < 2) {
    container.replaceChildren();
    return;
  }

  const comparison = comparePeople(people[0], people[1], currentYear);
  const paragraphEls = buildSentences(comparison).map((sentence) => {
    const paragraphEl = document.createElement('p');
    paragraphEl.className = 'result-text';
    paragraphEl.textContent = sentence;
    return paragraphEl;
  });

  if (comparison.approximate) {
    const noteEl = document.createElement('p');
    noteEl.className = 'result-note';
    noteEl.textContent = APPROXIMATE_NOTE;
    paragraphEls.push(noteEl);
  }
  container.replaceChildren(...paragraphEls);
}
