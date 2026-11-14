/**
 * config.js — EVERY tunable game number lives in this one file.
 * All numbers are simplified GAMEPLAY ASSUMPTIONS, not real mission specs.
 */
import { deepFreeze } from './utils.js';

export const CONFIG = deepFreeze({
  mission: {
    totalDays: 10,
    crewSize: 4,
    researchTarget: 40, // Research points needed for the science objective
  },

  // Daily net change applied at the start of each new day (solar panels add +4 energy/day)
  dailyRates: {
    oxygen: -6,
    energy: +4,
    food: -6,
    water: -6,
    shielding: 0,
  },

  // Health penalty if a critical life-support resource (oxygen, food, water) hits 0
  zeroResourceHealthPenalty: -20,

  resources: {
    oxygen: {
      label: 'Oxygen', icon: '💨',
      start: 80, min: 0, max: 100,
      description: 'The air your crew breathes. Life support needs energy to make it.',
    },
    energy: {
      label: 'Energy', icon: '⚡',
      start: 70, min: 0, max: 100,
      description: 'Electricity from solar panels and batteries. It runs almost everything.',
    },
    food: {
      label: 'Food', icon: '🌱',
      start: 70, min: 0, max: 100,
      description: 'Meals for the crew. The greenhouse can grow more, if it has energy and water.',
    },
    water: {
      label: 'Water', icon: '💧',
      start: 70, min: 0, max: 100,
      description: 'For drinking, cooking and watering the plants.',
    },
    shielding: {
      label: 'Shielding', icon: '🛡️',
      start: 60, min: 0, max: 100,
      description: 'Protection from space radiation. Thicker shielding keeps the crew safer.',
    },
  },

  crewHealth: { label: 'Crew health', icon: '🧑‍🚀', start: 100, min: 0, max: 100 },
  research:   { label: 'Research',    icon: '🔬',   start: 0,   min: 0, max: 100 },

  thresholds: { lowBelow: 20 },

  statusLabels: {
    ok:       { label: 'OK',    icon: '✅' },
    low:      { label: 'Low',   icon: '⚠️' },
    critical: { label: 'Empty', icon: '⛔' },
  },

  commsStatusLabels: {
    idle:    { label: 'Standing by',      icon: '📡' },
    delayed: { label: 'Signal in transit', icon: '⏳' },
    synced:  { label: 'Telemetry synced', icon: '🛰️' },
  },
});