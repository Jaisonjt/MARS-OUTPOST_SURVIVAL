/**
 * main.js — the starting point. It only connects the pieces together.
 *
 *   gameState.js  (rules)  ──►  store.js  (holds state, announces events)  ──►  ui.js  (draws the page)
 */
import { createStore } from './store.js';
import { createInitialState, rootReducer, deriveEvents } from './gameState.js';
import { initUI } from './ui.js';
import { CONFIG } from './config.js';

const store = createStore(rootReducer, deriveEvents, createInitialState());
initUI(store);

// For testing in the browser console (press F12). Not used by the game itself.
// It also lets index.html know that the game started successfully.
window.MARS_DEBUG = Object.freeze({ store, CONFIG });
