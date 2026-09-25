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
 * 人物の名前を「と」でつなぐ。
 *
 * @param {Person[]} people
 * @returns {string}  例: "卑弥呼と出雲阿国"
 */
function joinNames(people) {
  return people.map((person) => person.label).join('と');
}

/**
 * 判定不可の理由の部分を組み立てる。
 *
 * @param {Comparison} comparison  kind = 'undetermined'
 * @returns {string}  例: "卑弥呼の生年と出雲阿国の没年"
 */
function buildUnknownReason(comparison) {
  const reasons = [];
  const unknownBirthPeople = comparison.unknownBirthPeople ?? [];
  const unknownPeople = comparison.unknownPeople ?? [];
  if (unknownBirthPeople.length > 0) {
    reasons.push(`${joinNames(unknownBirthPeople)}の生年`);
  }
  if (unknownPeople.length > 0) {
    reasons.push(`${joinNames(unknownPeople)}の没年`);
  }
  return reasons.join('と');
}

/**
 * 重なりがない場合の文章を組み立てる。
 *
 * @param {Comparison} comparison  kind = 'gap'
 * @returns {string}
 */
function buildGapSentence(comparison) {
  const { elder, younger, gapYears, deathGapYears } = /** @type {Required<Comparison>} */ (
    comparison
  );
  if (gapYears === null) {
    // youngerが生年不明で空白の年数を出せないため、2人の没年の差で離れていることを示す
    return (
      `${elder.label}が亡くなってから約${deathGapYears}年後に${younger.label}が亡くなっており、` +
      `同じ時代ではありません(${younger.label}の生年は不明です)`
    );
  }
  // 亡くなった年に生まれた場合は重なり0年(overlap)になるため、gapYearsは常に1以上
  return `${elder.label}が亡くなってから約${gapYears}年後に、${younger.label}が生まれました`;
}

/**
 * 比較結果を文章の一覧にする(機能設計書 A5 の文章パターン)。
 *
 * @param {Comparison} comparison
 * @returns {string[]}
 */
function buildSentences(comparison) {
  if (comparison.kind === 'undetermined') {
    return [`${buildUnknownReason(comparison)}が不明なため、同じ時代かどうかを判定できません`];
  }
  if (comparison.kind === 'gap') {
    return [buildGapSentence(comparison)];
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
