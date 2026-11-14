/**
 * store.js — a tiny "store" with publish/subscribe (pub/sub).
 *
 * - store.getState()            -> the current state (read-only)
 * - store.dispatch(action)      -> ask for a change; returns { ok, changed, events } or { ok:false, error }
 * - store.subscribe(fn)         -> fn(newState, oldState) runs after every state change
 * - store.on('eventType', fn)   -> fn(event) runs when that kind of event happens
 * - store.on('*', fn)           -> fn(event) runs for EVERY event
 * Both subscribe() and on() return a function you can call to stop listening.
 *
 * Why this matters: sounds, animations and particles added in later milestones
 * just listen for events. They never need to touch the game rules.
 *
 * Rule for listeners: react to changes, but do not call dispatch() inside one.
 */
export function createStore(reducer, deriveEvents, initialState) {
  let state = initialState;
  const stateListeners = new Set();
  const eventListeners = new Map(); // event type -> Set of functions

  // One broken listener must never stop the others from running.
  function safeCall(fn, ...args) {
    try {
      fn(...args);
    } catch (error) {
      console.error('[store] A listener failed:', error);
    }
  }

  function dispatch(action) {
    let nextState;
    let events;
    try {
      nextState = reducer(state, action);
      events = deriveEvents(state, nextState, action);
    } catch (error) {
      console.error(`[store] Action "${action?.type}" was rejected: ${error.message}`);
      return { ok: false, error: error.message };
    }

    if (nextState === state) return { ok: true, changed: false, events: [] };

    const previousState = state;
    state = nextState;

    // 1) Whole-state listeners (the screen redraws), 2) then specific events.
    [...stateListeners].forEach((fn) => safeCall(fn, state, previousState));
    for (const event of events) {
      [...(eventListeners.get(event.type) ?? [])].forEach((fn) => safeCall(fn, event));
      [...(eventListeners.get('*') ?? [])].forEach((fn) => safeCall(fn, event));
    }
    return { ok: true, changed: true, events };
  }

  function subscribe(fn) {
    stateListeners.add(fn);
    return () => stateListeners.delete(fn);
  }

  function on(eventType, fn) {
    if (!eventListeners.has(eventType)) eventListeners.set(eventType, new Set());
    eventListeners.get(eventType).add(fn);
    return () => eventListeners.get(eventType).delete(fn);
  }

  return { getState: () => state, dispatch, subscribe, on };
}
