/**
 * utils.js — tiny helpers shared by several files.
 */

/**
 * Freezes an object and everything inside it, so nothing can change it by accident.
 * This is how we guarantee that game state is only ever changed through the
 * reducer (gameState.js) and never edited directly.
 */
export function deepFreeze(value) {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}
