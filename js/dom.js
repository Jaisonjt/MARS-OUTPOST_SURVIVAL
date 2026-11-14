/**
 * dom.js — two tiny helpers for building and finding page elements.
 * Used by ui.js and dashboard.js. (Not used by the game rules, which never touch the page.)
 */

/** Finds one element or throws a clear error (helps catch typos early). */
export function $(selector) {
  const node = document.querySelector(selector);
  if (!node) throw new Error(`The page is missing the element "${selector}".`);
  return node;
}

/**
 * Builds an element: make('td', 'my-class', 'some text', otherNode).
 * Strings become plain text (never HTML), which keeps the page safe.
 */
export function make(tag, className, ...children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.append(...children);
  return node;
}