/**
 * dashboard.js — resource bars, ghost previews, floating deltas, living SVG scene,
 * objectives tracker, comms delay, and mission log.
 */
import { CONFIG } from './config.js';
import { RESOURCE_KEYS, getMeterInfo, getResourceStatus } from './resources.js';
import { getObjectivesStatus } from './gameState.js';
import { $, make } from './dom.js';

const SEVERITY = { critical: 0, low: 1, ok: 2 };

function icon(text) {
  const node = make('span', 'icon', text);
  node.setAttribute('aria-hidden', 'true');
  return node;
}

export function createDashboard() {
  const meters = new Map();
  const dayLabel = $('#m-day');
  const dayTotal = $('#m-total');
  const pipList = $('#day-pips');
  const alertList = $('#alert-list');
  const commsStatus = $('#comms-status');
  const commsNote = $('#comms-note');
  const objectiveList = $('#objective-list');
  const missionLog = $('#mission-log');
  const eventPanel = $('#event-panel');
  const lessonPanel = $('#lesson-panel');
  const sceneSvg = $('#outpost-scene');
  let lastState = null;

  function buildMeter(key, { hasStatus, modifier }) {
    const info = getMeterInfo(key);
    const value = make('span', 'meter-value');
    const status = make('span', 'meter-status');
    const readout = make('span', 'meter-readout', value, ` / ${info.max}`);
    if (hasStatus) readout.append(status);

    const head = make('div', 'meter-head', make('span', 'meter-name', icon(info.icon), info.label), readout);

    const fill = make('div', 'meter-fill');
    const ghost = make('div', 'meter-ghost');
    const track = make('div', 'meter-track', fill, ghost);
    track.setAttribute('role', 'meter');
    track.setAttribute('aria-label', info.label);
    track.setAttribute('aria-valuemin', String(info.min));
    track.setAttribute('aria-valuemax', String(info.max));

    if (hasStatus) {
      const tick = make('div', 'meter-tick');
      tick.style.left = `${(CONFIG.thresholds.lowBelow / info.max) * 100}%`;
      track.append(tick);
    }

    const root = make('div', 'meter', head, track);
    if (modifier) root.classList.add(modifier);
    return { root, value, status, fill, ghost, track, head, hasStatus, modifier, info };
  }

  const resourceHost = $('#resource-bars');
  for (const key of RESOURCE_KEYS) {
    const meter = buildMeter(key, { hasStatus: true });
    meters.set(key, meter);
    resourceHost.append(meter.root);
  }
  const crewHost = $('#crew-bars');
  for (const [key, modifier] of [['crewHealth', 'meter--crew'], ['research', 'meter--research']]) {
    const meter = buildMeter(key, { hasStatus: false, modifier });
    meters.set(key, meter);
    crewHost.append(meter.root);
  }

  function spawnFloatingDelta(meter, oldVal, newVal) {
    const delta = newVal - oldVal;
    if (delta === 0) return;
    const sign = delta > 0 ? '+' : '';
    const el = make('span', `floating-delta ${delta > 0 ? 'delta-up' : 'delta-down'}`, `${sign}${delta}`);
    meter.head.append(el);
    setTimeout(() => el.remove(), 1200);
  }

  function setMeter(key, amount, oldAmount) {
    const meter = meters.get(key);
    const { info } = meter;
    const fraction = (amount - info.min) / (info.max - info.min);

    meter.value.textContent = String(amount);
    meter.fill.style.transform = `scaleX(${fraction})`;
    meter.track.setAttribute('aria-valuenow', String(amount));

    if (oldAmount !== undefined && oldAmount !== amount) {
      spawnFloatingDelta(meter, oldAmount, amount);
    }

    meter.root.className = `meter${meter.modifier ? ` ${meter.modifier}` : ''}`;
    if (meter.hasStatus) {
      const statusKey = getResourceStatus(key, amount);
      const label = CONFIG.statusLabels[statusKey];
      meter.root.classList.add(`meter--${statusKey}`);
      meter.status.className = `meter-status status--${statusKey}`;
      meter.status.replaceChildren(icon(label.icon), ` ${label.label}`);
    }
  }

  function previewEffects(effects) {
    if (!lastState) return;
    meters.forEach((meter, key) => {
      if (!effects[key]) return;
      const current = lastState.resources[key] ?? lastState[key];
      const next = Math.max(0, Math.min(meter.info.max, current + effects[key]));
      meter.ghost.style.transform = `scaleX(${next / meter.info.max})`;
      meter.ghost.style.opacity = '1';
      meter.ghost.className = `meter-ghost ${effects[key] > 0 ? 'ghost-up' : 'ghost-down'}`;
    });
  }

  function clearPreviews() {
    meters.forEach((m) => {
      m.ghost.style.opacity = '0';
    });
  }

  function renderDay(game) {
    dayLabel.textContent = String(game.day);
    dayTotal.textContent = String(game.totalDays);

    if (pipList.children.length !== game.totalDays) {
      pipList.replaceChildren(
        ...Array.from({ length: game.totalDays }, (_, i) => make('li', 'day-pip', String(i + 1))),
      );
    }
    [...pipList.children].forEach((pip, i) => {
      const dayNumber = i + 1;
      pip.classList.toggle('is-done', dayNumber < game.day);
      pip.classList.toggle('is-current', dayNumber === game.day);
    });
  }

  function renderAlerts(game) {
    const problems = RESOURCE_KEYS
      .map((key) => ({ key, value: game.resources[key], status: getResourceStatus(key, game.resources[key]) }))
      .filter((item) => item.status !== 'ok')
      .sort((a, b) => SEVERITY[a.status] - SEVERITY[b.status] || a.value - b.value);

    if (problems.length === 0) {
      alertList.replaceChildren(make('li', 'status--ok', icon('✅'), ' All outpost systems nominal.'));
      return;
    }
    alertList.replaceChildren(
      ...problems.map(({ key, value, status }) => {
        const info = CONFIG.resources[key];
        const label = CONFIG.statusLabels[status];
        const detail = status === 'low' ? ` (${value}/${info.max} left)` : ' — Crew health at risk!';
        return make('li', `status--${status}`, icon(label.icon), ` ${info.label} is ${label.label}${detail}`);
      }),
    );
  }

  function renderComms(game) {
    const known = CONFIG.commsStatusLabels[game.comms.status];
    const label = known ?? { label: game.comms.status, icon: '📡' };
    commsStatus.replaceChildren(icon(label.icon), ` ${label.label}`);
    const mins = game.comms.oneWayDelayMinutes;
    commsNote.textContent =
      mins === null
        ? 'Signal delay varies with Mars–Earth orbital distance.'
        : `One-way light time to Earth today: ~${mins} min (${mins * 2} min round-trip).`;
  }

  function renderObjectives(game) {
    const status = getObjectivesStatus(game);
    const items = [
      {
        done: status.researchGoal,
        text: `Reach ${CONFIG.mission.researchTarget} Research points (${game.research}/${CONFIG.mission.researchTarget})`,
      },
      {
        done: status.foodGrown,
        text: 'Harvest fresh crops in the Greenhouse',
      },
      {
        done: status.reportSent,
        text: 'Transmit high-resolution telemetry report to Earth',
      },
    ];
    objectiveList.replaceChildren(
      ...items.map((item) =>
        make(
          'li',
          item.done ? 'status--ok' : 'note',
          icon(item.done ? '✅' : '⬜'),
          ` ${item.text}`
        )
      )
    );
  }

  function renderMissionLog(game) {
    if (game.history.length === 0) {
      missionLog.replaceChildren(make('li', 'note', 'No decisions logged yet. Complete Day 1 to begin.'));
      return;
    }
    missionLog.replaceChildren(
      ...[...game.history].reverse().slice(0, 5).map((entry) =>
        make(
          'li',
          null,
          make('strong', null, `Day ${entry.day}: `),
          `${entry.choiceLabel}`
        )
      )
    );
  }

  // Wave 3 Polish: Scene reacts visually to game state and active weather/events
  function renderLivingScene(game) {
    const isDusty = game.currentEvent && game.currentEvent.category === 'weather';
    const isRadiation = game.currentEvent && game.currentEvent.category === 'radiation';
    const isLowEnergy = game.resources.energy < CONFIG.thresholds.lowBelow;
    const isGreenhouseRich = game.resources.food >= 75 || game.objectives.foodGrown;

    sceneSvg.classList.toggle('scene--dusty', Boolean(isDusty));
    sceneSvg.classList.toggle('scene--radiation', Boolean(isRadiation));
    sceneSvg.classList.toggle('scene--low-power', isLowEnergy);
    sceneSvg.classList.toggle('scene--lush', isGreenhouseRich);
  }

  function renderEventCards(game) {
    if (game.currentEvent) {
      eventPanel.hidden = false;
      lessonPanel.hidden = true;
      $('#event-title').textContent = game.currentEvent.title;
      $('#event-desc').textContent = game.currentEvent.description;
      $('#event-source').textContent = `NASA Reference: ${game.currentEvent.sourceNote}`;

      const choicesContainer = $('#event-choices');
      choicesContainer.replaceChildren();

      game.currentEvent.choices.forEach((choice) => {
        const btn = make('button', 'btn btn--secondary', choice.label);
        btn.type = 'button';
        btn.dataset.action = 'make-decision';
        btn.dataset.choiceId = choice.id;
        btn.dataset.effects = JSON.stringify(choice.effects);

        const previewNote = make('p', 'note', `Trade-off preview: ${choice.previewText}`);
        const wrapper = make('div', 'choice-wrapper', btn, previewNote);
        choicesContainer.append(wrapper);
      });
    } else if (game.currentLesson) {
      eventPanel.hidden = true;
      lessonPanel.hidden = false;
      $('#lesson-choice-made').textContent = `Decision executed: "${game.lastChoiceLabel}"`;
      $('#lesson-text').textContent = game.currentLesson;
      const advBtn = $('#advance-day-btn');
      advBtn.textContent =
        game.day >= game.totalDays ? '🏁 View Final Mission Report' : `➡️ Advance to Day ${game.day + 1}`;
    }
  }

  function update(game) {
    const previous = lastState || game;
    for (const key of RESOURCE_KEYS) {
      setMeter(key, game.resources[key], previous.resources[key]);
    }
    setMeter('crewHealth', game.crewHealth, previous.crewHealth);
    setMeter('research', game.research, previous.research);

    renderDay(game);
    renderAlerts(game);
    renderComms(game);
    renderObjectives(game);
    renderMissionLog(game);
    renderLivingScene(game);
    renderEventCards(game);
    lastState = game;
  }

  return { update, previewEffects, clearPreviews };
}