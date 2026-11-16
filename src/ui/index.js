// Blackbriar UI: menu, HUD, creature card, journal, pause, death / win screens.
// All DOM lives inside #ui-root. No frameworks. HUD is pointer-events:none.
import './style.css';
import { CREATURES, CREATURE_BY_ID } from '../data/creatures.js';

const STORE_ID = 'blackbriar.identified';
const STORE_SET = 'blackbriar.settings';
const SEGMENTS = 10;
const COMPASS_SPAN = 150; // degrees visible across the strip
const TAU = Math.PI * 2;

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
function svg(inner, cls, vb = '0 0 24 24') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', vb);
  s.setAttribute('aria-hidden', 'true');
  if (cls) s.setAttribute('class', cls);
  s.innerHTML = inner;
  return s;
}
function pips(n, cls = 'pips') {
  const w = el('span', cls);
  w.setAttribute('aria-label', `Threat ${n} of 5`);
  for (let i = 0; i < 5; i++) w.appendChild(el('i', i < n ? 'on' : ''));
  return w;
}
function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
function pick(n, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}
function firstSentence(t) {
  const m = /^.*?[.!?](?=\s|$)/.exec(t || '');
  return m ? m[0] : t || '';
}
function wrapPi(a) {
  a = (a + Math.PI) % TAU;
  if (a < 0) a += TAU;
  return a - Math.PI;
}

const ICON = {
  rock: '<path d="M4 15l3-6 5-3 6 2 2 6-4 4H8z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/>',
  battery:
    '<rect x="4" y="8" width="14" height="9" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M20 11v3" stroke="currentColor" stroke-width="2"/>',
  sling:
    '<path d="M7 3v8a5 5 0 0010 0V3M12 16v5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M7 4q5 3 10 0" fill="none" stroke="currentColor" stroke-width="1"/>',
  eyeOpen:
    '<path d="M2 12q10-9 20 0-10 9-20 0z" fill="none" stroke="currentColor" stroke-width="1.3"/><circle cx="12" cy="12" r="3" fill="currentColor"/>',
  eyeShut:
    '<path d="M2 11q10 8 20 0" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M6 15l-1.5 2M12 16.5V19M18 15l1.5 2" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>',
  rune: '<path d="M12 2l7 10-7 10-7-10z" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 7v10M9 11l3-2 3 2" fill="none" stroke="currentColor" stroke-width="1.4"/>',
};

export function createUI(ctx) {
  const root = document.getElementById('ui-root') || document.body;
  const bus = ctx.bus;
  const audio = () => ctx.audio;

  function click() {
    // Don't un-suspend the audio context from clicks on the pause menu (settings etc.).
    if (ctx.state !== 'paused') audio()?.resume?.();
    audio()?.play?.('ui_click');
  }
  function button(label, cls, fn) {
    const b = el('button', 'btn ' + (cls || ''), label);
    b.type = 'button';
    b.addEventListener('click', (e) => {
      click();
      fn?.(e);
    });
    return b;
  }

  // ---------------------------------------------------------------- state
  let identified = new Set();
  try {
    identified = new Set(JSON.parse(localStorage.getItem(STORE_ID) || '[]'));
  } catch (e) {
    /* ignore */
  }
  const settings = {
    difficulty: 'normal',
    quality: ctx.settings?.quality || 'medium',
    sensitivity: ctx.settings?.sensitivity ?? 1,
    volume: ctx.settings?.volume ?? 0.8,
  };
  try {
    const s = JSON.parse(localStorage.getItem(STORE_SET) || 'null');
    if (s) {
      if (['easy', 'normal', 'hard'].includes(s.difficulty)) settings.difficulty = s.difficulty;
      if (['low', 'medium', 'high'].includes(s.quality)) settings.quality = s.quality;
      if (typeof s.sensitivity === 'number') settings.sensitivity = s.sensitivity;
      if (typeof s.volume === 'number') settings.volume = s.volume;
    }
  } catch (e) {
    /* ignore */
  }
  function saveSettings() {
    try {
      localStorage.setItem(STORE_SET, JSON.stringify(settings));
    } catch (e) {
      /* ignore */
    }
  }
  let selected = new Set(pick(4, CREATURES.map((c) => c.id)));
  let hudOn = false;
  let journalOn = false;

  // ---------------------------------------------------------------- screens
  function screen(cls) {
    const s = el('section', 'screen ' + cls);
    root.appendChild(s);
    return s;
  }
  const setOn = (e, v) => e.classList.toggle('on', !!v);

  // ================================================================ MENU
  const menu = screen('menu');
  const fog = el('div', 'fog');
  fog.append(el('i'), el('i'), el('i'));
  menu.append(fog, el('div', 'grain'));

  const title = el('div', 'menu-page title-page on');
  title.append(
    el('div', 'kicker', 'A night in the forest'),
    el('h1', 'logo', 'BLACKBRIAR'),
    el('p', 'tagline', 'Something walks these woods.')
  );
  const enter = button('Enter the woods', 'btn-lg', () => showPage('setup'));
  title.append(enter);

  const setup = el('div', 'menu-page setup-page');
  const setupHead = el('header', 'setup-head');
  setupHead.append(el('h2', 'h-serif', 'The Hunt'), el('p', 'sub', 'Choose what walks the woods tonight.'));
  const quick = el('div', 'quick');
  const countLbl = el('span', 'label count');
  const grid = el('div', 'cgrid');
  const cardEls = new Map();
  for (const c of CREATURES) {
    const b = el('button', 'cc');
    b.type = 'button';
    b.style.setProperty('--accent', c.accent);
    b.setAttribute('aria-pressed', 'false');
    const glyph = el('span', 'cc-glyph', c.name.replace(/^The /, '')[0]);
    const nm = el('span', 'cc-name', c.name);
    const ep = el('span', 'cc-ep', c.epithet);
    b.append(glyph, nm, ep, pips(c.threat, 'pips sm'));
    b.addEventListener('click', () => {
      click();
      if (selected.has(c.id)) selected.delete(c.id);
      else selected.add(c.id);
      syncSelection();
    });
    cardEls.set(c.id, b);
    grid.appendChild(b);
  }
  quick.append(
    button('Random 4', 'btn-sm', () => {
      selected = new Set(pick(4, CREATURES.map((c) => c.id)));
      syncSelection();
    }),
    button('All twelve', 'btn-sm', () => {
      selected = new Set(CREATURES.map((c) => c.id));
      syncSelection();
    }),
    button('Clear', 'btn-sm', () => {
      selected = new Set();
      syncSelection();
    }),
    countLbl
  );
  const startBtn = button('Begin', 'btn-lg', () => {
    if (!selected.size) return;
    bus.emit('ui:settings', { quality: settings.quality, sensitivity: settings.sensitivity, volume: settings.volume });
    bus.emit('ui:start', {
      creatureIds: CREATURES.map((c) => c.id).filter((id) => selected.has(id)),
      difficulty: settings.difficulty,
    });
  });
  function syncSelection() {
    for (const [id, b] of cardEls) {
      const on = selected.has(id);
      b.classList.toggle('sel', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    }
    countLbl.textContent = `${selected.size} / 12 chosen`;
    startBtn.disabled = selected.size === 0;
  }

  // settings widgets (shared by menu + pause, kept in sync)
  const syncers = [];
  function segmented(label, key, options, onChange) {
    const wrap = el('div', 'field');
    wrap.appendChild(el('span', 'label', label));
    const row = el('div', 'seg');
    const btns = options.map((o) => {
      const b = el('button', 'seg-b', o);
      b.type = 'button';
      b.addEventListener('click', () => {
        click();
        settings[key] = o;
        saveSettings();
        syncAll();
        onChange?.(o);
      });
      row.appendChild(b);
      return [o, b];
    });
    wrap.appendChild(row);
    syncers.push(() => btns.forEach(([o, b]) => b.classList.toggle('on', settings[key] === o)));
    return wrap;
  }
  function slider(label, key, min, max, step, fmt, onChange) {
    const wrap = el('div', 'field');
    const lab = el('span', 'label');
    const val = el('span', 'val');
    lab.append(label + ' ', val);
    const inp = el('input', 'range');
    inp.type = 'range';
    inp.min = min;
    inp.max = max;
    inp.step = step;
    inp.addEventListener('input', () => {
      settings[key] = parseFloat(inp.value);
      saveSettings();
      syncAll();
      onChange?.(settings[key]);
    });
    wrap.append(lab, inp);
    syncers.push(() => {
      if (document.activeElement !== inp || inp.value !== String(settings[key])) inp.value = settings[key];
      val.textContent = fmt(settings[key]);
    });
    return wrap;
  }
  function syncAll() {
    syncers.forEach((f) => f());
  }
  const emitSet = (patch) => bus.emit('ui:settings', patch);
  const fmtVol = (v) => Math.round(v * 100) + '%';
  const fmtSens = (v) => v.toFixed(2) + 'x';

  function difficultyField() {
    return segmented('Difficulty', 'difficulty', ['easy', 'normal', 'hard']);
  }
  function qualityField() {
    return segmented('Graphics', 'quality', ['low', 'medium', 'high'], (v) => emitSet({ quality: v }));
  }
  function sensField() {
    return slider('Mouse sensitivity', 'sensitivity', 0.2, 3, 0.05, fmtSens, (v) => emitSet({ sensitivity: v }));
  }
  function volField() {
    return slider('Volume', 'volume', 0, 1, 0.01, fmtVol, (v) => emitSet({ volume: v }));
  }

  const opts = el('div', 'opts panel');
  opts.append(difficultyField(), qualityField(), sensField(), volField());

  const how = el('div', 'how panel');
  how.appendChild(el('h3', 'label', 'How to survive'));
  const keys = el('div', 'keys');
  [
    ['WASD', 'move'],
    ['Shift', 'sprint'],
    ['C', 'crouch'],
    ['F', 'flashlight'],
    ['R', 'battery'],
    ['LMB', 'throw rock'],
    ['RMB', 'slingshot'],
    ['E', 'interact'],
    ['Tab', 'journal'],
    ['Esc', 'pause'],
  ].forEach(([k, d]) => {
    const r = el('span', 'key');
    r.append(el('kbd', '', k), el('span', '', d));
    keys.appendChild(r);
  });
  const rules = el('ol', 'rules');
  [
    'Light the five wardstones to bring the dawn.',
    'You cannot fight. Run, hide, distract.',
    'Shine your light to learn what hunts you.',
  ].forEach((t) => rules.appendChild(el('li', '', t)));
  how.append(keys, rules);

  const foot = el('div', 'setup-foot');
  foot.append(button('Back', 'btn-ghost', () => showPage('title')), startBtn);
  const left = el('div', 'setup-main');
  left.append(setupHead, quick, grid);
  const right = el('aside', 'setup-side');
  right.append(opts, how);
  const body = el('div', 'setup-body');
  body.append(left, right);
  setup.append(body, foot);
  menu.append(title, setup);

  function showPage(p) {
    setOn(title, p === 'title');
    setOn(setup, p === 'setup');
  }

  // ================================================================ HUD
  const hud = screen('hud');

  // top-left objective
  const objective = el('div', 'objective');
  const objText = el('span', 'obj-text');
  objective.append(el('span', 'label', 'Objective'), objText);

  // compass
  const compass = el('div', 'compass');
  const track = el('div', 'compass-track');
  compass.append(track, el('div', 'compass-tick'));
  const compassItems = [];
  for (let d = 0; d < 360; d += 15) {
    const major = d % 45 === 0;
    const it = el('span', 'cp ' + (major ? 'major' : 'minor'));
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    if (major) it.textContent = names[d];
    else it.appendChild(el('i'));
    it.dataset.deg = d;
    track.appendChild(it);
    compassItems.push({ el: it, rad: (d * Math.PI) / 180, last: '' });
  }
  const runeMarks = [];
  function ensureRunes(n) {
    while (runeMarks.length < n) {
      const m = el('span', 'cp rune');
      m.appendChild(svg(ICON.rune));
      m.style.display = 'none';
      track.appendChild(m);
      runeMarks.push({ el: m, last: '', vis: false });
    }
  }

  const cross = el('div', 'cross');

  // prompt + ring
  const promptWrap = el('div', 'prompt');
  const ring = svg(
    '<circle class="ring-bg" cx="22" cy="22" r="18"/><circle class="ring-fg" cx="22" cy="22" r="18" transform="rotate(-90 22 22)"/>',
    'ring',
    '0 0 44 44'
  );
  const ringFg = ring.querySelector('.ring-fg');
  const RING_C = 2 * Math.PI * 18;
  ringFg.style.strokeDasharray = RING_C;
  ringFg.style.strokeDashoffset = RING_C;
  const promptText = el('div', 'prompt-text');
  promptWrap.append(ring, promptText);

  // bottom-left: light
  const bl = el('div', 'hud-bl');
  const light = el('div', 'meter light');
  const lightHead = el('div', 'meter-head');
  const lightLbl = el('span', 'label', 'Light');
  const lightState = el('span', 'label state', '');
  lightHead.append(lightLbl, lightState);
  const segs = el('div', 'segs');
  const segEls = [];
  for (let i = 0; i < SEGMENTS; i++) {
    const s = el('i');
    segs.appendChild(s);
    segEls.push(s);
  }
  light.append(lightHead, segs);
  const spares = el('div', 'stat spares');
  spares.append(svg(ICON.battery, 'ico'), el('span', 'stat-n', '0'), el('span', 'label', 'spare'));
  const sparesN = spares.querySelector('.stat-n');
  const stamina = el('div', 'stamina');
  const staminaFill = el('i');
  stamina.appendChild(staminaFill);
  bl.append(light, spares, stamina);

  // bottom-right: items + eye
  const br = el('div', 'hud-br');
  const rocks = el('div', 'stat rocks');
  rocks.append(svg(ICON.rock, 'ico'), el('span', 'stat-n', '0'), el('span', 'label', 'rocks'));
  const rocksN = rocks.querySelector('.stat-n');
  const sling = el('div', 'stat sling');
  sling.append(svg(ICON.sling, 'ico'), el('span', 'label', 'sling'));
  sling.style.display = 'none';
  const eye = el('div', 'eye');
  const eyeIcoOpen = svg(ICON.eyeOpen, 'ico eye-open');
  const eyeIcoShut = svg(ICON.eyeShut, 'ico eye-shut');
  const eyeLbl = el('span', 'label', 'Exposed');
  eye.append(eyeIcoOpen, eyeIcoShut, eyeLbl);
  br.append(rocks, sling, eye);

  const toasts = el('div', 'toasts');
  hud.append(objective, compass, cross, promptWrap, bl, br, toasts);

  // ================================================================ CARD
  const card = screen('ccard');
  const cardRule = el('div', 'rule');
  const cardTag = el('div', 'new-tag', 'New entry');
  const cardName = el('h2', 'card-name');
  const cardEp = el('div', 'card-ep');
  const cardOrigin = el('div', 'label card-origin');
  const cardDesc = el('p', 'card-desc');
  const cardBeh = el('p', 'card-txt');
  const cardSur = el('p', 'card-txt');
  const cardThreat = el('div', 'card-threat');
  const cardFlash = el('div', 'card-flash');
  const blk = (lbl, p) => {
    const d = el('div', 'card-blk');
    d.append(el('span', 'label', lbl), p);
    return d;
  };
  card.append(cardFlash, cardRule, cardTag, cardName, cardEp, cardOrigin, cardDesc, blk('How it hunts', cardBeh), blk('Survive', cardSur), cardThreat);

  // ================================================================ JOURNAL
  const journal = screen('journal');
  const jBox = el('div', 'j-box');
  const jHead = el('header', 'j-head');
  const jCount = el('span', 'label');
  jHead.append(el('h2', 'h-serif', 'Journal'), jCount, el('span', 'label hint', 'Tab to close'));
  const jList = el('div', 'j-list');
  jBox.append(jHead, jList);
  journal.appendChild(jBox);

  function renderJournal() {
    jList.textContent = '';
    let n = 0;
    for (const c of CREATURES) {
      const known = identified.has(c.id);
      if (known) n++;
      const e = el('article', 'j-entry' + (known ? '' : ' unknown'));
      if (known) {
        e.style.setProperty('--accent', c.accent);
        const h = el('div', 'j-top');
        h.append(el('h3', 'j-name', c.name), pips(c.threat, 'pips sm'));
        const bh = el('p', 'j-txt');
        bh.append(el('b', '', 'Hunts: '), document.createTextNode(c.behavior));
        const sv = el('p', 'j-txt');
        sv.append(el('b', '', 'Survive: '), document.createTextNode(c.survival));
        e.append(h, el('div', 'j-ep', c.epithet), el('div', 'label', c.origin), el('p', 'j-txt', c.description), bh, sv);
      } else {
        const h = el('div', 'j-top');
        h.append(el('h3', 'j-name', '???'));
        e.append(h, el('div', 'j-ep', 'Unidentified'), el('p', 'j-txt dim', 'Shine your light on it to learn what it is.'));
      }
      jList.appendChild(e);
    }
    jCount.textContent = `${n} / 12 identified`;
  }
  function setJournal(v) {
    journalOn = !!v;
    if (journalOn) {
      renderJournal();
      jList.scrollTop = 0;
    }
    setOn(journal, journalOn);
    audio()?.play?.('ui_click');
  }
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Tab' || e.key === 'Tab') {
      // Only claim Tab while the journal is open or can be toggled; elsewhere (pause, menus,
      // death/win screens) leave it alone so keyboard focus can move.
      if (journalOn || (hudOn && ctx.state === 'playing')) {
        e.preventDefault();
        if (e.repeat) return;
        if (journalOn || ctx.state === 'playing') setJournal(!journalOn);
      }
    } else if (journalOn && (e.code === 'ArrowDown' || e.code === 'ArrowUp')) {
      jList.scrollTop += e.code === 'ArrowDown' ? 90 : -90;
    }
  });

  // ================================================================ PAUSE
  const pause = screen('pause');
  const pBox = el('div', 'p-box panel');
  pBox.append(el('h2', 'h-serif', 'Paused'), el('p', 'sub', 'The woods wait.'));
  const pSet = el('div', 'p-set');
  pSet.append(qualityField(), sensField(), volField());
  const pBtns = el('div', 'p-btns');
  pBtns.append(
    button('Resume', 'btn-lg', () => bus.emit('ui:resume')),
    button('Restart', '', () => bus.emit('ui:restart')),
    button('Main menu', 'btn-ghost', () => bus.emit('ui:menu'))
  );
  pBox.append(pSet, pBtns);
  pause.appendChild(pBox);

  // ================================================================ END SCREENS
  const death = screen('end death');
  const dBox = el('div', 'end-box');
  const dHead = el('div', 'end-head', 'You were taken');
  const dBy = el('div', 'end-by');
  const dEp = el('div', 'end-ep');
  const dLore = el('p', 'end-lore');
  const dStats = el('div', 'stats');
  const dBtns = el('div', 'end-btns');
  dBtns.append(button('Try again', 'btn-lg', () => bus.emit('ui:restart')), button('Main menu', 'btn-ghost', () => bus.emit('ui:menu')));
  dBox.append(dHead, dBy, dEp, dLore, dStats, dBtns);
  death.appendChild(dBox);

  const win = screen('end win');
  const wBox = el('div', 'end-box');
  const wStats = el('div', 'stats');
  const wBtns = el('div', 'end-btns');
  wBtns.append(button('Play again', 'btn-lg', () => bus.emit('ui:restart')), button('Main menu', 'btn-ghost', () => bus.emit('ui:menu')));
  wBox.append(el('div', 'end-head', 'Dawn'), el('p', 'end-lore', 'The wardstones hold. Blackbriar sleeps.'), wStats, wBtns);
  win.appendChild(wBox);

  function fillStats(target, stats = {}) {
    target.textContent = '';
    const rows = [
      ['Time survived', fmtTime(stats.time)],
      ['Wardstones lit', `${stats.wardstones ?? 0} / 5`],
      ['Creatures identified', `${stats.identified ?? identified.size}`],
    ];
    for (const [k, v] of rows) {
      const r = el('div', 'stat-row');
      r.append(el('span', 'label', k), el('span', 'stat-v', v));
      target.appendChild(r);
    }
  }

  // ================================================================ API
  function hideAllOverlays() {
    setOn(pause, false);
    setOn(card, false);
    setOn(death, false);
    setOn(win, false);
    journalOn = false;
    setOn(journal, false);
  }

  // cached HUD values
  const last = {
    obj: null,
    prompt: undefined,
    prog: undefined,
    batSeg: -1,
    batLow: null,
    batOn: null,
    spares: -1,
    stam: -1,
    stamShow: null,
    rocks: -1,
    sling: null,
    eye: '',
    heading: NaN,
  };
  const _f = { x: 0, z: 1 };

  function heading() {
    const p = ctx.player;
    if (!p) return null;
    const f = p.forward;
    if (f && (f.x || f.z)) {
      _f.x = f.x;
      _f.z = f.z;
    } else if (typeof p.yaw === 'number') {
      _f.x = Math.sin(p.yaw);
      _f.z = Math.cos(p.yaw);
    } else return null;
    // compass bearing: N = -Z, E = +X
    return Math.atan2(_f.x, -_f.z);
  }

  function placeCompass(h) {
    const half = compass.clientWidth / 2 || 200;
    const pxPerRad = (half * 2) / ((COMPASS_SPAN * Math.PI) / 180);
    for (const it of compassItems) {
      const rel = wrapPi(it.rad - h);
      const vis = Math.abs(rel) < (COMPASS_SPAN / 2) * (Math.PI / 180);
      const op = Math.round(Math.max(0.15, 1 - Math.abs(rel) / 1.4) * 20) / 20;
      const v = vis ? `translateX(${(half + rel * pxPerRad).toFixed(0)}px)` : '';
      const key = vis ? v + op : '';
      if (key !== it.last) {
        it.last = key;
        it.el.style.transform = v;
        it.el.style.visibility = vis ? 'visible' : 'hidden';
        if (vis) it.el.style.opacity = String(op);
      }
    }
    const ws = ctx.world?.wardstones;
    const pp = ctx.player?.pos;
    if (ws && pp) {
      ensureRunes(ws.length);
      for (let i = 0; i < ws.length; i++) {
        const m = runeMarks[i];
        const w = ws[i];
        if (w.lit || !w.pos) {
          if (m.vis) {
            m.vis = false;
            m.el.style.display = 'none';
          }
          continue;
        }
        const b = Math.atan2(w.pos.x - pp.x, -(w.pos.z - pp.z));
        const rel = wrapPi(b - h);
        const edge = (COMPASS_SPAN / 2) * (Math.PI / 180);
        // clamp to strip edge so unlit stones are always indicated
        const clamped = Math.max(-edge, Math.min(edge, rel));
        const off = Math.abs(rel) > edge;
        const v = `translateX(${(half + clamped * pxPerRad).toFixed(1)}px)`;
        if (!m.vis) {
          m.vis = true;
          m.el.style.display = '';
        }
        if (v !== m.last) {
          m.last = v;
          m.el.style.transform = v;
        }
        m.el.classList.toggle('edge', off);
      }
    }
  }

  const ui = {
    get journalOpen() {
      return journalOn;
    },
    showMenu() {
      hudOn = false;
      hideAllOverlays();
      setOn(hud, false);
      setOn(menu, true);
      showPage('title');
      syncSelection();
      syncAll();
    },
    showHUD() {
      hudOn = true;
      setOn(menu, false);
      setOn(hud, true);
      setOn(death, false);
      setOn(win, false);
      setOn(pause, false);
      last.heading = NaN;
    },
    hideHUD() {
      hudOn = false;
      setOn(hud, false);
      setOn(card, false);
      journalOn = false;
      setOn(journal, false);
    },
    showPause() {
      journalOn = false;
      setOn(journal, false);
      syncAll();
      setOn(pause, true);
    },
    hidePause() {
      setOn(pause, false);
    },
    showDeath(def, stats) {
      const d = def || {};
      hudOn = false;
      setOn(hud, false);
      setOn(card, false);
      setOn(pause, false);
      journalOn = false;
      setOn(journal, false);
      death.style.setProperty('--accent', d.accent || '#8a1c1c');
      dBy.textContent = d.name ? `by the ${d.name.replace(/^The /, '')}` : '';
      dEp.textContent = d.epithet || '';
      dLore.textContent = firstSentence(d.description);
      fillStats(dStats, stats);
      death.classList.remove('on');
      void death.offsetWidth; // restart the fade-in transition
      setOn(death, true);
    },
    showWin(stats) {
      hudOn = false;
      setOn(hud, false);
      setOn(card, false);
      setOn(pause, false);
      journalOn = false;
      setOn(journal, false);
      fillStats(wStats, stats);
      win.classList.remove('on');
      void win.offsetWidth;
      setOn(win, true);
    },
    showCreatureCard(def, { firstTime = false } = {}) {
      if (!def) return;
      card.style.setProperty('--accent', def.accent || '#999');
      cardName.textContent = def.name;
      cardEp.textContent = def.epithet;
      cardOrigin.textContent = def.origin;
      cardDesc.textContent = def.description;
      cardBeh.textContent = def.behavior;
      cardSur.textContent = def.survival;
      cardThreat.textContent = '';
      cardThreat.append(el('span', 'label', 'Threat'), pips(def.threat));
      card.classList.toggle('first', !!firstTime);
      cardFlash.classList.remove('go');
      if (firstTime) {
        void cardFlash.offsetWidth;
        cardFlash.classList.add('go');
      }
      setOn(card, true);
    },
    hideCreatureCard() {
      setOn(card, false);
    },
    setObjective(text) {
      if (text === last.obj) return;
      last.obj = text;
      objText.textContent = text ?? '';
      objective.style.visibility = text ? 'visible' : 'hidden';
    },
    setPrompt(text) {
      const t = text || null;
      if (t === last.prompt) return;
      last.prompt = t;
      promptText.textContent = t || '';
      promptWrap.classList.toggle('show', !!t);
    },
    setProgress(p) {
      const v = p == null ? null : Math.max(0, Math.min(1, p));
      const key = v == null ? null : Math.round(v * 200) / 200;
      if (key === last.prog) return;
      last.prog = key;
      promptWrap.classList.toggle('prog', v != null);
      if (v != null) ringFg.style.strokeDashoffset = String(RING_C * (1 - v));
    },
    toast(text, seconds = 3) {
      if (!text) return;
      const t = el('div', 'toast', text);
      toasts.appendChild(t);
      while (toasts.children.length > 4) toasts.firstChild.remove();
      requestAnimationFrame(() => t.classList.add('in'));
      setTimeout(() => {
        t.classList.remove('in');
        t.classList.add('out');
        setTimeout(() => t.remove(), 700);
      }, Math.max(0.5, seconds) * 1000);
    },
    markIdentified(id) {
      if (!id || identified.has(id)) return;
      identified.add(id);
      try {
        localStorage.setItem(STORE_ID, JSON.stringify([...identified]));
      } catch (e) {
        /* ignore */
      }
      if (journalOn) renderJournal();
      const def = CREATURE_BY_ID[id];
      if (def) ui.toast(`Journal updated: ${def.name}`, 3.5);
    },
    update(dt) {
      if (!hudOn) return;
      const p = ctx.player;
      if (!p) return;

      // compass
      const h = heading();
      if (h != null) {
        placeCompass(h);
        last.heading = h;
      }

      // flashlight
      const fl = p.flashlight;
      if (fl) {
        const b = Math.max(0, Math.min(1, fl.battery ?? 0));
        const on = !!fl.on;
        const seg = Math.ceil(b * SEGMENTS - 1e-6);
        const low = b < 0.15;
        if (seg !== last.batSeg) {
          last.batSeg = seg;
          for (let i = 0; i < SEGMENTS; i++) segEls[i].classList.toggle('f', i < seg);
        }
        if (low !== last.batLow) {
          last.batLow = low;
          light.classList.toggle('low', low);
        }
        if (on !== last.batOn) {
          last.batOn = on;
          light.classList.toggle('off', !on);
          lightState.textContent = on ? '' : 'Off';
        }
      }

      const inv = p.inventory;
      if (inv) {
        if (inv.batteries !== last.spares) {
          last.spares = inv.batteries;
          sparesN.textContent = String(inv.batteries ?? 0);
          spares.classList.toggle('none', !inv.batteries);
        }
        if (inv.rocks !== last.rocks) {
          last.rocks = inv.rocks;
          rocksN.textContent = String(inv.rocks ?? 0);
          rocks.classList.toggle('none', !inv.rocks);
        }
        const hs = !!inv.hasSlingshot;
        if (hs !== last.sling) {
          last.sling = hs;
          sling.style.display = hs ? '' : 'none';
        }
      }

      // stamina (visible only when not full)
      const st = Math.max(0, Math.min(1, p.stamina ?? 1));
      const sk = Math.round(st * 100);
      if (sk !== last.stam) {
        last.stam = sk;
        staminaFill.style.transform = `scaleX(${st.toFixed(3)})`;
        const show = st < 0.995;
        if (show !== last.stamShow) {
          last.stamShow = show;
          stamina.classList.toggle('show', show);
        }
        stamina.classList.toggle('low', st < 0.2);
      }

      // eye
      const key = p.hidden ? 'hidden' : p.isCrouching ? 'crouch' : 'exposed';
      if (key !== last.eye) {
        last.eye = key;
        eye.classList.toggle('hidden', key === 'hidden');
        eye.classList.toggle('crouch', key === 'crouch');
        eyeLbl.textContent = key === 'hidden' ? 'Hidden' : key === 'crouch' ? 'Crouched' : 'Exposed';
      }
    },
  };

  syncSelection();
  syncAll();
  ui.setObjective('');
  return ui;
}
