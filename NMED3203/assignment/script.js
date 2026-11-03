/* =====================================================================
   Running Out — Agency × Possibility
   ---------------------------------------------------------------------
   AGENCY:      every stamp the participant makes permanently changes
                the canvas  →  see stamp()
   POSSIBILITY: every stamp also removes a possibility (a use, then a
                whole tool, then the ability to act at all)
                →  see canAct(), spend(), sizeFor()
   ===================================================================== */

/* ---------------------------------------------------------------------
   KNOBS — every rule and number lives here. Change these for live edits.
   --------------------------------------------------------------------- */
const knobs = {
  tools: [
    { id: "circle",   label: "Circle",   key: "1", uses: 6, color: "#2b5f75" },
    { id: "square",   label: "Square",   key: "2", uses: 6, color: "#b5452f" },
    { id: "triangle", label: "Triangle", key: "3", uses: 6, color: "#c99a2e" },
    { id: "line",     label: "Line",     key: "4", uses: 6, color: "#1f2328" },
  ],

  baseSize: 90,         // px size of a stamp when the tool is fresh
  shrinkWithUse: true,  // POSSIBILITY: stamps get smaller as a tool runs out
  minSizeRatio: 0.3,    // size of the last stamp, relative to the first

  sharedCost: 0,        // POSSIBILITY: uses taken from EVERY OTHER tool per stamp (0 = off)
  refillMs: 0,          // ms until a used-up tool comes back (0 = never)

  rotationStep: 17,     // degrees each new stamp rotates by (stamp count × step)
  cursorStep: 0.04,     // keyboard cursor move per arrow press (fraction of canvas)
};

/* ---------------------------------------------------------------------
   STATE
   --------------------------------------------------------------------- */
const state = {
  uses: {},         // toolId → uses left
  selected: null,   // toolId currently chosen
  marks: [],        // every stamp made: { tool, x, y, size, rot } (x, y are 0–1)
  cursor: { x: 0.5, y: 0.5 },
  showCursor: false,
  finished: false,
};

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
const stage = canvas.parentElement;
const toolbar = document.getElementById("toolbar");
const statusEl = document.getElementById("status");
const refillTimers = {}; // toolId → pending refill timer

const toolById = (id) => knobs.tools.find((t) => t.id === id);

/* ---------------------------------------------------------------------
   RULES
   --------------------------------------------------------------------- */

// POSSIBILITY: what the system allows right now
function canAct(toolId) {
  return !state.finished && state.uses[toolId] > 0;
}

// POSSIBILITY: the fewer uses left, the smaller the mark you can make
function sizeFor(toolId) {
  if (!knobs.shrinkWithUse) return knobs.baseSize;
  const tool = toolById(toolId);
  const ratio = state.uses[toolId] / tool.uses; // 1 = fresh, near 0 = almost gone
  return knobs.baseSize * (knobs.minSizeRatio + (1 - knobs.minSizeRatio) * ratio);
}

// AGENCY: the participant's action changes the system (adds a permanent mark)
function stamp(x, y) {
  const id = state.selected;
  if (!id || !canAct(id)) {
    refuse();
    return;
  }

  state.marks.push({
    tool: id,
    x, y,
    size: sizeFor(id),
    rot: state.marks.length * knobs.rotationStep,
  });

  spend(id);
  render();
}

// POSSIBILITY: acting costs something
function spend(id) {
  state.uses[id] -= 1;

  if (knobs.sharedCost > 0) {
    for (const t of knobs.tools) {
      if (t.id !== id) state.uses[t.id] = Math.max(0, state.uses[t.id] - knobs.sharedCost);
    }
  }

  for (const t of knobs.tools) {
    if (state.uses[t.id] === 0) scheduleRefill(t.id);
  }

  // If the chosen tool is gone, move to the next one that still has uses
  if (state.uses[id] === 0) {
    const next = knobs.tools.find((t) => state.uses[t.id] > 0);
    state.selected = next ? next.id : null;
  }

  const left = state.selected ? state.uses[state.selected] : 0;
  if (!state.selected) {
    state.finished = true;
    say("No possibilities left. Your picture is finished. Press R to start again.");
  } else if (state.uses[id] === 0) {
    say(`${toolById(id).label} is used up. Switched to ${toolById(state.selected).label} (${left} left).`);
  } else {
    say(`${toolById(id).label} stamped. ${state.uses[id]} left.`);
  }
  renderToolbar();
}

function scheduleRefill(id) {
  if (knobs.refillMs <= 0 || refillTimers[id]) return;
  refillTimers[id] = setTimeout(() => {
    refillTimers[id] = null;
    state.uses[id] = toolById(id).uses;
    state.finished = false;
    if (!state.selected) state.selected = id;
    say(`${toolById(id).label} came back.`);
    renderToolbar();
    render();
  }, knobs.refillMs);
}

function refuse() {
  say(state.finished
    ? "Nothing left to stamp with. Press R to start again."
    : "That tool is used up. Choose another one.");
  stage.classList.remove("shake");
  void stage.offsetWidth; // restart the animation
  stage.classList.add("shake");
}

function selectTool(id) {
  if (!toolById(id)) return;
  if (state.uses[id] <= 0) { refuse(); return; }
  state.selected = id;
  say(`${toolById(id).label} selected. ${state.uses[id]} left.`);
  renderToolbar();
}

function reset() {
  for (const id in refillTimers) { clearTimeout(refillTimers[id]); refillTimers[id] = null; }
  for (const t of knobs.tools) state.uses[t.id] = t.uses;
  state.selected = knobs.tools[0].id;
  state.marks = [];
  state.finished = false;
  say("Choose a tool and stamp. Each one runs out.");
  renderToolbar();
  render();
}

/* ---------------------------------------------------------------------
   DRAWING
   --------------------------------------------------------------------- */
function drawShape(toolId, cx, cy, size, rotDeg, color, alpha = 1) {
  const r = size / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotDeg * Math.PI) / 180);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(3, size / 12);
  ctx.lineCap = "round";

  ctx.beginPath();
  if (toolId === "circle") {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (toolId === "square") {
    ctx.rect(-r * 0.85, -r * 0.85, r * 1.7, r * 1.7);
    ctx.fill();
  } else if (toolId === "triangle") {
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.87, r * 0.5);
    ctx.lineTo(-r * 0.87, r * 0.5);
    ctx.closePath();
    ctx.fill();
  } else if (toolId === "line") {
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
  }
  ctx.restore();
}

function render() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  ctx.clearRect(0, 0, w, h);

  for (const m of state.marks) {
    drawShape(m.tool, m.x * w, m.y * h, m.size, m.rot, toolById(m.tool).color, 0.85);
  }

  // Keyboard cursor: a preview of the next stamp at its current (shrinking) size
  if (state.showCursor && state.selected) {
    const cx = state.cursor.x * w;
    const cy = state.cursor.y * h;
    drawShape(state.selected, cx, cy, sizeFor(state.selected),
      state.marks.length * knobs.rotationStep, toolById(state.selected).color, 0.25);
    ctx.strokeStyle = "#1f2328";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx - 10, cy); ctx.lineTo(cx + 10, cy);
    ctx.moveTo(cx, cy - 10); ctx.lineTo(cx, cy + 10);
    ctx.stroke();
  }

  canvas.classList.toggle("frozen", state.finished);
}

function shapeIcon(id, color) {
  const shapes = {
    circle: `<circle cx="14" cy="14" r="10" fill="${color}"/>`,
    square: `<rect x="5" y="5" width="18" height="18" fill="${color}"/>`,
    triangle: `<polygon points="14,3 25,23 3,23" fill="${color}"/>`,
    line: `<line x1="3" y1="14" x2="25" y2="14" stroke="${color}" stroke-width="4" stroke-linecap="round"/>`,
  };
  return `<svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">${shapes[id]}</svg>`;
}

function renderToolbar() {
  toolbar.innerHTML = "";
  for (const t of knobs.tools) {
    const left = state.uses[t.id];
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tool";
    btn.disabled = left <= 0;
    btn.setAttribute("aria-pressed", String(state.selected === t.id));
    btn.setAttribute("aria-label", `${t.label}, key ${t.key}, ${left} of ${t.uses} uses left`);
    btn.innerHTML = `
      ${shapeIcon(t.id, t.color)}
      <span>
        <span class="name">${t.label} <kbd>${t.key}</kbd></span>
        <span class="left">${left > 0 ? `${left} of ${t.uses} left` : "used up"}</span>
        <span class="pips" aria-hidden="true">${"●".repeat(left)}${"○".repeat(Math.max(0, t.uses - left))}</span>
      </span>`;
    btn.addEventListener("click", () => selectTool(t.id));
    toolbar.appendChild(btn);
  }
}

function say(text) {
  statusEl.textContent = text;
}

/* ---------------------------------------------------------------------
   INPUT — pointer, plus keyboard as the alternative input
   --------------------------------------------------------------------- */
canvas.addEventListener("pointerdown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width;
  const y = (e.clientY - rect.top) / rect.height;
  state.cursor = { x, y };
  state.showCursor = false;
  stamp(x, y);
});

document.addEventListener("keydown", (e) => {
  const tool = knobs.tools.find((t) => t.key === e.key);
  if (tool) { selectTool(tool.id); return; }

  const step = knobs.cursorStep;
  const moves = {
    ArrowLeft: [-step, 0], ArrowRight: [step, 0],
    ArrowUp: [0, -step], ArrowDown: [0, step],
  };
  if (moves[e.key]) {
    e.preventDefault();
    const [dx, dy] = moves[e.key];
    state.cursor.x = Math.min(1, Math.max(0, state.cursor.x + dx));
    state.cursor.y = Math.min(1, Math.max(0, state.cursor.y + dy));
    state.showCursor = true;
    render();
    return;
  }

  // Space/Enter stamp — unless a button has focus (then the button handles it)
  if ((e.key === " " || e.key === "Enter") && e.target.tagName !== "BUTTON") {
    e.preventDefault();
    state.showCursor = true;
    stamp(state.cursor.x, state.cursor.y);
    return;
  }

  if (e.key === "r" || e.key === "R") reset();
});

document.getElementById("restart").addEventListener("click", reset);

/* ---------------------------------------------------------------------
   CANVAS SIZE (sharp on retina screens, redraws on resize)
   --------------------------------------------------------------------- */
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  render();
}
window.addEventListener("resize", resize);

reset();
resize();
