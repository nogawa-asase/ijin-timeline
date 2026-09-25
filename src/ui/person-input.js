import { searchPeople, WikidataError } from '../data/wikidata-client.js';
import { createElements, createOptionElement } from './person-input/elements.js';
import {
  MESSAGE_FETCH_ERROR,
  MESSAGE_SEARCHING,
  notFoundMessageOf,
} from './person-input/messages.js';

/** @typedef {import('../data/person-parser.js').Person} Person */
/** @typedef {import('../data/wikidata-client.js').Candidate} Candidate */

/**
 * @typedef {Object} PersonInputOptions
 * @property {string} label        入力欄の名前(例: "1人目")。aria-labelなどに使う
 * @property {string} placeholder  例: "1人目の名前"
 * @property {number} slotNumber   入力欄の番号(1始まり)。要素のIDと色の区別に使う
 * @property {number} currentYear  候補の存命判定に使う現在の年
 * @property {(person: Person|null) => void} onChange  選択・クリア時に呼ばれる
 */

const DEBOUNCE_MS = 300;
const MAX_QUERY_LENGTH = 100;

/**
 * 人物の入力欄(候補一覧つき)を1つ作る。
 *
 * @param {HTMLElement} container  入力欄を描画する要素
 * @param {PersonInputOptions} options
 * @returns {{ setPerson: (person: Person|null) => void }}  P1のURL共有で外から値を設定するため
 */
export function createPersonInput(container, options) {
  const { slotNumber, currentYear, onChange } = options;
  const { rootEl, inputEl, clearEl, listboxEl, statusEl } = createElements(options);
  container.replaceChildren(rootEl);

  /** @type {Person|null} */
  let selectedPerson = null;
  /** @type {Candidate[]} */
  let candidates = [];
  let activeIndex = -1;
  let lastQuery = '';
  /** @type {ReturnType<typeof setTimeout>|undefined} */
  let debounceTimerId;
  /** @type {AbortController|null} */
  let currentController = null;

  /**
   * @param {string} message
   * @param {boolean} [isScreenReaderOnly]  件数のように、画面には出さず読み上げだけさせるか
   */
  const showStatus = (message, isScreenReaderOnly = false) => {
    statusEl.textContent = message;
    statusEl.classList.toggle('is-sr-only', isScreenReaderOnly);
  };

  const setActiveIndex = (index) => {
    activeIndex = index;
    const optionEls = listboxEl.querySelectorAll('.person-input-option');
    optionEls.forEach((optionEl, optionIndex) => {
      const isActive = optionIndex === index;
      optionEl.classList.toggle('is-active', isActive);
      optionEl.setAttribute('aria-selected', String(isActive));
      if (isActive) {
        optionEl.scrollIntoView({ block: 'nearest' });
      }
    });
    if (index >= 0) {
      inputEl.setAttribute('aria-activedescendant', optionEls[index].id);
    } else {
      inputEl.removeAttribute('aria-activedescendant');
    }
  };

  const closeListbox = () => {
    listboxEl.hidden = true;
    listboxEl.replaceChildren();
    inputEl.setAttribute('aria-expanded', 'false');
    setActiveIndex(-1);
  };

  const cancelSearch = () => {
    clearTimeout(debounceTimerId);
    // 古い応答が後から届いて候補を上書きしないよう、実行中の検索を中断する
    currentController?.abort();
    currentController = null;
  };

  /**
   * 選択状態を設定し、検索中の処理と候補一覧を片付ける(onChangeは呼ばない)。
   *
   * @param {Person|null} person  nullならクリア
   */
  const applySelection = (person) => {
    cancelSearch();
    closeListbox();
    showStatus('');
    selectedPerson = person;
    inputEl.value = person?.label ?? '';
    // 確定・クリア後に名前を編集して戻した場合も検索し直すよう、直前の検索結果を捨てる
    lastQuery = '';
    candidates = [];
    clearEl.hidden = person === null;
  };

  const selectPerson = (person) => {
    applySelection(person);
    onChange(person);
  };

  const showCandidates = (people, query) => {
    candidates = people;
    closeListbox();
    if (people.length === 0) {
      showStatus(notFoundMessageOf(query));
      return;
    }
    const optionEls = people.map((person, index) => {
      const optionEl = createOptionElement(person, `person-input-option-${slotNumber}-${index}`);
      // クリックより先に入力欄のフォーカスが外れると一覧が閉じてしまうため、既定の動作を止める
      optionEl.addEventListener('mousedown', (event) => event.preventDefault());
      optionEl.addEventListener('click', () => selectPerson(person));
      return optionEl;
    });
    listboxEl.replaceChildren(...optionEls);
    listboxEl.hidden = false;
    inputEl.setAttribute('aria-expanded', 'true');
    showStatus(`${people.length}件の候補があります`, true);
  };

  const runSearch = async (query) => {
    if (query === lastQuery) {
      showCandidates(candidates, query);
      return;
    }
    const controller = new AbortController();
    currentController = controller;
    // 古い候補を残したまま「検索中」と読み上げると紛らわしいため、一覧を閉じてから検索する
    closeListbox();
    showStatus(MESSAGE_SEARCHING);
    try {
      const people = await searchPeople(query, currentYear, controller.signal);
      lastQuery = query;
      showCandidates(people, query);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        return; // 新しい入力で中断された。表示は新しい検索に任せる
      }
      if (!(error instanceof WikidataError)) {
        console.error('想定外のエラー:', error);
      }
      lastQuery = '';
      closeListbox();
      showStatus(MESSAGE_FETCH_ERROR);
    } finally {
      if (currentController === controller) {
        currentController = null;
      }
    }
  };

  const handleInput = () => {
    cancelSearch();
    clearEl.hidden = inputEl.value === '';
    if (selectedPerson !== null) {
      selectedPerson = null;
      onChange(null);
    }
    const query = inputEl.value.trim().slice(0, MAX_QUERY_LENGTH);
    if (query === '') {
      closeListbox();
      showStatus('');
      return;
    }
    debounceTimerId = setTimeout(() => runSearch(query), DEBOUNCE_MS);
  };

  const handleKeydown = (event) => {
    const isOpen = !listboxEl.hidden && candidates.length > 0;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!isOpen) {
        return;
      }
      event.preventDefault();
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((activeIndex + offset + candidates.length) % candidates.length);
    } else if (event.key === 'Enter') {
      if (isOpen && activeIndex >= 0) {
        event.preventDefault();
        selectPerson(candidates[activeIndex]);
      }
    } else if (event.key === 'Escape') {
      if (!listboxEl.hidden) {
        event.preventDefault();
        closeListbox();
      }
    }
  };

  const handleClear = () => {
    const wasSelected = selectedPerson !== null;
    applySelection(null);
    inputEl.focus();
    if (wasSelected) {
      onChange(null);
    }
  };

  inputEl.addEventListener('input', handleInput);
  inputEl.addEventListener('keydown', handleKeydown);
  inputEl.addEventListener('blur', closeListbox);
  clearEl.addEventListener('click', handleClear);

  return { setPerson: applySelection };
}
