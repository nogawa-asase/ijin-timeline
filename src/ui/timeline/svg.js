// timeline-view.js 専用のSVG組み立ての補助関数。timeline-view.js と src/ui/timeline/ 内からのみ import する

const SVG_NS = 'http://www.w3.org/2000/svg';
// 表示前でgetComputedTextLengthが0を返す環境向けの、1文字あたりの幅の目安(px)
const FALLBACK_CHAR_WIDTH = 12;

/**
 * SVG要素を作る。
 *
 * @param {string} tagName
 * @param {Record<string, string|number>} attributes
 * @param {string} [className]
 * @returns {SVGElement}
 */
export function createSvgElement(tagName, attributes, className) {
  const element = document.createElementNS(SVG_NS, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, String(value));
  }
  if (className) {
    element.setAttribute('class', className);
  }
  return element;
}

/**
 * 文字列を持つtext要素を作り、親に追加する。
 *
 * @param {SVGElement} parent
 * @param {string} text
 * @param {Record<string, string|number>} attributes
 * @param {string} className
 * @returns {SVGTextElement}
 */
export function appendText(parent, text, attributes, className) {
  const textSvg = /** @type {SVGTextElement} */ (createSvgElement('text', attributes, className));
  textSvg.textContent = text;
  parent.append(textSvg);
  return textSvg;
}

/**
 * text要素の描画幅を返す。
 *
 * @param {SVGTextElement} textSvg
 * @returns {number}
 */
export function measureText(textSvg) {
  const length = textSvg.getComputedTextLength();
  return length > 0 ? length : (textSvg.textContent ?? '').length * FALLBACK_CHAR_WIDTH;
}
