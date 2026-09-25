import { createPersonInput } from './ui/person-input.js';
import { renderResult } from './ui/result-view.js';
import { renderTimeline } from './ui/timeline-view.js';

/** @typedef {import('./data/person-parser.js').Person} Person */

/**
 * @typedef {Object} AppState
 * @property {(Person|null)[]} slots  入力欄ごとの選択済み人物。MVPでは長さ2で固定
 */

const SLOT_COUNT = 2;

/**
 * 画面を組み立て、状態が変わるたびにタイムラインと結果を描き直す。
 */
function startApp() {
  // 現在の年はここで1回だけ取得し、各部品には引数で渡す
  const currentYear = new Date().getFullYear();
  /** @type {AppState} */
  const state = { slots: Array.from({ length: SLOT_COUNT }, () => null) };

  const slotEls = document.querySelectorAll('.person-input-slot');
  const timelineEl = /** @type {HTMLElement} */ (document.querySelector('.timeline'));
  const emptyEl = /** @type {HTMLElement} */ (document.querySelector('.timeline-empty'));
  const svg = /** @type {SVGSVGElement} */ (document.querySelector('.timeline-svg'));
  const resultEl = /** @type {HTMLElement} */ (document.querySelector('.result'));

  const render = () => {
    const hasPerson = state.slots.some((person) => person !== null);
    emptyEl.hidden = hasPerson;
    // 文字の幅を測って配置するため、描画の前に表示しておく
    // SVG要素には hidden プロパティがない(HTMLElementのみ)ため、属性を直接切り替える
    svg.toggleAttribute('hidden', !hasPerson);
    renderTimeline(svg, state.slots, currentYear, timelineEl.clientWidth);
    renderResult(resultEl, state.slots, currentYear);
  };

  slotEls.forEach((slotEl, index) => {
    const slotNumber = index + 1;
    createPersonInput(/** @type {HTMLElement} */ (slotEl), {
      label: `${slotNumber}人目`,
      placeholder: `${slotNumber}人目の名前`,
      slotNumber,
      currentYear,
      onChange: (person) => {
        state.slots[index] = person;
        render();
      },
    });
  });

  let isResizeScheduled = false;
  let lastWidth = timelineEl.clientWidth;
  window.addEventListener('resize', () => {
    if (isResizeScheduled) {
      return;
    }
    isResizeScheduled = true;
    // resizeは連続して起こるため、1フレームに1回だけ描き直す
    requestAnimationFrame(() => {
      isResizeScheduled = false;
      if (timelineEl.clientWidth !== lastWidth) {
        lastWidth = timelineEl.clientWidth;
        render();
      }
    });
  });

  render();
}

startApp();
