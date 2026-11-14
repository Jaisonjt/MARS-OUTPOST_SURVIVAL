# MARS: OUTPOST SURVIVAL

A 2D educational Mars outpost management game for children aged 7-12 (NASA Space Apps Challenge).
Built with plain HTML, CSS and JavaScript. No installs, frameworks or backend needed.

> **Status: Milestone 1 of 9.** Title screen, How to Play, Science & Data and the game's
> state-management foundation. The playable dashboard arrives in Milestone 2.

All game numbers are **gameplay assumptions**, not real mission specifications.

---

## How to run it (Windows + VS Code)

The game uses JavaScript modules, which browsers will **not** load if you simply double-click
`index.html`. Use VS Code's free **Live Server** extension instead:

1. Install **Visual Studio Code** (https://code.visualstudio.com) if you don't have it.
2. In VS Code: **File → Open Folder…** and choose the `MARS-OUTPOST-SURVIVAL` folder.
3. Click the **Extensions** icon (four squares, left bar), search for **Live Server**
   (by Ritwick Dey), and click **Install**.
4. In the file list, right-click `index.html` and choose **Open with Live Server**
   (or click **Go Live** at the bottom-right of VS Code).
5. Your browser opens at something like `http://127.0.0.1:5500`. After you edit and save a file,
   the page refreshes by itself.

### Troubleshooting
| Problem | Fix |
|---|---|
| Red box: "The game could not start" | You probably double-clicked `index.html`. Use Live Server (steps above). |
| Blank page or buttons do nothing | Press **F12**, open the **Console** tab, and read the red message. Usually a file is missing or misnamed. |
| Changes don't show | Hard-refresh with **Ctrl + F5**. |
| "Go Live" is missing | Extension not installed, or you opened a single file instead of the whole folder. |
| Port already in use | Close other Live Server windows, or stop it (click **Port: 5500** in the status bar) and start again. |

---

## Folder structure

```text
MARS-OUTPOST-SURVIVAL/
├── index.html        the page and all screens
├── style.css         colours, layout, animation
├── package.json      lets the same code run in Node later (balance simulator)
├── js/
│   ├── main.js       starting point: connects the pieces
│   ├── config.js     EVERY tunable number (edit the game balance here)
│   ├── utils.js      small shared helpers
│   ├── resources.js  rules for resource values (clamping, status) — pure functions
│   ├── gameState.js  state shape + the reducer + event detection — pure functions
│   ├── store.js      holds the state; tells listeners what happened (pub/sub)
│   └── ui.js         everything that touches the page
└── assets/           images, icons, sounds (empty for now)
```

Files planned for later milestones: `events.js`, `missions.js`, `nasaData.js`, `data/events.json`.

### How the pieces fit

```text
click  →  ui.js dispatches an action  →  gameState.js reducer returns a NEW state
       →  store.js saves it and announces events  →  ui.js redraws
```

The rules in `resources.js` and `gameState.js` never touch the page, so they can be tested
and re-used by the Node balance simulator planned for Milestone 6.

---

## Milestone 1 test checklist

- [ ] Title screen appears with the title, tagline, intro, and three buttons.
- [ ] **How to Play** opens, shows five resources, and **Back to title** returns.
- [ ] **Science & Data** opens, shows four NASA links (they open in a new tab).
- [ ] **Start Mission** opens the test screen: Day 1 of 10, Oxygen 80 / 100.
- [ ] Test buttons change values and never go below 0 or above 100.
- [ ] Status words and icons change (OK / Low / Empty).
- [ ] Keyboard only: Tab reaches every button with a visible outline; Enter/Space presses it.
- [ ] **Leave mission** returns to the title; **Start Mission** again resets everything.
