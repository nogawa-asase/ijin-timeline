// person-input.js 専用の、入力欄を構成する要素の作成。person-input.js からのみ import する
import { formatLifespan } from '../../logic/years.js';

/** @typedef {import('../../data/wikidata-client.js').Candidate} Candidate */
/** @typedef {import('../person-input.js').PersonInputOptions} PersonInputOptions */

/**
 * 入力欄を構成する要素を作る。
 *
 * @param {PersonInputOptions} options
 */
export function createElements(options) {
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
 * 候補1件分の要素を作る。
 *
 * @param {Candidate} person
 * @param {string} optionId
 * @returns {HTMLLIElement}
 */
export function createOptionElement(person, optionId) {
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
