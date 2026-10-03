/* Breathe Fresh 1.0.0 */
'use strict';

/* ---------- Utilities ---------- */

const STORAGE_KEY = 'breathe-fresh:data:v1';
const APP_ID = 'breathe-fresh';
const VERSION = 1;

const node = id => document.getElementById(id);

const escapeHTML = value => String(value ?? '').replace(
  /[&<>"']/g,
  character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[character])
);

const clone = value => JSON.parse(JSON.stringify(value));

const uid = () => globalThis.crypto?.randomUUID?.()
  ?? `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:` +
    String(total % 60).padStart(2, '0');
}

function dateText(timestamp) {
  return new Date(timestamp).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/* วันปฏิทินท้องถิ่น แปลงเป็นเลขวันสำหรับคำนวณ streak */
function dayNumber(timestamp) {
  const date = new Date(timestamp);
  return Math.floor(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ) / 86400000);
}

function fileDate() {
  const date = new Date();
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function notice(message) {
  node('notice').textContent = message;
  node('notice').hidden = false;
}

function reportError(error) {
  console.error(error);
  window.showAppFailure(error);
}

function downloadText(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

function requireNumber(value, min, max, label, integer = false) {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    (integer && !Number.isInteger(value))
  ) {
    throw new Error(`${label} ต้องอยู่ระหว่าง ${min}–${max}` +
      (integer ? ' และเป็นจำนวนเต็ม' : ''));
  }
  return value;
}

function requireText(value, max, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) {
    throw new Error(`${label} ต้องเป็นข้อความ 1–${max} ตัวอักษร`);
  }
  return value.trim();
}

/* ---------- Presets ---------- */

function phase(t, d, label, scale) {
  return { t, d, label, scale };
}

const PRESETS = [
  {
    id: 'box',
    name: 'Navy SEALs Box Breathing · 4-4-4-4',
    goal: 'สร้างสมาธิและความนิ่งเพื่อการตัดสินใจที่แม่นยำในภาวะกดดัน',
    phases: [
      phase('in', 4, 'หายใจเข้า', 1),
      phase('hold', 4, 'พักลมหายใจอย่างสบาย', 1),
      phase('out', 4, 'หายใจออก', .45),
      phase('hold', 4, 'พักลมหายใจอย่างสบาย', .45)
    ]
  },
  {
    id: 'sigh',
    name: 'Physiological Sigh',
    goal: 'บรรเทาความตึงเครียดฉับพลันและรีเซ็ตระบบหายใจอย่างรวดเร็ว',
    phases: [
      phase('in', 2, 'หายใจเข้าเบา ๆ', .85),
      phase('in', 1, 'สูดเข้าเพิ่มอีกเล็กน้อย', 1),
      phase('out', 6, 'ผ่อนลมหายใจออกตามสบาย', .45)
    ]
  },
  {
    id: '478',
    name: '4-7-8 Breathing The Sleep Transition',
    goal: 'ผ่อนคลายระบบประสาทลึกเพื่อเตรียมตัวเข้าสู่การนอนหลับ',
    phases: [
      phase('in', 4, 'หายใจเข้า', 1),
      phase('hold', 7, 'พักลมหายใจอย่างสบาย', 1),
      phase('out', 8, 'ค่อย ๆ หายใจออก', .45)
    ]
  },
  {
    id: 'coherent',
    name: 'Coherent Breathing · 5-5',
    goal: 'ปรับสมดุลระบบประสาทอัตโนมัติ ให้ระบบไหลเวียนโลหิตและการทำงานของอวัยวะภายในอยู่ในภาวะสมดุล',
    phases: [
      phase('in', 5, 'หายใจเข้าเบา ๆ', 1),
      phase('out', 5, 'หายใจออกเบา ๆ', .45)
    ]
  },
  {
    id: 'relax',
    name: 'Relaxing Breath · 4-6',
    goal: 'ลดความวิตกกังวลระหว่างวันและรักษาระดับอารมณ์ให้คงที่ ตัดวงจรความเครียด ช่วยลดการหลั่งฮอร์โมนคอร์ติซอล',
    phases: [
      phase('in', 4, 'หายใจเข้า', 1),
      phase('out', 6, 'ผ่อนลมหายใจออก', .45)
    ]
  },
  {
    id: 'nadi',
    name: 'Alternate Nostril',
    goal: 'เทคนิคดั้งเดิมจากโยคะบำบัด ช่วยตัดวงจรความคิดฟุ้งซ่านที่มักวิ่งวนไปเรื่องอดีตหรืออนาคต',
    phases: [
      phase('in', 4, 'ปิดขวา · หายใจเข้าทางซ้าย', 1),
      phase('out', 6, 'ปิดซ้าย · หายใจออกทางขวา', .45),
      phase('in', 4, 'หายใจเข้าทางขวา', 1),
      phase('out', 6, 'ปิดขวา · หายใจออกทางซ้าย', .45)
    ]
  }
];

const MOODS = ['ไม่ได้บันทึก', 'แย่มาก', 'ไม่ค่อยดี', 'เฉย ๆ', 'ดี', 'ดีมาก'];

const DEFAULT_SETTINGS = {
  sound: true,
  haptic: false,
  wake: true,
  askMood: true,
  theme: 'auto'
};

function emptyData() {
  return {
    app: APP_ID,
    schema: VERSION,
    logs: [],
    customPatterns: [],
    settings: { ...DEFAULT_SETTINGS },
    selectedId: 'box'
  };
}

/* ---------- Validate / normalize data ---------- */

function normalizeSettings(value) {
  const source = value && typeof value === 'object' ? value : {};
  const result = { ...DEFAULT_SETTINGS };

  for (const key of ['sound', 'haptic', 'wake', 'askMood']) {
    if (typeof source[key] === 'boolean') result[key] = source[key];
  }

  if (['auto', 'light', 'dark'].includes(source.theme)) {
    result.theme = source.theme;
  }
  return result;
}

function normalizePattern(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('รูปแบบหายใจไม่ถูกต้อง');
  }

  const id = requireText(value.id, 100, 'รหัสรูปแบบ');

  if (PRESETS.some(item => item.id === id)) {
    throw new Error('รหัสรูปแบบส่วนตัวซ้ำกับรูปแบบมาตรฐาน');
  }

  if (
    !Array.isArray(value.phases) ||
    value.phases.length < 2 ||
    value.phases.length > 64
  ) {
    throw new Error('รูปแบบหายใจต้องมี 2–64 ขั้นตอน');
  }

  const phases = value.phases.map(item => {
    if (!item || !['in', 'out', 'hold'].includes(item.t)) {
      throw new Error('ประเภทจังหวะหายใจไม่ถูกต้อง');
    }

    const d = requireNumber(
      item.d, .5, item.t === 'hold' ? 60 : 30, 'เวลาของจังหวะ'
    );

    const fallback = item.t === 'out' ? .45 : 1;
    const scale = item.scale === undefined
      ? fallback
      : requireNumber(item.scale, .3, 1, 'ขนาดวงกลม');

    return {
      t: item.t,
      d,
      label: requireText(
        item.label || (item.t === 'in' ? 'หายใจเข้า' :
          item.t === 'out' ? 'หายใจออก' : 'พักลมหายใจ'),
        120,
        'ชื่อจังหวะ'
      ),
      scale
    };
  });

  if (!phases.some(p => p.t === 'in') || !phases.some(p => p.t === 'out')) {
    throw new Error('ต้องมีทั้งจังหวะหายใจเข้าและหายใจออก');
  }

  /* ช่วง hold ใช้ขนาดจากขั้นตอนก่อนหน้า */
  let previousScale = .45;
  for (const item of phases) {
    if (item.t === 'hold') item.scale = previousScale;
    previousScale = item.scale;
  }

  return {
    id,
    name: requireText(value.name, 100, 'ชื่อรูปแบบ'),
    goal: typeof value.goal === 'string' ? value.goal.slice(0, 300) : '',
    phases
  };
}

function normalizeLog(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('รายการประวัติไม่ถูกต้อง');
  }

  const mood = value.mood ?? value.moodAfter ?? null;
  if (mood !== null) requireNumber(mood, 1, 5, 'คะแนนอารมณ์', true);

  return {
    id: requireText(value.id, 100, 'รหัสประวัติ'),
    ts: requireNumber(value.ts, 0, 8640000000000000, 'วันที่บันทึก'),
    patternId: typeof value.patternId === 'string'
      ? value.patternId.slice(0, 100) : '',
    patternName: requireText(value.patternName, 100, 'ชื่อในประวัติ'),
    seconds: requireNumber(value.seconds, 0, 86400, 'เวลาฝึก'),
    cycles: requireNumber(value.cycles ?? 0, 0, 100000, 'จำนวนรอบ', true),
    mood,
    completed: value.completed === true
  };
}

function uniqueById(items) {
  return [...new Map(items.map(item => [item.id, item])).values()];
}

function normalizeData(value) {
  if (!value || typeof value !== 'object') {
    throw new Error('ข้อมูลไม่ใช่ออบเจ็กต์ที่ถูกต้อง');
  }

  const isCurrent = value.app === APP_ID && value.schema === VERSION;
  const isLegacy = value.app === 'mindful-breathing-pwa' &&
    [1, 2].includes(value.schema);

  if (!isCurrent && !isLegacy) {
    throw new Error('ไม่รองรับชนิดหรือเวอร์ชันไฟล์สำรองนี้');
  }

  if (!Array.isArray(value.logs) || value.logs.length > 20000) {
    throw new Error('ประวัติต้องเป็นรายการ และไม่เกิน 20,000 รายการ');
  }

  const customs = value.customPatterns ?? [];
  if (!Array.isArray(customs) || customs.length > 200) {
    throw new Error('รูปแบบส่วนตัวต้องไม่เกิน 200 รูปแบบ');
  }

  const result = {
    app: APP_ID,
    schema: VERSION,
    logs: uniqueById(value.logs.map(normalizeLog)).sort((a, b) => a.ts - b.ts),
    customPatterns: uniqueById(customs.map(normalizePattern)),
    settings: normalizeSettings(value.settings),
    selectedId: typeof value.selectedId === 'string'
      ? value.selectedId : 'box'
  };

  const available = PRESETS.concat(result.customPatterns);
  if (!available.some(item => item.id === result.selectedId)) {
    result.selectedId = 'box';
  }

  return result;
}

/* ---------- Store: commit all data with one write ---------- */

let data;
let page = 'home';
let lastRecord = null;
let lastSaved = true;
let pendingImport = null;
let installPrompt = null;
let workerRegistration = null;
let reloadAfterUpdate = false;

const configuration = { mode: 'time', minutes: 5, cycles: 10 };

function loadData() {
  let raw;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    throw new Error('เบราว์เซอร์ไม่อนุญาตให้อ่านพื้นที่เก็บข้อมูลของแอป');
  }

  if (raw === null) return emptyData();

  try {
    return normalizeData(JSON.parse(raw));
  } catch (error) {
    throw new Error(
      'ข้อมูลที่เก็บไว้ไม่ผ่านการตรวจสอบ จึงยังไม่เขียนทับข้อมูลเดิม: ' +
      error.message
    );
  }
}

function commit(next) {
  const checked = normalizeData(next);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(checked));
  } catch {
    throw new Error(
      'บันทึกลงเครื่องไม่สำเร็จ อาจมีพื้นที่ไม่พอหรือถูกจำกัดสิทธิ์ ' +
      'อย่าปิดหน้าสรุปก่อนลองบันทึกใหม่'
    );
  }
  data = checked;
}

function allPatterns() {
  return PRESETS.concat(data.customPatterns);
}

function selectedPattern() {
  return allPatterns().find(item => item.id === data.selectedId) ?? PRESETS[0];
}

/* ---------- Audio / haptic / wake lock ---------- */

let audio = null;
let wakeLock = null;
let wakeTicket = 0;

function unlockAudio() {
  if (!data.settings.sound) return;
  try {
    const AudioType = window.AudioContext || window.webkitAudioContext;
    if (!AudioType) return;
    audio ??= new AudioType();
    audio.resume().catch(() => {});
  } catch {
    /* เสียงไม่พร้อมไม่ควรทำให้แอปหยุด */
  }
}

function cue(type) {
  if (data.settings.sound && audio?.state === 'running') {
    try {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const now = audio.currentTime;

      oscillator.frequency.value =
        type === 'in' ? 520 : type === 'out' ? 390 : 440;

      gain.gain.setValueAtTime(.0001, now);
      gain.gain.linearRampToValueAtTime(.05, now + .025);
      gain.gain.exponentialRampToValueAtTime(.0001, now + .2);

      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(now);
      oscillator.stop(now + .22);

      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    } catch {}
  }

  if (data.settings.haptic && navigator.vibrate) {
    try { navigator.vibrate(25); } catch {}
  }
}

async function releaseWake() {
  wakeTicket++;
  const current = wakeLock;
  wakeLock = null;
  if (current) {
    try { await current.release(); } catch {}
  }
}

async function acquireWake() {
  if (
    !data.settings.wake ||
    !navigator.wakeLock ||
    document.hidden ||
    !engine.active ||
    engine.paused ||
    wakeLock
  ) return;

  const ticket = ++wakeTicket;

  try {
    const lock = await navigator.wakeLock.request('screen');

    if (
      ticket !== wakeTicket ||
      !engine.active ||
      engine.paused ||
      document.hidden
    ) {
      await lock.release();
      return;
    }

    wakeLock = lock;
    lock.addEventListener('release', () => {
      if (wakeLock === lock) wakeLock = null;
    });
  } catch {
    /* ไม่รองรับหรือปฏิเสธ Wake Lock ก็ยังฝึกต่อได้ */
  }
}

/* ---------- Session engine ---------- */

class BreathingEngine {
  constructor(onFrame, onFinish) {
    this.onFrame = onFrame;
    this.onFinish = onFinish;
    this.active = false;
    this.paused = false;
    this.raf = 0;
    this.tick = this.tick.bind(this);
  }

  start(pattern, config) {
    if (this.active) return;

    this.pattern = clone(pattern);
    this.roundSeconds = pattern.phases.reduce((sum, item) => sum + item.d, 0);

    this.target = config.mode === 'time'
      ? config.minutes * 60
      : config.cycles * this.roundSeconds;

    this.startedAt = Date.now();
    this.accumulated = 0;
    this.anchor = performance.now();
    this.active = true;
    this.paused = false;
    this.tick();
  }

  clock() {
    return this.accumulated +
      (this.paused ? 0 : (performance.now() - this.anchor) / 1000);
  }

  snapshot() {
    const clock = this.clock();
    const preparing = clock < 3;
    const seconds = Math.min(this.target, Math.max(0, clock - 3));
    const cycles = Math.floor((seconds + 1e-7) / this.roundSeconds);
    const position = seconds % this.roundSeconds;

    let start = 0;
    let previousScale = .45;
    let index = 0;

    for (let i = 0; i < this.pattern.phases.length; i++) {
      const item = this.pattern.phases[i];
      index = i;
      if (position < start + item.d || i === this.pattern.phases.length - 1) {
        break;
      }
      start += item.d;
      previousScale = item.scale;
    }

    const current = this.pattern.phases[index];
    const progress = Math.min(1, Math.max(0, (position - start) / current.d));
    const scale = preparing ? .45 :
      previousScale + (current.scale - previousScale) * progress;

    return {
      preparing,
      seconds,
      cycles,
      remaining: preparing
        ? Math.max(1, Math.ceil(3 - clock))
        : Math.max(1, Math.ceil(current.d - (position - start))),
      label: preparing ? 'เตรียมตัว · หายใจตามสบาย' : current.label,
      scale,
      type: current.t,
      phaseKey: preparing ? 'prepare' : `${cycles}:${index}`,
      done: clock >= this.target + 3,
      paused: this.paused,
      target: this.target
    };
  }

  tick() {
    if (!this.active) return;

    const state = this.snapshot();

    if (state.done) {
      this.finish(true);
      return;
    }

    this.onFrame(state);

    if (!this.paused) this.raf = requestAnimationFrame(this.tick);
  }

  pause() {
    if (!this.active || this.paused) return;
    this.accumulated = this.clock();
    this.paused = true;
    cancelAnimationFrame(this.raf);
    this.onFrame(this.snapshot());
  }

  resume() {
    if (!this.active || !this.paused) return;
    this.anchor = performance.now();
    this.paused = false;
    this.tick();
  }

  finish(completed) {
    if (!this.active) return;

    const snapshot = this.snapshot();
    this.active = false;
    cancelAnimationFrame(this.raf);

    this.onFinish({
      ...snapshot,
      completed,
      pattern: this.pattern,
      startedAt: this.startedAt
    });
  }
}

let lastPhaseKey = '';

const engine = new BreathingEngine(drawSessionFrame, finishSession);

/* ---------- Statistics ---------- */

function stats() {
  const days = [...new Set(data.logs.map(log => dayNumber(log.ts)))]
    .sort((a, b) => b - a);

  const today = dayNumber(Date.now());

  let current = 0;
  if (days.length && (days[0] === today || days[0] === today - 1)) {
    current = 1;
    while (
      current < days.length &&
      days[current - 1] - days[current] === 1
    ) current++;
  }

  let best = 0;
  let run = 0;
  let previous = null;

  for (const day of [...days].reverse()) {
    run = previous !== null && day - previous === 1 ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  }

  return {
    current,
    best,
    seconds: data.logs.reduce((sum, log) => sum + log.seconds, 0),
    count: data.logs.length
  };
}

function chartHTML() {
  const today = new Date();
  const rows = [];

  for (let offset = 6; offset >= 0; offset--) {
    const day = new Date(
      today.getFullYear(), today.getMonth(), today.getDate() - offset
    );
    const number = dayNumber(day);
    const minutes = data.logs
      .filter(log => dayNumber(log.ts) === number)
      .reduce((sum, log) => sum + log.seconds, 0) / 60;

    rows.push({
      label: day.toLocaleDateString('th-TH', { weekday: 'short' }),
      minutes
    });
  }

  const max = Math.max(1, ...rows.map(row => row.minutes));

  return rows.map(row => `
    <div class="chart-row">
      <span>${escapeHTML(row.label)}</span>
      <div class="chart-track">
        <div class="chart-fill"
             style="width:${row.minutes / max * 100}%"></div>
      </div>
      <span>${row.minutes.toFixed(1)} น.</span>
    </div>
  `).join('');
}

function historyHTML(logs) {
  if (!logs.length) return '<p class="muted">ยังไม่มีประวัติการฝึก</p>';

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>วันที่เริ่ม</th>
            <th>รูปแบบ</th>
            <th>เวลา</th>
            <th>รอบครบ</th>
            <th>หลังฝึก</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${logs.map(log => `
            <tr>
              <td>${escapeHTML(dateText(log.ts))}</td>
              <td>${escapeHTML(log.patternName)}</td>
              <td>${formatTime(log.seconds)}</td>
              <td>${log.cycles}</td>
              <td>${MOODS[log.mood ?? 0]}</td>
              <td>${log.completed ? 'ครบเป้าหมาย' : 'จบก่อนเป้าหมาย'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

/* ---------- Rendering ---------- */

function updateHeader() {
  node('streakBadge').textContent = `${stats().current} วันต่อเนื่อง`;

  for (const button of node('navigation').querySelectorAll('button')) {
    button.disabled = engine.active;

    if (button.dataset.page === page) {
      button.setAttribute('aria-current', 'page');
    } else {
      button.removeAttribute('aria-current');
    }
  }
}

function applyTheme() {
  document.documentElement.dataset.theme = data.settings.theme;
}

function rhythmHTML(pattern) {
  const labels = { in: 'เข้า', out: 'ออก', hold: 'พัก' };
  return pattern.phases
    .map(item => `${labels[item.t]} ${item.d} วิ`)
    .join(' → ');
}

function render() {
  applyTheme();
  updateHeader();

  const screens = {
    home: renderHome,
    library: renderLibrary,
    stats: renderStats,
    settings: renderSettings,
    summary: renderSummary
  };

  screens[page]?.();
}

function navigate(nextPage) {
  if (engine.active) return;

  if (lastRecord && !lastSaved && nextPage !== 'summary') {
    notice('ยังบันทึกครั้งล่าสุดไม่สำเร็จ กรุณากดลองบันทึกอีกครั้งก่อน');
    return;
  }

  page = nextPage;
  render();
  window.scrollTo({ top: 0 });
}

function renderHome() {
  const pattern = selectedPattern();

  node('view').innerHTML = `
    <section class="card">
      <small class="muted">รูปแบบที่เลือก</small>
      <h1>${escapeHTML(pattern.name)}</h1>
      <p>${escapeHTML(pattern.goal)}</p>
      <div class="rhythm">${rhythmHTML(pattern)}</div>
      <button data-action="library">เปลี่ยนรูปแบบ</button>
    </section>

    <form id="sessionForm" class="card">
      <h2>กำหนดการฝึก</h2>

      <div class="row">
        ${[1, 3, 5, 10].map(minutes => `
          <button type="button" data-action="quick" data-value="${minutes}">
            ${minutes} นาที
          </button>
        `).join('')}
      </div>

      <label>
        <span>โหมด</span>
        <select name="mode" id="durationMode">
          <option value="time" ${configuration.mode === 'time' ? 'selected' : ''}>
            ตามเวลา
          </option>
          <option value="cycles" ${configuration.mode === 'cycles' ? 'selected' : ''}>
            ตามจำนวนรอบ
          </option>
        </select>
      </label>

      <div class="grid2">
        <label>
          <span>เวลา · นาที</span>
          <input name="minutes" id="minutesInput" type="number"
                 min="1" max="45" step="1"
                 value="${configuration.minutes}" required
                 ${configuration.mode !== 'time' ? 'disabled' : ''}>
        </label>
        <label>
          <span>จำนวนรอบ</span>
          <input name="cycles" id="cyclesInput" type="number"
                 min="1" max="99" step="1"
                 value="${configuration.cycles}" required
                 ${configuration.mode !== 'cycles' ? 'disabled' : ''}>
        </label>
      </div>

      <button class="primary full" type="submit">เริ่มฝึก</button>
    </form>

    <p class="muted">
      ฝึกในท่านั่งหรือนอนที่ปลอดภัย หายใจเบา ๆ ไม่ฝืนกลั้นหรือสูดแรง
      หากเวียนศีรษะ อึดอัด หรือเจ็บหน้าอก ให้หยุดฝึก
      ไม่ฝึกขณะขับรถหรืออยู่ในน้ำ
      ผู้มีโรคหัวใจ โรคปอด หรือกำลังตั้งครรภ์ควรปรึกษาผู้ดูแลสุขภาพก่อน
      แอปนี้ไม่ใช่เครื่องมือวินิจฉัยหรือรักษาโรค
    </p>
  `;
}

function renderLibrary() {
  node('view').innerHTML = `
    <h1>คลังรูปแบบการหายใจ</h1>
    <p class="muted">
      รูปแบบสำเร็จรูป 6 แบบ และรูปแบบส่วนตัว
      คำอธิบายเป็นแนวทางการใช้งาน ไม่ใช่คำรับรองผลการรักษา
    </p>

    ${allPatterns().map(pattern => `
      <section class="card ${pattern.id === data.selectedId ? 'selected' : ''}">
        <h2>${escapeHTML(pattern.name)}</h2>
        <p>${escapeHTML(pattern.goal)}</p>
        <div class="rhythm">${rhythmHTML(pattern)}</div>
        <div class="row">
          <button class="primary" data-action="select-pattern"
                  data-id="${escapeHTML(pattern.id)}">เลือกใช้</button>
          ${data.customPatterns.some(item => item.id === pattern.id) ? `
            <button class="danger" data-action="delete-pattern"
                    data-id="${escapeHTML(pattern.id)}">ลบรูปแบบ</button>
          ` : ''}
        </div>
      </section>
    `).join('')}

    <form id="customForm" class="card">
      <h2>เพิ่มรูปแบบส่วนตัว</h2>
      <p class="muted">ใส่ 0 ในช่วงพักที่ไม่ต้องการใช้ หน่วยเป็นวินาที</p>

      <label>
        <span>ชื่อรูปแบบ</span>
        <input name="name" type="text" maxlength="100" required>
      </label>

      <label>
        <span>คำอธิบาย / วัตถุประสงค์</span>
        <input name="goal" type="text" maxlength="300">
      </label>

      <div class="grid4">
        <label>
          <span>หายใจเข้า</span>
          <input name="inhale" type="number"
                 min="1" max="30" step=".5" value="4" required>
        </label>
        <label>
          <span>พักหลังเข้า</span>
          <input name="holdIn" type="number"
                 min="0" max="60" step=".5" value="0" required>
        </label>
        <label>
          <span>หายใจออก</span>
          <input name="exhale" type="number"
                 min="1" max="30" step=".5" value="6" required>
        </label>
        <label>
          <span>พักหลังออก</span>
          <input name="holdOut" type="number"
                 min="0" max="60" step=".5" value="0" required>
        </label>
      </div>

      <p class="muted">ขอบเขตตัวเลขเป็นข้อจำกัดของโปรแกรม ไม่ใช่ระดับที่ปลอดภัยสำหรับทุกคน</p>
      <button class="primary" type="submit">บันทึกรูปแบบ</button>
    </form>
  `;
}

function renderStats() {
  const result = stats();
  const moods = data.logs.filter(log => log.mood !== null);
  const average = moods.length
    ? (moods.reduce((sum, log) => sum + log.mood, 0) / moods.length).toFixed(1)
    : null;

  node('view').innerHTML = `
    <h1>สถิติการฝึก</h1>

    <section class="card grid2">
      <div class="kpi"><strong>${result.current}</strong>วันต่อเนื่อง</div>
      <div class="kpi"><strong>${result.best}</strong>ต่อเนื่องสูงสุด</div>
      <div class="kpi"><strong>${(result.seconds / 60).toFixed(1)}</strong>นาทีสะสม</div>
      <div class="kpi"><strong>${result.count}</strong>ครั้งทั้งหมด</div>
    </section>

    <section class="card">
      <h2>7 วันล่าสุด</h2>
      ${chartHTML()}
    </section>

    <section class="card">
      <h2>ความรู้สึกหลังฝึก</h2>
      <p>${average !== null
        ? `คะแนนเฉลี่ย ${average}/5 จาก ${moods.length} ครั้งที่ให้คะแนน`
        : 'ยังไม่มีการให้คะแนนหลังฝึก'}</p>
      <small>เป็นคะแนนที่บันทึกด้วยตนเอง ไม่ใช่หลักฐานยืนยันผลการรักษา</small>
    </section>

    <section class="card">
      <div class="row">
        <h2 class="grow">ประวัติการฝึก</h2>
        <button data-action="print" ${data.logs.length ? '' : 'disabled'}>
          พิมพ์ / บันทึก PDF
        </button>
      </div>
      <p class="muted">หน้าจอแสดงล่าสุด 100 ครั้ง · รายงานและไฟล์สำรองมีข้อมูลทั้งหมด</p>
      ${historyHTML([...data.logs].reverse().slice(0, 100))}
    </section>
  `;
}

function renderSettings() {
  const switches = [
    ['sound', 'เสียงสัญญาณตามจังหวะ'],
    ['haptic', 'สั่นตามจังหวะ หากอุปกรณ์รองรับ'],
    ['wake', 'ขอกันหน้าจอดับระหว่างฝึก'],
    ['askMood', 'ถามความรู้สึกหลังฝึก']
  ];

  node('view').innerHTML = `
    <h1>ตั้งค่า</h1>

    <section class="card">
      ${switches.map(([key, label]) => `
        <label class="toggle">
          <span>${label}</span>
          <input type="checkbox" data-setting="${key}"
                 ${data.settings[key] ? 'checked' : ''}>
        </label>
      `).join('')}

      <label>
        <span>ธีม</span>
        <select data-setting="theme">
          ${[
            ['auto', 'ตามระบบ'],
            ['dark', 'มืด'],
            ['light', 'สว่าง']
          ].map(([value, label]) => `
            <option value="${value}"
                    ${data.settings.theme === value ? 'selected' : ''}>
              ${label}
            </option>
          `).join('')}
        </select>
      </label>
    </section>

    <section class="card">
      <h2>สำรองและนำเข้าข้อมูล</h2>
      <p class="muted">
        เก็บข้อมูลในเบราว์เซอร์ ไม่มีบัญชีและไม่มีระบบซิงก์
        ก่อนเปลี่ยนเครื่องหรือล้างข้อมูลเว็บไซต์ ให้สำรอง JSON ไว้
      </p>

      <div class="row">
        <button data-action="export">ส่งออก JSON</button>
        <button data-action="choose-import">เลือกไฟล์นำเข้า</button>
      </div>

      <input id="importFile" type="file"
             accept=".json,application/json" hidden>

      ${pendingImport ? `
        <section class="card">
          <h3>ตรวจไฟล์ผ่านแล้ว</h3>
          <p>พบประวัติ ${pendingImport.logs.length} ครั้ง
             และรูปแบบส่วนตัว ${pendingImport.customPatterns.length} รูปแบบ</p>
          <p class="muted">
            รวมข้อมูล: คงการตั้งค่าเดิม และเก็บรายการเดิมเมื่อรหัสซ้ำ<br>
            แทนที่: ใช้ข้อมูลและการตั้งค่าจากไฟล์
          </p>
          <div class="row">
            <button class="primary" data-action="merge-import">รวมข้อมูล</button>
            <button class="danger" data-action="replace-import">แทนที่ทั้งหมด</button>
            <button data-action="cancel-import">ยกเลิก</button>
          </div>
        </section>
      ` : ''}
    </section>

    <section class="card">
      <h2>ติดตั้งแอป</h2>
      <p class="muted">
        ถ้ามีปุ่มติดตั้งให้ใช้ปุ่มด้านล่าง
        หากไม่มี ให้ใช้เมนูเบราว์เซอร์ “ติดตั้งแอป” หรือ “เพิ่มไปยังหน้าจอหลัก”
        ความสามารถขึ้นอยู่กับเบราว์เซอร์
      </p>
      <button data-action="install" ${installPrompt ? '' : 'disabled'}>
        ติดตั้งแอป
      </button>
    </section>

    <section class="card">
      <h2>ลบข้อมูล</h2>
      <div class="row">
        <button class="danger" data-action="clear-history">ลบเฉพาะประวัติ</button>
        <button class="danger" data-action="reset-data">รีเซ็ตข้อมูลแอปนี้</button>
      </div>
    </section>
  `;
}

function renderSummary() {
  if (!lastRecord) {
    page = 'home';
    render();
    return;
  }

  node('view').innerHTML = `
    <section class="card">
      <h1>จบการฝึกแล้ว</h1>
      <h2>${escapeHTML(lastRecord.patternName)}</h2>
      <p>เวลาฝึก ${formatTime(lastRecord.seconds)}
         · ครบ ${lastRecord.cycles} รอบ</p>
      <p>${lastRecord.completed ? 'ทำครบเป้าหมายที่ตั้งไว้' : 'จบก่อนเป้าหมาย'}</p>

      <p>${lastSaved
        ? 'บันทึกประวัติลงเครื่องแล้ว'
        : 'ยังบันทึกไม่สำเร็จ อย่าปิดหน้านี้'}</p>

      ${!lastSaved ? `
        <button class="primary" data-action="retry-save">ลองบันทึกอีกครั้ง</button>
      ` : ''}

      ${data.settings.askMood ? `
        <h2>หลังฝึกรู้สึกอย่างไร?</h2>
        <p class="muted">ไม่จำเป็นต้องตอบ ประวัติการฝึกไม่ขึ้นกับการให้คะแนน</p>
        <div class="mood-options">
          ${[1, 2, 3, 4, 5].map(mood => `
            <button data-action="mood" data-value="${mood}"
                    ${lastRecord.mood === mood ? 'class="primary"' : ''}>
              ${mood} · ${MOODS[mood]}
            </button>
          `).join('')}
        </div>
      ` : ''}

      <button data-action="home" ${lastSaved ? '' : 'disabled'}>
        ${data.settings.askMood && lastRecord.mood === null
          ? 'ข้ามและกลับหน้าหลัก' : 'กลับหน้าหลัก'}
      </button>
    </section>
  `;
}

/* ---------- Session UI ---------- */

function startSession(form) {
  if (engine.active) return;

  const mode = form.elements.mode.value;
  configuration.mode = mode;

  if (mode === 'time') {
    configuration.minutes = requireNumber(
      Number(form.elements.minutes.value), 1, 45, 'เวลา', true
    );
  } else {
    configuration.cycles = requireNumber(
      Number(form.elements.cycles.value), 1, 99, 'จำนวนรอบ', true
    );
  }

  const pattern = selectedPattern();
  unlockAudio();
  lastPhaseKey = '';
  page = 'session';

  node('notice').hidden = true;

  node('view').innerHTML = `
    <section class="card session">
      <h1>${escapeHTML(pattern.name)}</h1>
      <p class="muted">ไม่ต้องฝืน หากไม่สบายให้จบการฝึกได้ทันที</p>

      <div class="orb-space">
        <div id="breathingOrb" class="orb" aria-hidden="true"></div>
      </div>

      <div id="phaseText" class="phase">เตรียมตัว</div>
      <div id="phaseCounter" class="counter">3</div>
      <p id="sessionTime">00:00</p>
      <p id="sessionCycles">ครบ 0 รอบ</p>

      <progress id="sessionProgress" value="0" max="1"
                aria-label="ความคืบหน้าการฝึก"></progress>

      <div class="row">
        <button id="pauseButton" class="grow" data-action="pause">พัก</button>
        <button class="primary grow" data-action="finish">จบการฝึก</button>
      </div>
    </section>
  `;

  engine.start(pattern, configuration);
  updateHeader();
  acquireWake();
}

function drawSessionFrame(state) {
  node('breathingOrb').style.transform = `scale(${state.scale})`;
  node('phaseText').textContent = state.paused ? 'หยุดชั่วคราว' : state.label;
  node('phaseCounter').textContent = state.remaining;

  node('sessionTime').textContent =
    `${formatTime(state.seconds)} / ${formatTime(state.target)}`;

  node('sessionCycles').textContent = `ครบ ${state.cycles} รอบ`;
  node('sessionProgress').value = state.seconds / state.target;
  node('pauseButton').textContent = state.paused ? 'ฝึกต่อ' : 'พัก';

  if (!state.paused && state.phaseKey !== lastPhaseKey) {
    lastPhaseKey = state.phaseKey;
    cue(state.preparing ? 'hold' : state.type);
  }
}

function saveLastRecord() {
  const next = clone(data);
  const existing = next.logs.findIndex(item => item.id === lastRecord.id);

  if (existing === -1) {
    next.logs.push(clone(lastRecord));
  } else {
    next.logs[existing] = clone(lastRecord);
  }

  commit(next);
  lastSaved = true;
}

function finishSession(result) {
  releaseWake();

  /* ยกเลิกระหว่างเตรียมตัว ไม่สร้างประวัติ */
  if (result.seconds < 1) {
    page = 'home';
    render();
    notice('ยกเลิกก่อนเริ่มฝึก ไม่มีการเพิ่มประวัติ');
    return;
  }

  lastRecord = {
    id: uid(),
    ts: result.startedAt,
    patternId: result.pattern.id,
    patternName: result.pattern.name,
    seconds: Math.round(result.seconds * 10) / 10,
    cycles: result.cycles,
    mood: null,
    completed: result.completed
  };

  lastSaved = false;

  try {
    saveLastRecord();
  } catch (error) {
    reportError(error);
  }

  page = 'summary';
  render();
}

/* ---------- Custom patterns ---------- */

function addCustom(form) {
  const fields = new FormData(form);

  const inhale = requireNumber(Number(fields.get('inhale')), 1, 30, 'หายใจเข้า');
  const holdIn = requireNumber(Number(fields.get('holdIn')), 0, 60, 'พักหลังเข้า');
  const exhale = requireNumber(Number(fields.get('exhale')), 1, 30, 'หายใจออก');
  const holdOut = requireNumber(Number(fields.get('holdOut')), 0, 60, 'พักหลังออก');

  const phases = [phase('in', inhale, 'หายใจเข้า', 1)];
  if (holdIn) phases.push(phase('hold', holdIn, 'พักลมหายใจอย่างสบาย', 1));
  phases.push(phase('out', exhale, 'หายใจออก', .45));
  if (holdOut) phases.push(phase('hold', holdOut, 'พักลมหายใจอย่างสบาย', .45));

  const pattern = normalizePattern({
    id: `custom-${uid()}`,
    name: fields.get('name'),
    goal: fields.get('goal'),
    phases
  });

  const next = clone(data);
  next.customPatterns.push(pattern);
  next.selectedId = pattern.id;
  commit(next);

  render();
  notice('เพิ่มรูปแบบและเลือกไว้ให้แล้ว');
}

/* ---------- Backup / restore ---------- */

function exportBackup() {
  downloadText(
    `breathe-backup-${fileDate()}.json`,
    JSON.stringify({
      ...data,
      exportedAt: new Date().toISOString()
    }, null, 2),
    'application/json'
  );
  notice('ส่งไฟล์สำรองให้เบราว์เซอร์แล้ว กรุณาตรวจในรายการดาวน์โหลด');
}

async function inspectImport(file) {
  pendingImport = null;
  if (!file) return;

  if (file.size > 10 * 1024 * 1024) {
    throw new Error('ไฟล์ต้องไม่ใหญ่กว่า 10 MB');
  }

  pendingImport = normalizeData(JSON.parse(await file.text()));
  renderSettings();
  notice('ตรวจโครงสร้างไฟล์สำเร็จ ยังไม่ได้เปลี่ยนข้อมูลเดิม');
}

function applyImport(replace) {
  if (!pendingImport) return;

  if (
    replace &&
    !confirm('แทนที่ประวัติ รูปแบบส่วนตัว และการตั้งค่าทั้งหมดด้วยไฟล์นี้?')
  ) return;

  if (replace) {
    commit(clone(pendingImport));
  } else {
    const next = clone(data);

    /* รายการเดิมอยู่ท้าย Map จึงถูกเก็บไว้เมื่อ ID ซ้ำ */
    next.logs = uniqueById([...pendingImport.logs, ...next.logs]);
    next.customPatterns = uniqueById([
      ...pendingImport.customPatterns,
      ...next.customPatterns
    ]);

    commit(next);
  }

  pendingImport = null;
  render();
  notice('นำเข้าข้อมูลสำเร็จ');
}

/* ---------- Printable PDF report ---------- */

function printReport() {
  if (!data.logs.length) return;

  const result = stats();
  const grouped = new Map();
  const moods = data.logs.filter(log => log.mood !== null);

  for (const log of data.logs) {
    const group = grouped.get(log.patternName) ?? { seconds: 0, count: 0 };
    group.seconds += log.seconds;
    group.count++;
    grouped.set(log.patternName, group);
  }

  node('report').innerHTML = `
    <h1>รายงานการฝึกหายใจ</h1>
    <p>Breathe Fresh · ออกรายงาน ${escapeHTML(dateText(Date.now()))}</p>

    <p>
      ฝึกทั้งหมด ${result.count} ครั้ง ·
      เวลาสะสม ${(result.seconds / 60).toFixed(1)} นาที ·
      ต่อเนื่องปัจจุบัน ${result.current} วัน ·
      ต่อเนื่องสูงสุด ${result.best} วัน
    </p>

    <p>
      ความรู้สึกหลังฝึก:
      ${moods.length
        ? `เฉลี่ย ${(moods.reduce((sum, log) => sum + log.mood, 0) /
            moods.length).toFixed(1)}/5 จาก ${moods.length} ครั้ง`
        : 'ยังไม่มีคะแนน'}
    </p>

    <h2>7 วันล่าสุด</h2>
    ${chartHTML()}

    <h2>สรุปตามรูปแบบ</h2>
    <table>
      <thead>
        <tr><th>รูปแบบ</th><th>จำนวนครั้ง</th><th>นาทีรวม</th></tr>
      </thead>
      <tbody>
        ${[...grouped.entries()].map(([name, group]) => `
          <tr>
            <td>${escapeHTML(name)}</td>
            <td>${group.count}</td>
            <td>${(group.seconds / 60).toFixed(1)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <h2>ประวัติทั้งหมด</h2>
    ${historyHTML([...data.logs].reverse())}

    <p>
      รายงานนี้ใช้ติดตามตนเอง ไม่ใช่เอกสารวินิจฉัยหรือรับรองผลการรักษา
      คะแนนความรู้สึกเป็นการประเมินด้วยตนเอง
    </p>
  `;

  window.print();
}

/* ---------- Event delegation ---------- */

async function handleAction(button) {
  const action = button.dataset.action;

  switch (action) {
    case 'home':
    case 'library':
      navigate(action);
      break;

    case 'quick':
      configuration.mode = 'time';
      configuration.minutes = Number(button.dataset.value);
      renderHome();
      break;

    case 'select-pattern': {
      const next = clone(data);
      next.selectedId = button.dataset.id;
      commit(next);
      navigate('home');
      break;
    }

    case 'delete-pattern': {
      if (!confirm('ลบรูปแบบนี้? ประวัติที่เคยฝึกจะยังอยู่')) return;
      const next = clone(data);
      next.customPatterns = next.customPatterns.filter(
        item => item.id !== button.dataset.id
      );
      if (next.selectedId === button.dataset.id) next.selectedId = 'box';
      commit(next);
      render();
      break;
    }

    case 'pause':
      if (engine.paused) {
        unlockAudio();
        engine.resume();
        acquireWake();
      } else {
        engine.pause();
        releaseWake();
      }
      break;

    case 'finish':
      engine.finish(false);
      break;

    case 'retry-save':
      saveLastRecord();
      render();
      notice('บันทึกประวัติสำเร็จ');
      break;

    case 'mood':
      lastRecord.mood = Number(button.dataset.value);
      lastSaved = false;
      try {
        saveLastRecord();
      } finally {
        render();
      }
      break;

    case 'export':
      exportBackup();
      break;

    case 'choose-import':
      node('importFile').click();
      break;

    case 'merge-import':
      applyImport(false);
      break;

    case 'replace-import':
      applyImport(true);
      break;

    case 'cancel-import':
      pendingImport = null;
      renderSettings();
      notice('ยกเลิกการนำเข้า ข้อมูลเดิมไม่เปลี่ยน');
      break;

    case 'print':
      printReport();
      break;

    case 'install':
      if (installPrompt) {
        const prompt = installPrompt;
        installPrompt = null;
        await prompt.prompt();
        await prompt.userChoice;
        if (page === 'settings') renderSettings();
      }
      break;

    case 'clear-history': {
      if (!confirm('ลบประวัติทั้งหมด? รูปแบบส่วนตัวและการตั้งค่าจะยังอยู่')) return;
      const next = clone(data);
      next.logs = [];
      commit(next);
      lastRecord = null;
      render();
      notice('ลบเฉพาะประวัติแล้ว');
      break;
    }

    case 'reset-data':
      if (!confirm('รีเซ็ตข้อมูลแอปนี้ทั้งหมด? ควรสำรอง JSON ก่อน')) return;
      commit(emptyData());
      lastRecord = null;
      lastSaved = true;
      pendingImport = null;
      navigate('home');
      notice('รีเซ็ตข้อมูลแอปนี้แล้ว ไม่ได้ล้างข้อมูลเว็บไซต์อื่น');
      break;
  }
}

function wireEvents() {
  node('navigation').addEventListener('click', event => {
    const button = event.target.closest('button[data-page]');
    if (!button || button.disabled) return;
    try { navigate(button.dataset.page); } catch (error) { reportError(error); }
  });

  node('view').addEventListener('click', event => {
    const button = event.target.closest('button[data-action]');
    if (!button || button.disabled) return;
    Promise.resolve(handleAction(button)).catch(reportError);
  });

  node('view').addEventListener('submit', event => {
    event.preventDefault();
    const form = event.target;
    if (!form.reportValidity()) return;

    try {
      if (form.id === 'sessionForm') startSession(form);
      if (form.id === 'customForm') addCustom(form);
    } catch (error) {
      reportError(error);
    }
  });

  node('view').addEventListener('change', async event => {
    const target = event.target;

    try {
      if (target.id === 'durationMode') {
        configuration.mode = target.value;
        node('minutesInput').disabled = target.value !== 'time';
        node('cyclesInput').disabled = target.value !== 'cycles';
      }

      if (target.dataset.setting) {
        const next = clone(data);
        next.settings[target.dataset.setting] = target.type === 'checkbox'
          ? target.checked : target.value;
        commit(next);
        applyTheme();
        if (data.settings.sound) unlockAudio();
      }

      if (target.id === 'importFile') {
        const file = target.files[0];
        target.value = '';
        await inspectImport(file);
      }
    } catch (error) {
      reportError(error);
      if (page === 'settings') renderSettings();
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && engine.active) {
      engine.pause();
      releaseWake();
    }
  });

  window.addEventListener('pagehide', () => {
    if (engine.active) engine.pause();
    releaseWake();
  });

  window.addEventListener('beforeunload', event => {
    if (engine.active || (lastRecord && !lastSaved)) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
}

/* ---------- PWA ---------- */

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  if (data && page === 'settings') renderSettings();
});

window.addEventListener('appinstalled', () => {
  installPrompt = null;
  if (data && page === 'settings') renderSettings();
});

async function setupPWA() {
  if (!('serviceWorker' in navigator) || !window.isSecureContext) {
    node('offlineStatus').textContent =
      'ใช้งานออนไลน์ได้ · ระบบออฟไลน์ต้องใช้ HTTPS หรือ localhost';
    return;
  }

  try {
    workerRegistration = await navigator.serviceWorker.register(
      './service-worker.js',
      { scope: './', updateViaCache: 'none' }
    );

    const showUpdate = () => {
      node('updateApp').hidden = !workerRegistration.waiting;
    };

    function watchWorker(worker) {
      if (!worker) return;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed') showUpdate();

        if (worker.state === 'redundant') {
          node('offlineStatus').textContent =
            'ติดตั้งไฟล์ออฟไลน์ไม่สำเร็จ ตรวจชื่อไฟล์และการ Deploy';
        }
      });
    }

    showUpdate();
    watchWorker(workerRegistration.installing);

    workerRegistration.addEventListener('updatefound', () => {
      watchWorker(workerRegistration.installing);
    });

    node('updateApp').onclick = () => {
      if (engine.active || (lastRecord && !lastSaved)) {
        notice('กรุณาจบการฝึกและบันทึกข้อมูลก่อนอัปเดต');
        return;
      }

      if (workerRegistration.waiting) {
        reloadAfterUpdate = true;
        workerRegistration.waiting.postMessage({ type: 'ACTIVATE_UPDATE' });
      } else {
        location.reload();
      }
    };

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloadAfterUpdate) location.reload();
    });

    navigator.serviceWorker.ready.then(() => {
      node('offlineStatus').textContent = 'ติดตั้งชุดไฟล์ออฟไลน์แล้ว';
    });

    workerRegistration.update().catch(() => {});
  } catch (error) {
    node('offlineStatus').textContent =
      'ระบบออฟไลน์ยังไม่พร้อม แต่ยังใช้งานออนไลน์ได้';
    console.warn(error);
  }
}

/* ---------- Boot ---------- */

export function init() {
  data = loadData();
  wireEvents();
  render();
  setupPWA();
}