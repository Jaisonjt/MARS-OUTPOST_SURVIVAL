/**
 * ui.js — screen switching, Mission Report rendering, NASA DONKI live check, and localStorage save.
 */
import { CONFIG } from './config.js';
import { ACTIONS, SCREENS, getObjectivesStatus } from './gameState.js';
import { RESOURCE_KEYS } from './resources.js';
import { createDashboard } from './dashboard.js';
import { $, make } from './dom.js';

const PAGE_TITLES = {
  'title': 'MARS: OUTPOST SURVIVAL',
  'how-to-play': 'How to Play — MARS: OUTPOST SURVIVAL',
  'science-data': 'Science & Data — MARS: OUTPOST SURVIVAL',
  'mission': 'Mission Control — MARS: OUTPOST SURVIVAL',
  'report': 'Mission Report — MARS: OUTPOST SURVIVAL',
};

const STORAGE_KEY = 'mars_outpost_save_v1';
const LEAVE_CONFIRM_MS = 4000;

function fillFromConfig() {
  const values = {
    totalDays: CONFIG.mission.totalDays,
    crewSize: CONFIG.mission.crewSize,
    lowBelow: CONFIG.thresholds.lowBelow,
  };
  document.querySelectorAll('[data-fill]').forEach((node) => {
    const value = values[node.dataset.fill];
    if (value !== undefined) node.textContent = String(value);
  });

  $('#htp-resources').replaceChildren(
    ...RESOURCE_KEYS.map((key) => {
      const info = CONFIG.resources[key];
      const iconNode = make('span', 'icon', info.icon);
      iconNode.setAttribute('aria-hidden', 'true');
      return make('li', null, iconNode, make('strong', null, info.label), ` — ${info.description}`);
    }),
  );
}

/** Populates the end-of-mission report screen when the mission concludes. */
function renderMissionReport(game) {
  if (!game || !game.outcome) return;

  $('#report-badge').textContent = game.outcome.won ? '🏆 MISSION SUCCESS' : '🛰️ EDUCATIONAL DEBRIEF';
  $('#report-title').textContent = game.outcome.title;
  $('#report-summary').textContent = game.outcome.reason;

  // Final resources & meters
  const statsList = $('#report-stats');
  statsList.replaceChildren(
    make('li', null, `🧑‍🚀 Final Crew Health: ${game.crewHealth} / 100`),
    make('li', null, `🔬 Final Research Score: ${game.research} / 100`),
    ...RESOURCE_KEYS.map((key) => {
      const info = CONFIG.resources[key];
      return make('li', null, `${info.icon} ${info.label}: ${game.resources[key]} / ${info.max}`);
    })
  );

  // Objectives summary
  const objStatus = getObjectivesStatus(game);
  $('#report-objectives').replaceChildren(
    make('li', objStatus.researchGoal ? 'status--ok' : 'status--low',
      `${objStatus.researchGoal ? '✅' : '❌'} Conduct Mars Science (Target: ${CONFIG.mission.researchTarget} Research, Achieved: ${game.research})`),
    make('li', objStatus.foodGrown ? 'status--ok' : 'status--low',
      `${objStatus.foodGrown ? '✅' : '❌'} Cultivate Outpost Food in the Hydroponic Greenhouse`),
    make('li', objStatus.reportSent ? 'status--ok' : 'status--low',
      `${objStatus.reportSent ? '✅' : '❌'} Transmit High-Resolution Telemetry Packet to Earth`)
  );

  // Key decisions log
  const decisionsContainer = $('#report-decisions');
  if (game.history.length === 0) {
    decisionsContainer.replaceChildren(make('li', null, 'No decisions recorded.'));
  } else {
    decisionsContainer.replaceChildren(
      ...game.history.map((item) =>
        make(
          'li',
          null,
          make('strong', null, `Day ${item.day} (${item.eventTitle}): `),
          `Chose "${item.choiceLabel}"`
        )
      )
    );
  }

  // Personalized science takeaways
  const takeaways = [
    'Every engineering choice on Mars involves a trade-off: boosting life support or shielding consumes electrical energy needed for research.',
    'Because Earth and Mars move in separate orbits, one-way radio signals take 4 to 22 minutes—requiring astronauts to make autonomous decisions.',
    'Space-weather alerts (tracked by NASA DONKI) require shielding and shelter protocols because Mars lacks a thick atmosphere and global magnetic field.',
  ];
  $('#report-takeaways').replaceChildren(...takeaways.map((t) => make('li', null, t)));
}

/** Optional live NASA DONKI API check with automatic archived fallback. */
async function fetchLiveDonkiSample() {
  const statusEl = $('#donki-live-status');
  statusEl.textContent = 'Contacting NASA DONKI API (api.nasa.gov)...';
  try {
    const response = await fetch(
      'https://api.nasa.gov/DONKI/FLR?startDate=2024-05-01&endDate=2024-05-15&api_key=DEMO_KEY'
    );
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const sample = data[0];
      statusEl.textContent = `✅ Live NASA DONKI Record Retrieved: Solar Flare Class ${sample.classType || 'M'} peaked at ${sample.peakTime || 'recorded timestamp'} (Active Region ${sample.activeRegionNum || 'N/A'}).`;
    } else {
      statusEl.textContent = '✅ Connected to NASA DONKI API (Using curated archived event: M5.2 Solar Flare).';
    }
  } catch (err) {
    statusEl.textContent =
      'ℹ️ Offline / Rate-Limited Fallback Active: Using curated NASA DONKI record (Event ID: 2024-05-10T06:54:00-FLR-001, Class X3.9 Solar Flare). Core game works 100% offline.';
  }
}

export function initUI(store) {
  const screens = new Map(SCREENS.map((id) => [id, $(`[data-screen="${id}"]`)]));
  const liveRegion = $('#live-region');
  const leaveButton = $('#leave-btn');
  const leaveLabel = leaveButton.textContent;
  const dashboard = createDashboard();
  let leaveTimer = null;

  fillFromConfig();

  // Restore saved progress from localStorage if available
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (saved && saved.game && SCREENS.includes(saved.screen)) {
        store.dispatch({ type: ACTIONS.LOAD_SAVED, savedState: saved });
      }
    }
  } catch (e) {
    console.warn('Could not load saved state:', e);
  }

  function disarmLeave() {
    clearTimeout(leaveTimer);
    leaveTimer = null;
    leaveButton.textContent = leaveLabel;
    leaveButton.classList.remove('is-armed');
  }

  function pressLeave() {
    if (leaveTimer === null) {
      leaveButton.textContent = 'Click again to leave';
      leaveButton.classList.add('is-armed');
      liveRegion.textContent = 'Press Leave mission again to confirm. Your mission progress will be reset.';
      leaveTimer = setTimeout(disarmLeave, LEAVE_CONFIRM_MS);
      return;
    }
    disarmLeave();
    localStorage.removeItem(STORAGE_KEY);
    store.dispatch({ type: ACTIONS.END_MISSION });
  }

  function render(state) {
    for (const [id, section] of screens) section.hidden = id !== state.screen;
    document.title = PAGE_TITLES[state.screen] || 'MARS: OUTPOST SURVIVAL';

    if (state.screen === 'mission' && state.game) {
      dashboard.update(state.game);
    } else if (state.screen === 'report' && state.game) {
      renderMissionReport(state.game);
    }

    // Save current state to localStorage
    try {
      if (state.game) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      // Ignore storage quota errors
    }
  }

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;

    switch (button.dataset.action) {
      case 'start-mission':
        localStorage.removeItem(STORAGE_KEY);
        store.dispatch({ type: ACTIONS.START_MISSION });
        break;
      case 'go':
        store.dispatch({ type: ACTIONS.NAVIGATE, screen: button.dataset.target });
        break;
      case 'leave-mission':
        pressLeave();
        break;
      case 'make-decision':
        dashboard.clearPreviews();
        store.dispatch({ type: ACTIONS.MAKE_DECISION, choiceId: button.dataset.choiceId });
        break;
      case 'advance-day':
        store.dispatch({ type: ACTIONS.ADVANCE_DAY });
        break;
      case 'fetch-donki':
        fetchLiveDonkiSample();
        break;
    }
  });

  // Wave 2: Hover & keyboard focus logic for Ghost Bars
  function handlePreviewTrigger(e) {
    const btn = e.target.closest('[data-action="make-decision"]');
    if (btn && btn.dataset.effects) {
      dashboard.previewEffects(JSON.parse(btn.dataset.effects));
    }
  }

  function handlePreviewClear(e) {
    if (e.target.closest('[data-action="make-decision"]')) {
      dashboard.clearPreviews();
    }
  }

  document.addEventListener('mouseover', handlePreviewTrigger);
  document.addEventListener('focusin', handlePreviewTrigger);
  document.addEventListener('mouseout', handlePreviewClear);
  document.addEventListener('focusout', handlePreviewClear);

  store.subscribe(render);

  store.on('screenChanged', ({ to }) => {
    disarmLeave();
    const heading = screens.get(to)?.querySelector('h1, h2');
    if (heading) {
      heading.setAttribute('tabindex', '-1');
      heading.focus();
    }
    liveRegion.textContent = `Showing: ${PAGE_TITLES[to]}`;
  });

  render(store.getState());
}