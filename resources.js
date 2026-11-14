/**
 * resources.js — the rules for resource values.
 *
 * Everything here is a PURE FUNCTION: it never touches the page and never
 * changes the objects you give it. It only returns new values. That makes the
 * rules easy to test and lets the Node balance simulator reuse them later.
 */
import { CONFIG } from './config.js';

export const RESOURCE_KEYS = Object.freeze(Object.keys(CONFIG.resources));

// Everything an "effect" is allowed to change.
export const EFFECT_KEYS = Object.freeze([...RESOURCE_KEYS, 'crewHealth', 'research']);

/** Returns { label, icon, min, max, ... } for a resource, crewHealth or research. */
export function getMeterInfo(key) {
  if (key === 'crewHealth') return CONFIG.crewHealth;
  if (key === 'research') return CONFIG.research;
  if (Object.hasOwn(CONFIG.resources, key)) return CONFIG.resources[key];
  throw new Error(`Unknown meter "${key}". Allowed: ${EFFECT_KEYS.join(', ')}.`);
}

/** Keeps a number between min and max. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Clamps a value to the allowed range of the named meter. */
export function clampMeter(key, value) {
  const { min, max } = getMeterInfo(key);
  return clamp(value, min, max);
}

/** Returns 'ok', 'low' or 'critical' for a resource value. */
export function getResourceStatus(key, value) {
  const info = getMeterInfo(key);
  if (!Object.hasOwn(CONFIG.resources, key)) {
    throw new Error(`"${key}" is not a resource, so it has no OK/Low/Empty status.`);
  }
  if (value <= info.min) return 'critical';
  if (value < CONFIG.thresholds.lowBelow) return 'low';
  return 'ok';
}

/**
 * Applies a set of changes to a game, e.g. { oxygen: -10, research: +5 }.
 * - Checks EVERY change first; if any is invalid nothing is applied (all-or-nothing).
 * - Clamps results so no value can go below its min or above its max.
 * - Returns the SAME game object if nothing actually changed.
 */
export function applyEffects(game, effects) {
  if (effects === null || typeof effects !== 'object' || Array.isArray(effects)) {
    throw new Error('Effects must be an object like { oxygen: -10 }.');
  }
  const entries = Object.entries(effects);
  for (const [key, delta] of entries) {
    if (!EFFECT_KEYS.includes(key)) {
      throw new Error(`Unknown effect key "${key}". Allowed: ${EFFECT_KEYS.join(', ')}.`);
    }
    if (typeof delta !== 'number' || !Number.isFinite(delta)) {
      throw new Error(`Effect "${key}" must be a finite number, but got ${String(delta)}.`);
    }
  }

  const resources = { ...game.resources };
  const next = { ...game, resources };
  let changed = false;

  for (const [key, delta] of entries) {
    const isResource = Object.hasOwn(CONFIG.resources, key);
    const before = isResource ? game.resources[key] : game[key];
    const after = clampMeter(key, before + delta);
    if (after !== before) {
      changed = true;
      if (isResource) resources[key] = after;
      else next[key] = after;
    }
  }
  return changed ? next : game;
}
