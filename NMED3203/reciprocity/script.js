'use strict';

/* ==========================================================================
   DESIGN: every adjustable setting lives here.
   Positions are in "stage units": 1 unit = 45% of the smaller screen side.
   ========================================================================== */
const DESIGN = {
  historySize: 3,                 // completed interactions remembered (Condition B)
  motion: {
    followRate: 18,               // how quickly your own marker follows input
    startSpeed: 0.35,             // units/s that begin a movement
    stopSpeed: 0.18,              // below this you count as stopped
    settleMs: 240,                // stillness that completes a movement
    minDistance: 0.16,            // shorter movements are ignored
    minTurnGapMs: 150,            // guards against double-counting rapid input
    liveDirDistance: 0.14,        // distance before the live direction is known
    liveGraceMs: 140,
    intensityLow: 0.9,            // average speed below = gentle
    intensityHigh: 2.1            // average speed above = strong
  },
  keyboard: { speed: 0.9, fastSpeed: 2.4 },   // units/s (Shift = fast)
  rules: {
    reflectionRate: 14,                        // tight, immediate following
    adaptRate: [3.2, 6, 10],                   // response timing by last intensity
    echoAmplitude: [0.12, 0.22, 0.36],         // drift in the direction of last turn
    repeatGain: 0.3,                           // Divergence (repeat): mirror holds back
    repeatRate: 2.2,
    changeRate: 8,                             // Divergence (change): mirror carries old pattern
    changeOffset: 0.45,
    patternTolerance: 1                        // 45-degree sectors that count as "same direction"
  },
  visual: {
    stageScale: 0.45, size: 0.16, samples: 96, morphRate: 5, trail: 0.16, glow: 26, margin: 0.12,
    states: {
      reflection: { sides: 0, hue: 190, size: 1,    spin: 0.15, glyph: '○', name: 'Reflection', note: 'Following you.' },
      adaptation: { sides: 6, hue: 265, size: 1.08, spin: 0.35, glyph: '⬡', name: 'Adaptation', note: 'Shaped by your last movement.' },
      repeat:     { sides: 3, hue: 345, size: 0.78, spin: -0.9, glyph: '△', name: 'Divergence', note: 'Holding back from your repeat.' },
      change:     { sides: 4, hue: 345, size: 1.18, spin: 1.1,  glyph: '◇', name: 'Divergence', note: 'Carrying your old pattern.' }
    }
  }
};

const DIRS = Array.from({ length: 8 }, (_, i) => ({ x: Math.cos(i * Math.PI / 4), y: Math.sin(i * Math.PI / 4) }));
const ARROWS = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
const DIR_NAMES = ['right', 'down-right', 'down', 'down-left', 'left', 'up-left', 'up', 'up-right'];
const INTENSITY = ['gentle', 'medium', 'strong'];
const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ==========================================================================
   STATE
   ========================================================================== */
const state = {
  condition: 'A', paused: true,
  you: { x: 0, y: 0 }, target: { x: 0, y: 0 }, prev: { x: 0, y: 0 },
  mirror: { x: 0, y: 0 }, pure: { x: 0, y: 0 },
  seg: null,            // movement in progress (not yet completed)
  history: [],          // completed interactions, newest first: {dir, intensity}
  lastTurnAt: 0, activity: 0, snap: true, keys: {},
  key: 'reflection', rule: null,
  hue: 190, size: 1, spin: 0.15, rot: 0, shape: null,
  raf: 0, last: 0, view: { w: 0, h: 0, S: 1, bx: 1, by: 1 }
};

const sector = (dx, dy) => ((Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) % 8) + 8) % 8;
const angDiff = (a, b) => { const d = Math.abs(a - b) % 8; return Math.min(d, 8 - d); };
const $ = (s) => document.querySelector(s);

/* ==========================================================================
   INPUT: pointer, touch, keyboard, controls, and turn detection
   ========================================================================== */
const input = {
  setTarget(cx, cy) {
    const v = state.view;
    state.target.x = (cx - v.w / 2) / v.S;
    state.target.y = (cy - v.h / 2) / v.S;
    input.clamp(state.target);
    if (state.snap) { Object.assign(state.you, state.target); Object.assign(state.prev, state.target); state.snap = false; }
  },
  clamp(p) {
    const v = state.view;
    p.x = Math.max(-v.bx, Math.min(v.bx, p.x));
    p.y = Math.max(-v.by, Math.min(v.by, p.y));
  },
  interrupt() { state.seg = null; state.snap = true; },   // interrupted movements never count

  update(dt, now) {
    const M = DESIGN.motion, K = DESIGN.keyboard, k = state.keys;
    const ax = (k.right ? 1 : 0) - (k.left ? 1 : 0), ay = (k.down ? 1 : 0) - (k.up ? 1 : 0);
    if (ax || ay) {
      const sp = (k.fast ? K.fastSpeed : K.speed) / Math.hypot(ax, ay);
      state.target.x += ax * sp * dt; state.target.y += ay * sp * dt;
    }
    input.clamp(state.target);
    const a = 1 - Math.exp(-M.followRate * dt), y = state.you;
    y.x += (state.target.x - y.x) * a; y.y += (state.target.y - y.y) * a;

    const step = Math.hypot(y.x - state.prev.x, y.y - state.prev.y), speed = step / dt;
    if (!state.seg && speed > M.startSpeed) {
      state.seg = { start: { x: state.prev.x, y: state.prev.y }, t0: now, lastMove: now, path: 0, dir: null };
    }
    const s = state.seg;
    if (s) {
      s.path += step;
      if (speed > M.stopSpeed) s.lastMove = now;
      const dx = y.x - s.start.x, dy = y.y - s.start.y;
      if (Math.hypot(dx, dy) >= M.liveDirDistance) s.dir = sector(dx, dy);
      if (now - s.lastMove >= M.settleMs) input.complete(s, now);
    }
    state.prev.x = y.x; state.prev.y = y.y;
  },

  complete(s, now) {
    const M = DESIGN.motion;
    state.seg = null;
    const dx = state.you.x - s.start.x, dy = state.you.y - s.start.y;
    if (Math.hypot(dx, dy) < M.minDistance || now - state.lastTurnAt < M.minTurnGapMs) return;
    const dur = Math.max(0.12, (s.lastMove - s.t0) / 1000), avg = s.path / dur;
    const entry = { dir: sector(dx, dy), intensity: avg < M.intensityLow ? 0 : avg < M.intensityHigh ? 1 : 2 };
    state.lastTurnAt = now;
    if (state.condition === 'B') {                 // Condition A keeps no history
      state.history.unshift(entry);
      state.history.length = Math.min(state.history.length, DESIGN.historySize);
      output.memory();
    }
    output.say(`Turn completed: ${DIR_NAMES[entry.dir]}, ${INTENSITY[entry.intensity]}.`);
  },

  setPaused(p) {
    state.paused = p;
    input.interrupt(); state.keys = {};
    $('#btn-pause').textContent = p ? 'Resume' : 'Pause';
    $('#paused-badge').hidden = !p || !$('#intro').hidden;
    if (p) { cancelAnimationFrame(state.raf); state.raf = 0; output.render(0.016, performance.now()); }
    else if (!state.raf) { state.last = performance.now(); state.raf = requestAnimationFrame(frame); }
  },
  togglePause() { if (!$('#intro').hidden) input.begin(); else input.setPaused(!state.paused); },
  begin() { $('#intro').hidden = true; input.setPaused(false); },
  help() { input.setPaused(true); $('#intro').hidden = false; $('#paused-badge').hidden = true; $('#btn-begin').focus(); },

  reset() {                                        // neutral position, empty history
    for (const p of [state.you, state.target, state.prev, state.mirror, state.pure]) { p.x = 0; p.y = 0; }
    state.history = []; state.seg = null; state.activity = 0; state.snap = true; state.keys = {};
    state.key = 'reflection';
    output.hud(); output.memory(); output.say('Reset. The mirror is in its neutral position.');
    if (state.paused) output.render(0.016, performance.now());
  },
  setCondition(c) {
    state.condition = c;
    document.querySelectorAll('[data-cond]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.cond === c)));
    input.reset();
    output.say(c === 'A' ? 'Condition A: immediate reflection.' : 'Condition B: history-based reflection.');
  }
};

const KEYMAP = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };

function bindInput() {
  const cv = $('#stage');
  cv.addEventListener('pointermove', e => { if (!state.paused) input.setTarget(e.clientX, e.clientY); });
  cv.addEventListener('pointerdown', e => {
    if (state.paused) return;
    state.snap = true; input.setTarget(e.clientX, e.clientY);
    try { cv.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  });
  cv.addEventListener('pointercancel', input.interrupt);
  cv.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') input.interrupt(); });

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYMAP[key]) {
      e.preventDefault();
      if (!state.paused) { state.keys[KEYMAP[key]] = true; state.keys.fast = e.shiftKey; }
    } else if (key === 'p') input.togglePause();
    else if (key === 'r' && $('#intro').hidden) input.reset();
    else if ((key === '1' || key === '2') && $('#intro').hidden) input.setCondition(key === '1' ? 'A' : 'B');
  });
  document.addEventListener('keyup', e => {
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (KEYMAP[key]) { state.keys[KEYMAP[key]] = false; state.keys.fast = e.shiftKey; }
  });
  window.addEventListener('blur', () => { state.keys = {}; input.interrupt(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) { state.keys = {}; input.interrupt(); } });

  $('#btn-pause').addEventListener('click', input.togglePause);
  $('#btn-reset').addEventListener('click', input.reset);
  $('#btn-help').addEventListener('click', input.help);
  $('#btn-begin').addEventListener('click', input.begin);
  document.querySelectorAll('[data-cond]').forEach(b => b.addEventListener('click', () => input.setCondition(b.dataset.cond)));
}

/* ==========================================================================
   RULE: current input (+ history in Condition B) -> response state
   ========================================================================== */
const rule = {
  // Established pattern: two of the remembered turns went in (nearly) the same direction.
  findPattern() {
    const h = state.history, tol = DESIGN.rules.patternTolerance;
    for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) {
      if (h[i] && h[j] && angDiff(h[i].dir, h[j].dir) <= tol) return { dir: h[i].dir };
    }
    return null;
  },

  evaluate(now) {
    const R = DESIGN.rules, h = state.history;
    let r = { key: 'reflection', gain: 1, rate: R.reflectionRate, ox: 0, oy: 0 };   // Condition A, or empty history
    if (state.condition === 'B' && h.length) {
      const last = h[0], v = DIRS[last.dir], s = state.seg;
      const live = s && s.dir !== null && now - s.lastMove < DESIGN.motion.liveGraceMs;
      const pat = rule.findPattern();
      if (pat && live) {
        if (angDiff(s.dir, pat.dir) <= R.patternTolerance) {                          // repeating a pattern
          r = { key: 'repeat', gain: R.repeatGain, rate: R.repeatRate, ox: 0, oy: 0 };
        } else {                                                                      // changing a pattern
          const p = DIRS[pat.dir];
          r = { key: 'change', gain: 1, rate: R.changeRate, ox: p.x * R.changeOffset, oy: p.y * R.changeOffset };
        }
      } else {                                                                        // adapting to last turn
        const a = R.echoAmplitude[last.intensity];
        r = { key: 'adaptation', gain: 1, rate: R.adaptRate[last.intensity], ox: v.x * a, oy: v.y * a };
      }
    }
    state.rule = r;
    return r;
  },

  apply(dt, now) {
    const r = state.rule, s = state.seg;
    const live = s && now - s.lastMove < DESIGN.motion.liveGraceMs ? 1 : 0;
    state.activity += (live - state.activity) * (1 - Math.exp(-6 * dt));
    state.pure.x = -state.you.x; state.pure.y = state.you.y;                         // plain reflection
    const tx = state.pure.x * r.gain + r.ox * state.activity;
    const ty = state.pure.y * r.gain + r.oy * state.activity;
    const a = 1 - Math.exp(-r.rate * dt);
    state.mirror.x += (tx - state.mirror.x) * a; state.mirror.y += (ty - state.mirror.y) * a;
  }
};

/* ==========================================================================
   OUTPUT: canvas drawing and interface readouts
   ========================================================================== */
const PROFILES = {};
function buildProfiles() {
  const N = DESIGN.visual.samples;
  for (const st of Object.values(DESIGN.visual.states)) {
    if (PROFILES[st.sides]) continue;
    PROFILES[st.sides] = Array.from({ length: N }, (_, i) => {
      if (!st.sides) return 1;
      const seg = 2 * Math.PI / st.sides, th = i / N * 2 * Math.PI;
      return Math.cos(Math.PI / st.sides) / Math.cos(((th % seg) + seg) % seg - seg / 2);
    });
  }
  state.shape = PROFILES[0].slice();
}

const output = {
  ctx: null,
  resize() {
    const cv = $('#stage'), dpr = Math.min(2, window.devicePixelRatio || 1), v = state.view;
    v.w = innerWidth; v.h = innerHeight;
    cv.width = v.w * dpr; cv.height = v.h * dpr;
    output.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    v.S = Math.min(v.w, v.h) * DESIGN.visual.stageScale;
    v.bx = v.w / (2 * v.S) - DESIGN.visual.margin;
    v.by = v.h / (2 * v.S) - DESIGN.visual.margin;
    output.ctx.fillStyle = '#04050a'; output.ctx.fillRect(0, 0, v.w, v.h);
    if (state.paused) output.render(0.016, performance.now());
  },
  say(msg) { $('#live').textContent = msg; },
  hud() {
    const st = DESIGN.visual.states[state.key];
    document.body.dataset.state = state.key;
    $('#glyph').textContent = st.glyph;
    $('#state-name').textContent = st.name;
    $('#state-note').textContent = st.note;
    output.say(`${st.name}. ${st.note}`);
  },
  memory() {
    document.querySelectorAll('.slot').forEach((el, i) => {
      const e = state.history[i];
      el.querySelector('.arrow').textContent = e ? ARROWS[e.dir] : '–';
      el.querySelectorAll('i').forEach((b, j) => b.classList.toggle('on', !!e && j <= e.intensity));
      el.setAttribute('aria-label', e ? `${i ? 'Earlier' : 'Latest'}: ${DIR_NAMES[e.dir]}, ${INTENSITY[e.intensity]}` : 'Empty');
    });
    $('#mem-label').textContent = state.condition === 'B' ? 'Memory: last 3 turns' : 'Memory: off';
  },

  render(dt, t) {
    const v = state.view, V = DESIGN.visual, c = V.states[state.key], ctx = output.ctx;
    const e = 1 - Math.exp(-V.morphRate * dt), tgt = PROFILES[c.sides];
    for (let i = 0; i < tgt.length; i++) state.shape[i] += (tgt[i] - state.shape[i]) * e;
    state.hue += (c.hue - state.hue) * e * 0.6;
    state.size += (c.size - state.size) * e;
    state.spin += (c.spin * (REDUCE ? 0.3 : 1) - state.spin) * e;
    state.rot += state.spin * dt;

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(4,5,9,${REDUCE ? 1 : V.trail})`;
    ctx.fillRect(0, 0, v.w, v.h);

    const grad = ctx.createLinearGradient(0, 0, 0, v.h);            // the mirror plane
    grad.addColorStop(0, 'rgba(160,190,255,0)'); grad.addColorStop(.5, 'rgba(160,190,255,.22)'); grad.addColorStop(1, 'rgba(160,190,255,0)');
    ctx.strokeStyle = grad; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(v.w / 2, 0); ctx.lineTo(v.w / 2, v.h); ctx.stroke();

    const P = p => [v.w / 2 + p.x * v.S, v.h / 2 + p.y * v.S];
    const [yx, yy] = P(state.you), [mx, my] = P(state.mirror), [gx, gy] = P(state.pure);

    ctx.strokeStyle = 'rgba(200,215,255,.09)'; ctx.setLineDash([2, 8]);
    ctx.beginPath(); ctx.moveTo(yx, yy); ctx.lineTo(mx, my); ctx.stroke();
    if (state.key !== 'reflection') {                                // where a plain reflection would be
      ctx.strokeStyle = 'rgba(220,230,255,.35)'; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.arc(gx, gy, 7, 0, 7); ctx.stroke();
    }
    ctx.setLineDash([]);

    ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.2;   // you
    ctx.beginPath(); ctx.arc(yx, yy, 8, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.arc(yx, yy, 2, 0, 7); ctx.fill();

    const R = v.S * V.size * state.size * (1 + 0.05 * Math.sin(t / 900) + 0.12 * state.activity);
    const col = `hsl(${state.hue} 85% 68%)`;
    const poly = (r, rot) => {
      ctx.beginPath();
      const n = state.shape.length;
      for (let i = 0; i < n; i++) {
        const th = i / n * 2 * Math.PI + rot, rr = r * state.shape[i];
        const x = mx + Math.cos(th) * rr, y = my + Math.sin(th) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
    };
    ctx.shadowColor = col; ctx.shadowBlur = V.glow; ctx.strokeStyle = col; ctx.lineWidth = 2;
    poly(R, state.rot); ctx.stroke();
    ctx.shadowBlur = 0; ctx.fillStyle = `hsl(${state.hue} 85% 68% / .08)`; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = `hsl(${state.hue} 85% 68% / .6)`;
    poly(R * 0.45, -state.rot * 1.6); ctx.stroke();
    ctx.fillStyle = col; ctx.beginPath(); ctx.arc(mx, my, 3, 0, 7); ctx.fill();
  }
};

/* ==========================================================================
   LOOP + BOOT
   ========================================================================== */
function frame(now) {
  state.raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - state.last) / 1000) || 0.016;
  state.last = now;
  input.update(dt, now);
  const r = rule.evaluate(now);
  rule.apply(dt, now);
  if (r.key !== state.key) { state.key = r.key; output.hud(); }
  output.render(dt, now);
}

output.ctx = $('#stage').getContext('2d');
buildProfiles();
bindInput();
output.resize();
window.addEventListener('resize', output.resize);
output.hud(); output.memory();
output.render(0.016, performance.now());
$('#btn-begin').focus();
