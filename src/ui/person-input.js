import { searchPeople, WikidataError } from '../data/wikidata-client.js';
import { formatLifespan } from '../logic/years.js';

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
const MESSAGE_SEARCHING = '検索中…';
const MESSAGE_NOT_FOUND = '該当する人物が見つかりませんでした';
const MESSAGE_NOT_FOUND_SHORT_QUERY =
  '該当する人物が見つかりませんでした。名前をもう少し長く入力してみてください';
// この文字数以下の検索語は短い入力とみなす。「紫」のように人物以外の項目が検索結果の上位を占めやすいため
const SHORT_QUERY_LENGTH = 2;
const MESSAGE_FETCH_ERROR = 'データを取得できませんでした。時間をおいて試してください';

/**
 * 入力欄を構成する要素を作る。
 *
 * @param {PersonInputOptions} options
 */
function createElements(options) {
  const { label, placeholder, slotNumber } = options;
  const listboxId = `person-input-listbox-${slotNumber}`;

  const rootEl = document.createElement('div');
  rootEl.className = 'person-input';

  const fieldEl = document.createElement('div');
  fieldEl.className = 'person-input-field';

  const swatchEl = document.createElement('span');
  swatchEl.className = `person-input-swatch is-person-${slotNumber}`;
  swatchEl.setAttribute('aria-hidden', 'true');

  const inputEl = document.createElement('input');
  inputEl.className = 'person-input-text';
  inputEl.type = 'text';
  inputEl.placeholder = placeholder;
  inputEl.autocomplete = 'off';
  inputEl.spellcheck = false;
  inputEl.setAttribute('role', 'combobox');
  inputEl.setAttribute('aria-label', `${label}の名前`);
  inputEl.setAttribute('aria-autocomplete', 'list');
  inputEl.setAttribute('aria-haspopup', 'listbox');
  inputEl.setAttribute('aria-expanded', 'false');
  inputEl.setAttribute('aria-controls', listboxId);

  const clearEl = document.createElement('button');
  clearEl.className = 'person-input-clear';
  clearEl.type = 'button';
  clearEl.textContent = '×';
  clearEl.setAttribute('aria-label', `${label}をクリア`);
  clearEl.hidden = true;

  const listboxEl = document.createElement('ul');
  listboxEl.className = 'person-input-listbox';
  listboxEl.id = listboxId;
  listboxEl.setAttribute('role', 'listbox');
  listboxEl.setAttribute('aria-label', `${label}の候補`);
  listboxEl.hidden = true;

  const statusEl = document.createElement('p');
  statusEl.className = 'person-input-status';
  statusEl.setAttribute('aria-live', 'polite');

  fieldEl.append(swatchEl, inputEl, clearEl);
  rootEl.append(fieldEl, listboxEl, statusEl);
  return { rootEl, inputEl, clearEl, listboxEl, statusEl };
}

/**
 * 候補が0件のときに表示するメッセージを返す。
 * 短い入力では、続けて入力すれば見つかる可能性があることを案内する。
 *
 * @param {string} query  前後の空白を除いた検索語
 * @returns {string}
 */
function notFoundMessageOf(query) {
  // サロゲートペアの文字も1文字として数える
  return Array.from(query).length <= SHORT_QUERY_LENGTH
    ? MESSAGE_NOT_FOUND_SHORT_QUERY
    : MESSAGE_NOT_FOUND;
}

/**
 * 候補1件分の要素を作る。
 *
 * @param {Candidate} person
 * @param {string} optionId
 * @returns {HTMLLIElement}
 */
function createOptionElement(person, optionId) {
  const optionEl = document.createElement('li');
  optionEl.className = 'person-input-option';
  optionEl.id = optionId;
  optionEl.setAttribute('role', 'option');
  optionEl.setAttribute('aria-selected', 'false');

  const nameEl = document.createElement('span');
  nameEl.className = 'person-input-option-name';
  nameEl.textContent = person.label;

  const yearsEl = document.createElement('span');
  yearsEl.className = 'person-input-option-years';
  yearsEl.textContent = `(${formatLifespan(person.birth, person.death, person.lifeStatus)})`;

  optionEl.append(nameEl, yearsEl);
  if (person.matchedAlias !== null) {
    // 名前に入力した文字を含まない候補が、なぜ出てきたのかを示す
    const aliasEl = document.createElement('span');
    aliasEl.className = 'person-input-option-alias';
    aliasEl.textContent = `(別名: ${person.matchedAlias})`;
    optionEl.append(aliasEl);
  }
  if (person.description !== '') {
    const descriptionEl = document.createElement('span');
    descriptionEl.className = 'person-input-option-description';
    descriptionEl.textContent = person.description;
    optionEl.append(descriptionEl);
  }
  return optionEl;
}

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
