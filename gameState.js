/**
 * gameState.js — pure-function state management and 10-day mission evaluation.
 */
import { CONFIG } from './config.js';
import { deepFreeze } from './utils.js';
import { RESOURCE_KEYS, EFFECT_KEYS, applyEffects, getResourceStatus } from './resources.js';
import { EVENTS } from './events.js';

export const SCREENS = Object.freeze(['title', 'how-to-play', 'science-data', 'mission', 'report']);

export const ACTIONS = Object.freeze({
  NAVIGATE: 'NAVIGATE',
  START_MISSION: 'START_MISSION',
  END_MISSION: 'END_MISSION',
  APPLY_EFFECTS: 'APPLY_EFFECTS',
  MAKE_DECISION: 'MAKE_DECISION',
  ADVANCE_DAY: 'ADVANCE_DAY',
  LOAD_SAVED: 'LOAD_SAVED',
});

/** Evaluates the 3 mission objectives from current game state. */
export function getObjectivesStatus(game) {
  return {
    researchGoal: game.research >= CONFIG.mission.researchTarget,
    foodGrown: Boolean(game.objectives.foodGrown),
    reportSent: Boolean(game.objectives.reportSent),
  };
}

/** Counts how many of the 3 mission objectives are completed. */
export function countCompletedObjectives(game) {
  const status = getObjectivesStatus(game);
  return Object.values(status).filter(Boolean).length;
}

/** Builds the starting game data from CONFIG. */
export function createInitialGameState() {
  const resources = {};
  for (const key of RESOURCE_KEYS) {
    resources[key] = CONFIG.resources[key].start;
  }
  const firstEvent = EVENTS[0];
  return deepFreeze({
    day: 1,
    totalDays: CONFIG.mission.totalDays,
    resources,
    crewHealth: CONFIG.crewHealth.start,
    research: CONFIG.research.start,
    comms: {
      status: 'delayed',
      oneWayDelayMinutes: firstEvent.commsDelayMinutes,
    },
    objectives: {
      foodGrown: false,
      reportSent: false,
    },
    emptyOxygenDays: 0,
    currentEvent: firstEvent,
    currentLesson: null,
    lastChoiceLabel: null,
    history: [],
    outcome: null, // null | { won: boolean, status: string, title: string, reason: string }
  });
}

/** Builds the starting app state (title screen, no mission yet). */
export function createInitialState() {
  return deepFreeze({ screen: 'title', game: null });
}

/**
 * Pure-function reducer: (old state, action) -> new state.
 */
export function rootReducer(state, action) {
  switch (action?.type) {
    case ACTIONS.NAVIGATE: {
      if (!SCREENS.includes(action.screen)) {
        throw new Error(`Unknown screen "${action.screen}".`);
      }
      if (action.screen === 'mission' && !state.game) {
        throw new Error('There is no mission in progress.');
      }
      if (action.screen === state.screen) return state;
      return deepFreeze({ ...state, screen: action.screen });
    }

    case ACTIONS.START_MISSION:
      return deepFreeze({ screen: 'mission', game: createInitialGameState() });

    case ACTIONS.END_MISSION:
      return deepFreeze({ screen: 'title', game: null });

    case ACTIONS.LOAD_SAVED:
      if (!action.savedState || !action.savedState.game) return state;
      return deepFreeze(action.savedState);

    case ACTIONS.APPLY_EFFECTS: {
      if (!state.game) throw new Error('There is no mission in progress.');
      const nextGame = applyEffects(state.game, action.effects);
      if (nextGame === state.game) return state;
      return deepFreeze({ ...state, game: nextGame });
    }

    case ACTIONS.MAKE_DECISION: {
      if (!state.game || !state.game.currentEvent) return state;
      const eventObj = state.game.currentEvent;
      const choice = eventObj.choices.find((c) => c.id === action.choiceId);
      if (!choice) return state;

      const updated = applyEffects(state.game, choice.effects);
      const nextObjectives = { ...state.game.objectives };
      if (choice.unlocksObjective) {
        nextObjectives[choice.unlocksObjective] = true;
      }

      const nextCommsStatus = choice.unlocksObjective === 'reportSent' ? 'synced' : 'delayed';

      const historyEntry = {
        day: state.game.day,
        eventTitle: eventObj.title,
        choiceLabel: choice.label,
        effects: choice.effects,
        lesson: eventObj.scienceLesson,
      };

      const nextGame = {
        ...updated,
        objectives: nextObjectives,
        comms: {
          status: nextCommsStatus,
          oneWayDelayMinutes: eventObj.commsDelayMinutes,
        },
        currentLesson: eventObj.scienceLesson,
        lastChoiceLabel: choice.label,
        currentEvent: null,
        history: [...state.game.history, historyEntry],
      };

      return deepFreeze({ ...state, game: nextGame });
    }

    case ACTIONS.ADVANCE_DAY: {
      if (!state.game) return state;

      // Apply daily resource consumption and solar generation
      let nextGame = applyEffects(state.game, CONFIG.dailyRates);

      // Check critical life-support depletion
      const criticalLifeSupport = ['oxygen', 'food', 'water'].filter(
        (k) => nextGame.resources[k] <= 0
      );

      let emptyOxygenDays = nextGame.resources.oxygen <= 0 ? state.game.emptyOxygenDays + 1 : 0;

      if (criticalLifeSupport.length > 0) {
        nextGame = applyEffects(nextGame, {
          crewHealth: CONFIG.zeroResourceHealthPenalty * criticalLifeSupport.length,
        });
      }

      // Check early mission failure conditions
      if (nextGame.crewHealth <= 0 || emptyOxygenDays >= 2) {
        const failReason =
          emptyOxygenDays >= 2
            ? 'Oxygen reserves stayed empty for two consecutive days, triggering an automated crew return to the orbital craft.'
            : 'Crew health dropped to a critical threshold after life-support shortages, so the crew evacuated safely to orbit.';

        const finishedGame = {
          ...nextGame,
          emptyOxygenDays,
          outcome: {
            won: false,
            status: 'evacuated',
            title: 'Mission Ended Early — Crew Evacuated Safely',
            reason: failReason,
          },
        };
        return deepFreeze({ screen: 'report', game: finishedGame });
      }

      // Check Day 10 completion
      if (state.game.day >= state.game.totalDays) {
        const completedCount = countCompletedObjectives(nextGame);
        const won = completedCount >= 2;
        const finishedGame = {
          ...nextGame,
          emptyOxygenDays,
          outcome: {
            won,
            status: won ? 'success' : 'partial',
            title: won
              ? 'Mission Accomplished, Commander!'
              : 'Crew Survived — Partial Mission Success',
            reason: won
              ? `Your crew survived all ${state.game.totalDays} days on Mars and completed ${completedCount} of 3 mission objectives!`
              : `Your crew survived all ${state.game.totalDays} days safely, but only completed ${completedCount} of 3 mission objectives (2 required for full success).`,
          },
        };
        return deepFreeze({ screen: 'report', game: finishedGame });
      }

      // Advance to the next day
      const nextDay = state.game.day + 1;
      const nextEvent = EVENTS[(nextDay - 1) % EVENTS.length];
      const advancedGame = {
        ...nextGame,
        day: nextDay,
        emptyOxygenDays,
        currentLesson: null,
        lastChoiceLabel: null,
        currentEvent: nextEvent,
        comms: {
          status: nextGame.objectives.reportSent ? 'synced' : 'delayed',
          oneWayDelayMinutes: nextEvent.commsDelayMinutes,
        },
      };

      return deepFreeze({ ...state, game: advancedGame });
    }

    default:
      throw new Error(`Unknown action type "${action?.type}".`);
  }
}

/**
 * Compares old and new state and returns a list of events for store subscribers.
 */
export function deriveEvents(prev, next, action) {
  const events = [];

  if (action.type === ACTIONS.START_MISSION) events.push({ type: 'missionStarted' });
  if (action.type === ACTIONS.END_MISSION) events.push({ type: 'missionEnded' });
  if (prev.screen !== next.screen) {
    events.push({ type: 'screenChanged', from: prev.screen, to: next.screen });
  }

  if (prev.game && next.game && prev.game !== next.game && action.type !== ACTIONS.START_MISSION) {
    for (const key of EFFECT_KEYS) {
      const isResource = RESOURCE_KEYS.includes(key);
      const from = isResource ? prev.game.resources[key] : prev.game[key];
      const to = isResource ? next.game.resources[key] : next.game[key];
      if (from === to) continue;

      const type = isResource ? 'resourceChanged' : `${key}Changed`;
      events.push({ type, key, from, to, delta: to - from });

      if (isResource) {
        const statusFrom = getResourceStatus(key, from);
        const statusTo = getResourceStatus(key, to);
        if (statusFrom !== statusTo) {
          events.push({ type: 'resourceStatusChanged', key, from: statusFrom, to: statusTo });
        }
      }
    }
  }
  return events;
}