(() => {
'use strict';

const STORAGE_KEY = 'vertex_growth_system_v3';
const OLD_KEYS = [
  'vertex_habit_tracker_v1',
  'vertex-habit-tracker-v2'
];

const $ = (selector, root = document) =>
  root.querySelector(selector);

const $$ = (selector, root = document) =>
  [...root.querySelectorAll(selector)];

const today = () => localDateString(new Date());

function localDateString(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDate(s) {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

function shiftDate(s, amount) {
  const d = parseDate(s);
  d.setDate(d.getDate() + amount);
  return localDateString(d);
}

function weekStart(s = today()) {
  const d = parseDate(s);
  const mondayOffset = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - mondayOffset);
  return localDateString(d);
}

function uid() {
  return (
    window.crypto?.randomUUID?.() ||
    `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  );
}

const CATEGORIES = {
  focus: 'Fokus',
  health: 'Salomatlik',
  learning: 'Ta’lim',
  mindset: 'Tafakkur',
  recovery: 'Dam olish',
  discipline: 'Intizom'
};

const CATEGORY_ICONS = { focus: '🎯', health: '🍋', learning: '📚', mindset: '🧠', recovery: '🌙', discipline: '⚡' };
const HABIT_ICONS = ['🎯','⚡','🔥','✨','💎','🌟','🚀','🧠','📚','📖','✍️','📝','💡','🎓','🗣️','🌍','💻','🎨','🎵','🎧','🏃','🚴','🏋️','🧘','💪','🥗','🍎','💧','🫧','🌿','🍀','🌱','🌸','🌻','☀️','🌙','😴','🛌','🧹','🧺','🧼','🪥','🧴','🧘‍♂️','🧘‍♀️','🤝','❤️','💜','🩵','🧡','💛','🤍','🖤','🏆','📈','🛠️','🧩','⏳','🕯️','🪴','🧊','🍊','🍋','🍓','🥝','🫐','🍇','🥑','🌈','🦋','🐝','🦁','🐢'];
const HABIT_COLORS = [
  '#D4F34A','#70D6FF','#FF9F68','#C7A6FF','#FF83A8','#72DFB2','#F5CF67',
  '#DFFF00','#CCFF00','#B6FF00','#A2FF00','#8CFF00','#C6FF3D','#E8FF4A','#F5FF00',
  '#FFEA00','#FFD000','#FFB000','#FF9500','#FF7A00','#FF5E00','#FF3D00','#FF1744',
  '#FF2D95','#FF4FD8','#F000FF','#D500F9','#B000FF','#8C52FF','#7048FF','#536DFF',
  '#2979FF','#00A8FF','#00C8FF','#00E5FF','#00F5D4','#00E6A8','#00D084','#39E75F',
  '#A8E10C','#7CFC00','#C0CA33','#F4D35E','#E9C46A','#F6BD60','#E07A5F','#C77DFF',
  '#A78BFA','#8ECAE6','#90BE6D','#5E8C61','#2A9D8F','#264653','#3D405B','#6D597A',
  '#B56576','#E56B6F','#F28482','#F7A8B8','#D4A5A5','#C9B1FF','#B8C0FF','#A0C4FF',
  '#BDB2FF','#FFC6FF','#FDFFB6','#CAFFBF','#9BF6FF','#FFFFFF','#D6D6D6','#A3A3A3'
];
const DEFAULT_HABIT_COLOR = HABIT_COLORS[0];
const DEFAULT_HABIT_ICON = '🎯';
let selectedHabitColor = DEFAULT_HABIT_COLOR;
let selectedHabitIcon = DEFAULT_HABIT_ICON;

function renderHabitPickers() {
  const iconBox = $('.habit-icon-picker');
  const colorBox = $('.habit-color-picker');
  if (iconBox) iconBox.innerHTML = HABIT_ICONS.map((icon, i) => `<button type="button" class="habit-choice-icon ${i === 0 ? 'selected' : ''}" data-habit-icon="${escapeHTML(icon)}" aria-label="${escapeHTML(icon)}" aria-pressed="${i === 0}">${icon}</button>`).join('');
  if (colorBox) colorBox.innerHTML = HABIT_COLORS.map((color, i) => `<button type="button" class="habit-choice-color ${i === 0 ? 'selected' : ''}" data-habit-color="${color}" style="--swatch:${color}" title="${color}" aria-label="${color}" aria-pressed="${i === 0}"><span></span></button>`).join('');
}

function habitIcon(habit) { return habit?.icon || CATEGORY_ICONS[habit?.category] || DEFAULT_HABIT_ICON; }

function normalizeHabitColor(color) {
  const value = String(color || '').toLowerCase();
  return HABIT_COLORS.includes(value.toUpperCase()) ? value.toUpperCase() : DEFAULT_HABIT_COLOR;
}

function habitAccent(habit) {
  return `--habit-accent:${normalizeHabitColor(habit?.color ?? habit?.habitColor)}`;
}

const DAY_NAMES = ['Du', 'Se', 'Cho', 'Pay', 'Ju', 'Shan', 'Yak'];

const DEFAULT_STATE = () => ({
  version: 3,
  userName: 'Foydalanuvchi',
  habits: [],
  logs: [],
  tasks: [],
  settings: {
    focusMinutes: 25,
    shortMinutes: 5,
    longMinutes: 15,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  },
  pomodoro: {
    mode: 'focus',
    sessions: 0
  }
});

let state = DEFAULT_STATE();
let activePage = 'dashboard';
let activeFilter = 'all';
let showArchived = false;
let plannerDate = today();

let timerSeconds = 25 * 60;
let timerInterval = null;
let timerRunning = false;
let timerEndsAt = null;
let toastTimeout = null;

let activeStorageKey = STORAGE_KEY;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = parseDate(s);
  return !Number.isNaN(d.getTime()) && localDateString(d) === String(s);
}

function normalizeCategory(category) {
  return Object.hasOwn(CATEGORIES, category) ? category : 'focus';
}

function normalizeHabit(habit) {
  if (!habit || typeof habit !== 'object') return null;

  const title = String(
    habit.title ?? habit.name ?? habit.text ?? ''
  ).trim().slice(0, 80);

  if (!title) return null;

  const target = Number(
    habit.targetDays ??
    habit.target_days ??
    habit.frequency ??
    habit.daysPerWeek ??
    5
  );

  return {
    id: String(habit.id ?? uid()),
    title,
    category: normalizeCategory(habit.category),
    color: normalizeHabitColor(habit.color ?? habit.habitColor),
    icon: HABIT_ICONS.includes(habit.icon) ? habit.icon : (CATEGORY_ICONS[normalizeCategory(habit.category)] || DEFAULT_HABIT_ICON),
    targetDays: [3, 5, 6, 7].includes(target) ? target : 5,
    isArchived: Boolean(
      habit.isArchived ?? habit.is_archived ?? habit.archived
    ),
    createdAt: validDate(habit.createdAt) ? habit.createdAt : today()
  };
}

function normalizeState(raw) {
  const next = DEFAULT_STATE();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return next;

  next.userName = String(
    raw.userName ?? raw.profileName ?? raw.name ?? 'Foydalanuvchi'
  ).slice(0, 40) || 'Foydalanuvchi';

  next.habits = safeArray(raw.habits).map(normalizeHabit).filter(Boolean);

  const seen = new Set();
  const pushLog = (habitId, date) => {
    const id = String(habitId);
    const key = `${id}|${date}`;
    if (
      validDate(date) &&
      next.habits.some(h => h.id === id) &&
      !seen.has(key)
    ) {
      next.logs.push({ habitId: id, date });
      seen.add(key);
    }
  };

  if (Array.isArray(raw.logs)) {
    raw.logs.forEach(log => {
      if (!log || typeof log !== 'object') return;
      const habitId = log.habitId ?? log.habit_id;
      const date = log.date ?? log.completed_date ?? log.day;
      if (habitId != null) pushLog(habitId, String(date ?? ''));
    });
  }
  // Eski formatdagi checks faqat logs bo‘sh bo‘lsa ko‘chiriladi.
  // pushLog takroriy yozuvlarni seen Set orqali cheklaydi.
  if (next.logs.length === 0 && raw.checks && typeof raw.checks === 'object') {
    Object.entries(raw.checks).forEach(([key, value]) => {
      if (value !== true && value !== 1 && value !== 'true') return;
      const dateMatch = key.match(/\d{4}-\d{2}-\d{2}/);
      if (!dateMatch) return;
      const date = dateMatch[0];
      const habitId = key
        .replace(date, '')
        .replace(/[_|:/-]+$/, '')
        .replace(/^[_|:/-]+/, '');
      let habit = next.habits.find(h => h.id === habitId);
      if (!habit) {
        const reverse = key.slice(date.length)
          .replace(/^[_|:/-]+/, '')
          .replace(/[_|:/-]+$/, '');
        habit = next.habits.find(h => h.id === reverse);
      }
      if (habit) pushLog(habit.id, date);
    });
  }

  next.tasks = safeArray(raw.tasks)
    .filter(task => task && typeof task === 'object')
    .map(task => {
      const taskDate = task.date ?? task.dueDate ?? task.due_date;
      return {
        id: String(task.id ?? uid()),
        title: String(task.title ?? task.name ?? task.text ?? '')
          .trim().slice(0, 120),
        date: validDate(taskDate) ? String(taskDate) : today(),
        priority: ['high', 'medium', 'low'].includes(task.priority) ? task.priority : 'medium',
        time: /^([01]\d|2[0-3]):[0-5]\d$/.test(String(task.time || '')) ? String(task.time) : '',
        reminderMinutes: clampInt(task.reminderMinutes ?? task.reminder_minutes, 0, 10080, 10),
        done: Boolean(task.done ?? task.completed ?? task.is_done)
      };
    })
    .filter(task => task.title);

  const settings = raw.settings && typeof raw.settings === 'object'
    ? raw.settings
    : {};

  next.settings = {
    focusMinutes: clampInt(
      settings.focusMinutes ?? settings.focus ?? raw.focusMinutes,
      1, 120, 25
    ),
    shortMinutes: clampInt(
      settings.shortMinutes ?? settings.shortBreakMinutes ?? 5,
      1, 30, 5
    ),
    longMinutes: clampInt(
      settings.longMinutes ?? settings.longBreakMinutes ?? 15,
      1, 60, 15
    ),
    timeZone: isValidTimeZone(settings.timeZone) ? settings.timeZone : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')
  };

  const rawMode = raw.pomodoro?.mode;
  next.pomodoro = {
    mode: ['focus', 'short', 'long'].includes(rawMode) ? rawMode : 'focus',
    sessions: Math.max(0, Number(raw.pomodoro?.sessions) || 0)
  };

  return next;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  return Number.isFinite(n)
    ? Math.min(max, Math.max(min, Math.round(n)))
    : fallback;
}

/* ==============================
   AVTOMATIK ZAXIRA NUSXASI
============================== */

function backupKey(storageKey = activeStorageKey) {
  return `${storageKey}__backup_v1`;
}

function backupMetaKey(storageKey = activeStorageKey) {
  return `${storageKey}__backup_v1_meta`;
}

function createBackup(storageKey = activeStorageKey) {
  try {
    const current = localStorage.getItem(storageKey);
    if (!current) return false;

    const parsed = JSON.parse(current);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.habits)) {
      return false;
    }

    localStorage.setItem(backupKey(storageKey), current);
    localStorage.setItem(
      backupMetaKey(storageKey),
      JSON.stringify({ savedAt: new Date().toISOString() })
    );
    return true;
  } catch (error) {
    console.warn('Avtomatik zaxira yaratilmadi:', error);
    return false;
  }
}

function getBackupInfo(storageKey = activeStorageKey) {
  try {
    const data = localStorage.getItem(backupKey(storageKey));
    if (!data) return { available: false, savedAt: null };

    const parsed = JSON.parse(data);
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.habits)) {
      return { available: false, savedAt: null };
    }

    const meta = JSON.parse(
      localStorage.getItem(backupMetaKey(storageKey)) || '{}'
    );

    return {
      available: true,
      savedAt: meta.savedAt || null
    };
  } catch (error) {
    return { available: false, savedAt: null };
  }
}

function restoreBackup() {
  const info = getBackupInfo();
  if (!info.available) {
    notify('Avtomatik zaxira nusxasi topilmadi.');
    renderSettings();
    return;
  }

  if (!confirm(
    'Avtomatik zaxira nusxasini tiklash hozirgi ma’lumotlaringizni almashtiradi. Davom etasizmi?'
  )) return;

  try {
    const raw = localStorage.getItem(backupKey());
    const parsed = JSON.parse(raw);

    // Tiklashdan oldin hozirgi holatni zaxiraga olamiz.
    createBackup(activeStorageKey);

    state = normalizeState(parsed);
    pauseTimer();
    timerSeconds = modeDuration(state.pomodoro.mode);
    plannerDate = today();

    saveState();
    renderAll();
    notify('Avtomatik zaxira nusxasi tiklandi.');
  } catch (error) {
    console.error('Zaxirani tiklashda xatolik:', error);
    notify('Zaxira nusxasini tiklab bo‘lmadi.');
  }
}

/* ==============================
   LOCAL STORAGE VA BULUTGA XABAR
============================== */

function migrateOldData() {
  for (const key of OLD_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const converted = normalizeState(JSON.parse(raw));
      if (converted.habits.length || converted.logs.length || converted.tasks.length) {
        state = converted;
        saveState();
        return true;
      }
    } catch (error) {
      console.warn('Eski ma’lumotlarni ko‘chirish imkoni bo‘lmadi:', error);
    }
  }
  return false;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch (error) {
    console.warn('Saqlangan ma’lumotlarni o‘qib bo‘lmadi:', error);
  }
  state = DEFAULT_STATE();
  migrateOldData();
  return state;
}

function saveState() {
  try {
    // Joriy saqlangan holatni yangilashdan oldin zaxiralaymiz.
    createBackup(activeStorageKey);

    localStorage.setItem(activeStorageKey, JSON.stringify(state));

    // Supabase moduli kutadigan hodisa va detail shakli o‘zgartirilmagan.
    window.dispatchEvent(
      new CustomEvent('vertex:state-saved', {
        detail: {
          state: JSON.parse(JSON.stringify(state)),
          storageKey: activeStorageKey
        }
      })
    );
  } catch (error) {
    console.error('Saqlash xatosi:', error);
    notify('Ma’lumotni saqlab bo‘lmadi. Brauzer xotirasini tekshiring.');
  }
}

function notify(message) {
  const element = $('#toast');
  if (!element) {
    console.log(message);
    return;
  }
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => element.classList.remove('show'), 2800);
}

window.VertexApp = {
  getState() {
    return JSON.parse(JSON.stringify(state));
  },
  getGuestState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : DEFAULT_STATE();
    } catch (error) {
      console.error('Mehmon ma’lumotlarini o‘qishda xatolik:', error);
      return DEFAULT_STATE();
    }
  },
  getStorageKey() {
    return activeStorageKey;
  },
  setState(raw, storageKey = STORAGE_KEY) {
    pauseTimer();
    activeStorageKey = storageKey;
    state = normalizeState(raw);
    plannerDate = today();
    restoreTimer();
    try {
      // Bulutdan yuklangan holat qayta bulutga yuborilmasligi uchun
      // bu yerda saveState() yoki state-saved hodisasi chaqirilmaydi.
      localStorage.setItem(activeStorageKey, JSON.stringify(state));
    } catch (error) {
      console.error('Holatni saqlashda xatolik:', error);
    }
    if ($('#todayPercent')) renderAll();
    if (timerRunning) runTimerInterval();
  },
  notify(message) {
    notify(message);
  }
};

/* ==============================
   YORDAMCHI FUNKSIYALAR
============================== */

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function dateLabel(date, options = { day: 'numeric', month: 'short' }) {
  return parseDate(date).toLocaleDateString('uz-UZ', options);
}

function isChecked(habitId, date) {
  return state.logs.some(log => log.habitId === habitId && log.date === date);
}

function toggleCheck(habitId, date) {
  if (date > today()) {
    notify('Kelajakdagi kunni belgilab bo‘lmaydi.');
    return;
  }
  // Seriya ko‘rsatkichini o‘zgarishdan oldin saqlaymiz — milestone faqat yangi bosqichga chiqqanda beriladi.
  const previousStreak = date === today() ? currentStreak() : 0;
  const index = state.logs.findIndex(
    log => log.habitId === habitId && log.date === date
  );
  const newlyCompleted = index < 0;
  if (index >= 0) state.logs.splice(index, 1);
  else state.logs.push({ habitId, date });
  saveState();
  renderAll();
  if (newlyCompleted && date === today()) {
    const nextStreak = currentStreak();
    const milestone = [3, 7, 14, 30, 100].find(value => previousStreak < value && nextStreak >= value);
    if (milestone) celebrateStreakMilestone(milestone);
    else celebrateCompletion('Odat bajarildi!');
  }
}

/* ==============================
   COMPLETION CELEBRATION
============================== */
/* ==============================
   PREMIUM DISCIPLINE CELEBRATION
   Original layered chime built with Web Audio (not a copy of Apple's sound).
============================== */
let vertexCelebrationContext = null;
function playCelebrationAudio(volume = 0.58) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = vertexCelebrationContext || (vertexCelebrationContext = new AudioContextClass());
    const startAt = ctx.currentTime + 0.035;
    const master = ctx.createGain();
    master.gain.setValueAtTime(Math.max(0.02, Math.min(0.8, volume)) * 0.42, startAt);
    master.connect(ctx.destination);

    // Clean crystal-like chord: soft fundamental + bright upper partials.
    const notes = [
      { f: 659.25, t: 0.00, d: 1.45, g: 0.34 },
      { f: 830.61, t: 0.045, d: 1.25, g: 0.23 },
      { f: 987.77, t: 0.105, d: 1.10, g: 0.18 },
      { f: 1318.51, t: 0.18, d: 1.65, g: 0.12 },
      { f: 1975.53, t: 0.22, d: 1.25, g: 0.055 }
    ];
    notes.forEach((note, index) => {
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      const tone = ctx.createBiquadFilter();
      osc.type = index === 4 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(note.f, startAt + note.t);
      tone.type = 'lowpass';
      tone.frequency.setValueAtTime(index === 4 ? 4200 : 6200, startAt);
      env.gain.setValueAtTime(0.0001, startAt + note.t);
      env.gain.exponentialRampToValueAtTime(note.g, startAt + note.t + 0.018);
      env.gain.exponentialRampToValueAtTime(0.0001, startAt + note.t + note.d);
      osc.connect(tone); tone.connect(env); env.connect(master);
      osc.start(startAt + note.t);
      osc.stop(startAt + note.t + note.d + 0.04);
      osc.addEventListener?.('ended', () => { osc.disconnect(); tone.disconnect(); env.disconnect(); });
    });

    // Gentle high shimmer, kept quiet so it stays crisp rather than hissy.
    const shimmer = ctx.createOscillator();
    const shimmerEnv = ctx.createGain();
    shimmer.type = 'sine';
    shimmer.frequency.setValueAtTime(2637, startAt + 0.12);
    shimmerEnv.gain.setValueAtTime(0.0001, startAt + 0.12);
    shimmerEnv.gain.exponentialRampToValueAtTime(0.018, startAt + 0.16);
    shimmerEnv.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.95);
    shimmer.connect(shimmerEnv); shimmerEnv.connect(master);
    shimmer.start(startAt + 0.12); shimmer.stop(startAt + 1.0);
    window.setTimeout(() => { try { master.disconnect(); } catch (_) {} }, 2200);
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  } catch (error) {
    console.warn('Celebration chime could not play:', error);
  }
}

function playCompletionSound() {
  playCelebrationAudio(0.58);
}

function showConfetti(options = {}) {
  const previous = document.querySelector('.vertex-celebration');
  if (previous) previous.remove();

  const milestone = Boolean(options.milestone);
  const overlay = document.createElement('div');
  overlay.className = `vertex-celebration vertex-discipline-celebration${milestone ? ' vertex-celebration-milestone' : ''}`;
  overlay.setAttribute('aria-hidden', 'true');

  const fragment = document.createDocumentFragment();
  const stickers = [
    { icon: '🏋️', label: 'Kuch' },
    { icon: '💪', label: 'Intizom' },
    { icon: '🥇', label: 'Maqsad' },
    { icon: '🎯', label: 'Fokus' },
    { icon: '🛡️', label: 'Matonat' },
    { icon: '🏃', label: 'Harakat' },
    { icon: '🔥', label: 'Shijoat' },
    { icon: '⛰️', label: 'O‘sish' },
    { icon: '⚡', label: 'Quvvat' },
    { icon: '🏆', label: 'G‘alaba' }
  ];
  const count = milestone ? 24 : 16;
  for (let i = 0; i < count; i += 1) {
    const sticker = stickers[Math.floor(Math.random() * stickers.length)];
    const piece = document.createElement('span');
    piece.className = 'vertex-discipline-sticker';
    piece.textContent = sticker.icon;
    piece.title = sticker.label;
    piece.style.setProperty('--x', `${5 + Math.random() * 90}vw`);
    piece.style.setProperty('--delay', `${Math.random() * 0.55}s`);
    piece.style.setProperty('--duration', `${3.8 + Math.random() * 1.8}s`);
    piece.style.setProperty('--drift', `${(Math.random() - 0.5) * 100}px`);
    piece.style.setProperty('--spin', `${Math.round(Math.random() * 42 - 21)}deg`);
    piece.style.setProperty('--size', `${36 + Math.random() * 18}px`);
    fragment.appendChild(piece);
  }

  overlay.appendChild(fragment);
  document.body.appendChild(overlay);
  window.setTimeout(() => overlay.remove(), milestone ? 6500 : 6000);
}

function playMilestoneSound() {
  playCelebrationAudio(0.68);
}

function celebrateCompletion(message = 'Ajoyib! Vazifa bajarildi!') {
  showConfetti();
  playCompletionSound();
  notify(message);
}

function getHabitLogs(habitId, from, to) {
  return state.logs.filter(
    log => log.habitId === habitId && log.date >= from && log.date <= to
  );
}

function streakForHabit(habitId) {
  let date = today();
  let count = 0;
  if (!isChecked(habitId, date)) date = shiftDate(date, -1);
  for (let i = 0; i < 500; i++) {
    if (isChecked(habitId, date)) {
      count++;
      date = shiftDate(date, -1);
    } else break;
  }
  return count;
}

function currentStreak() {
  let date = today();
  let count = 0;
  const active = state.habits.filter(habit => !habit.isArchived);
  const hasAny = day => active.some(habit => isChecked(habit.id, day));
  if (!hasAny(date)) date = shiftDate(date, -1);
  for (let i = 0; i < 500; i++) {
    if (hasAny(date)) {
      count++;
      date = shiftDate(date, -1);
    } else break;
  }
  return count;
}

function xpTotal() {
  return state.logs.length * 10;
}

function activeHabits() {
  return state.habits.filter(habit => !habit.isArchived);
}

function doneCountOn(date) {
  return activeHabits().filter(habit => isChecked(habit.id, date)).length;
}

function todayRate() {
  const habits = activeHabits();
  return habits.length ? Math.round(doneCountOn(today()) / habits.length * 100) : 0;
}

function rateForDays(days) {
  const habits = activeHabits();
  if (!habits.length) return 0;
  const end = today();
  const start = shiftDate(end, -(days - 1));
  let done = 0;
  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    done += habits.filter(habit => isChecked(habit.id, date)).length;
  }
  return Math.round(done / (habits.length * days) * 100);
}

function weekDates(anchor = today()) {
  const start = weekStart(anchor);
  return Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
}

function categoryLabel(category) {
  return CATEGORIES[category] || 'Fokus';
}

/* ==============================
   SAHIFALAR
============================== */

function goTo(page) {
  if (!$('#page-' + page)) return;
  activePage = page;
  $$('.page').forEach(element => {
    element.classList.toggle('active', element.id === `page-${page}`);
  });
  $$('.nav-item[data-page]').forEach(button => {
    button.classList.toggle('active', button.dataset.page === page);
  });
  const names = {
    dashboard: 'UMUMIY KO‘RINISH',
    habits: 'ODATLAR',
    planner: 'REJALASHTIRUVCHI',
    pomodoro: 'FOKUS TAYMERI',
    analytics: 'TAHLIL',
    achievements: 'YUTUQLAR',
    settings: 'SOZLAMALAR'
  };
  $('#pageCrumb').textContent = names[page] || page.toUpperCase();
  $('#sidebar').classList.remove('open');
  if (page === 'planner') renderPlanner();
  if (page === 'pomodoro') renderTimer();
  if (page === 'analytics') renderAnalytics();
  if (page === 'achievements') renderAchievements();
  if (page === 'settings') renderSettings();
}

function openModal(id) {
  const element = $('#' + id);
  if (!element) return;
  element.classList.remove('hidden');
  const input = $('input:not([type=hidden]), select', element);
  if (input) setTimeout(() => input.focus(), 30);
}

function closeModals() {
  $$('.modal-backdrop').forEach(element => element.classList.add('hidden'));
}

function updateHabitPickerSelection() {
  $$('.habit-choice-icon').forEach(button => {
    const selected = button.dataset.habitIcon === selectedHabitIcon;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
  $$('.habit-choice-color').forEach(button => {
    const selected = button.dataset.habitColor === selectedHabitColor;
    button.classList.toggle('selected', selected);
    button.setAttribute('aria-pressed', String(selected));
  });
}

function openHabitModal(habit = null) {
  $('#habitForm').reset();
  $('#habitId').value = habit?.id || '';
  $('#habitTitle').value = habit?.title || '';
  $('#habitCategory').value = habit?.category || 'focus';
  $('#habitTarget').value = String(habit?.targetDays || 5);
  selectedHabitColor = normalizeHabitColor(habit?.color);
  selectedHabitIcon = habit?.icon || CATEGORY_ICONS[habit?.category] || DEFAULT_HABIT_ICON;
  updateHabitPickerSelection();
  $('#habitModalTitle').textContent = habit ? 'Odatni tahrirlash' : 'Yangi odat';
  openModal('habitModalBackdrop');
}

function openTaskModal() {
  $('#taskForm').reset();
  $('#taskDateInput').value = plannerDate;
  $('#taskTimeInput').value = '';
  $('#taskReminderInput').value = '10';
  openModal('taskModalBackdrop');
}

/* ==============================
   ODATLAR
============================== */

function addHabit(data) {
  state.habits.unshift({
    id: uid(),
    title: data.title.trim(),
    category: data.category,
    icon: data.icon || DEFAULT_HABIT_ICON,
    color: normalizeHabitColor(data.color),
    targetDays: Number(data.targetDays),
    isArchived: false,
    createdAt: today()
  });
  saveState();
  renderAll();
  notify('Yangi odat qo‘shildi.');
}

function updateHabit(id, data) {
  const habit = state.habits.find(item => item.id === id);
  if (!habit) return;
  habit.title = data.title.trim();
  habit.category = data.category;
  habit.icon = data.icon || habitIcon(habit);
  habit.color = normalizeHabitColor(data.color);
  habit.targetDays = Number(data.targetDays);
  saveState();
  renderAll();
  notify('Odat yangilandi.');
}

function deleteHabit(id) {
  const habit = state.habits.find(item => item.id === id);
  if (!habit) return;
  if (!window.confirm(`“${habit.title}” odatini o‘chirishni tasdiqlaysizmi?\n\nUning bajarilgan kunlari tarixi ham o‘chadi. Bu amalni ortga qaytarib bo‘lmaydi.`)) return;
  state.habits = state.habits.filter(item => item.id !== id);
  state.logs = state.logs.filter(log => log.habitId !== id);
  saveState();
  renderAll();
  notify('Odat o‘chirildi.');
}

function archiveHabit(id) {
  const habit = state.habits.find(item => item.id === id);
  if (!habit) return;
  habit.isArchived = !habit.isArchived;
  saveState();
  renderAll();
  notify(habit.isArchived ? 'Odat arxivlandi.' : 'Odat arxivdan qaytarildi.');
}

/* ==============================
   HEADER VA STATISTIKA
============================== */

function renderHeader() {
  const date = parseDate(today());
  $('#todayLabel').textContent = date.toLocaleDateString('uz-UZ', {
    day: 'numeric', month: 'short', year: 'numeric'
  }).toUpperCase();
  $('#footerDate').textContent = date.toLocaleDateString('uz-UZ', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
  const name = state.userName || 'Foydalanuvchi';
  $('#sidebarName').textContent = name;
  $('#sidebarAvatar').textContent = (name.trim()[0] || 'U').toUpperCase();
  $('#userNameInput').value = name;
  const hour = new Date().getHours();
  $('#greetingTitle').textContent = hour < 12
    ? 'Xayrli tong, ' + name + '!'
    : hour < 18
      ? 'Kuningiz samarali o‘tsin, ' + name + '!'
      : 'Xayrli kech, ' + name + '!';
}

function renderStats() {
  const active = activeHabits();
  const done = doneCountOn(today());
  const percent = todayRate();
  const xp = xpTotal();
  const level = Math.floor(xp / 100) + 1;
  $('#todayPercent').textContent = percent + '%';
  $('#todayDoneText').textContent = `${done} / ${active.length} bajarildi`;
  $('#todayProgress').style.width = percent + '%';
  $('#currentStreak').innerHTML = `${currentStreak()} <small>kun</small>`;
  $('#xpValue').innerHTML = `${xp} <small>XP</small>`;
  $('#levelLabel').textContent = `${level}-daraja · keyingi darajagacha ${100 - (xp % 100)} XP`;
  $('#levelProgress').style.width = (xp % 100) + '%';
  const adherence = rateForDays(30);
  $('#adherenceValue').textContent = adherence + '%';
  $('#adherenceProgress').style.width = adherence + '%';
}

function renderWeekStrip() {
  const dates = weekDates();
  $('#weekStrip').innerHTML = dates.map((date, index) => `
    <div class="week-day ${date === today() ? 'today' : ''} ${doneCountOn(date) > 0 ? 'done' : ''}">
      <span class="day-name">${DAY_NAMES[index]}</span>
      <span class="day-num">${parseDate(date).getDate()}</span>
      <span class="day-dot"></span>
    </div>
  `).join('');
}

function renderDashboardHabits() {
  const habits = activeHabits().slice(0, 5);
  const box = $('#dashboardHabits');
  box.innerHTML = habits.map(habit => `
    <div class="habit-preview">
      <span class="habit-glyph" style="${habitAccent(habit)}">${habitIcon(habit)}</span>
      <div class="habit-preview-info">
        <strong>${escapeHTML(habit.title)}</strong>
        <small>${escapeHTML(categoryLabel(habit.category))} · ${streakForHabit(habit.id)} kunlik seriya</small>
      </div>
      <button class="check-button ${isChecked(habit.id, today()) ? 'checked' : ''}" style="${habitAccent(habit)}"
        data-toggle-check="${escapeHTML(habit.id)}" data-date="${today()}"
        aria-label="Odat holatini o‘zgartirish">${isChecked(habit.id, today()) ? '✓' : '○'}</button>
    </div>
  `).join('');
  $('#dashboardEmpty').classList.toggle('hidden', habits.length > 0);
  box.classList.toggle('hidden', habits.length === 0);
}

function renderDashboardTasks() {
  const tasks = state.tasks
    .filter(task => task.date === today())
    .sort((a, b) => Number(a.done) - Number(b.done))
    .slice(0, 4);
  $('#dashboardTasks').innerHTML = tasks.map(task => `
    <div class="task-row">
      <button class="task-check ${task.done ? 'done' : ''}" data-toggle-task="${escapeHTML(task.id)}"
        aria-label="Vazifa holatini o‘zgartirish">${task.done ? '✓' : ''}</button>
      <span class="task-title ${task.done ? 'done' : ''}">${escapeHTML(task.title)}</span>
      <span class="task-date">${task.done ? 'BAJARILDI' : 'BUGUN'}</span>
    </div>
  `).join('');
  $('#dashboardTasksEmpty').classList.toggle('hidden', tasks.length > 0);
}


function renderSmartDashboard() {
  const active = activeHabits();
  const done = doneCountOn(today());
  const todayPct = todayRate();
  const weekPct = rateForDays(7);
  const monthPct = rateForDays(30);
  const incomplete = active.length - done;
  // Iqtiboslar o‘zbekchaga mazmunan tarjima qilingan; har kuni bittasi ko‘rsatiladi.
  const quotes = [
    { text: 'Yaxshi bajarilgan ish, yaxshi aytilgan gapdan afzaldir.', author: 'Benjamin Franklin' },
    { text: 'Qayerda bo‘lsang, o‘sha yerdan boshla. Bor narsangdan foydalan va qo‘lingdan kelganini qil.', author: 'Arthur Ashe' },
    { text: 'Hech narsa harakat qilmaguningizcha amalga oshmaydi.', author: 'Maya Angelou' },
    { text: 'Buyuk ishlar bir-biriga qo‘shilgan ko‘plab kichik ishlardan bunyod bo‘ladi.', author: 'Vincent van Gogh' },
    { text: 'Ishonch bilan boshlang: yo‘lning yarmi bosib o‘tilgan bo‘ladi.', author: 'Theodore Roosevelt' },
    { text: 'Energiya va qat’iyat har qanday to‘siqni yengadi.', author: 'Benjamin Franklin' },
    { text: 'Muvaffaqiyat — kundan-kunga takrorlangan kichik sa’y-harakatlar yig‘indisi.', author: 'Robert Collier' },
    { text: 'Kelajak bugun qilayotgan ishlaringizga bog‘liq.', author: 'Mahatma Gandhi' },
    { text: 'Bilimning yagona manbai — tajriba.', author: 'Albert Einstein' },
    { text: 'Sabr va qat’iyat bilan deyarli hamma narsaga erishish mumkin.', author: 'Benjamin Franklin' },
    { text: 'Orzularingiz yo‘nalishini ishonch bilan tanlang va hayotingizni shunga mos yashang.', author: 'Henry David Thoreau' },
    { text: 'Muvaffaqiyatli bo‘lishga emas, foydali bo‘lishga intiling.', author: 'Albert Einstein' },
    { text: 'Intizom — maqsadlar va natijalar orasidagi ko‘prikdir.', author: 'Jim Rohn' },
    { text: 'Boshlash uchun buyuk bo‘lish shart emas, ammo buyuk bo‘lish uchun boshlash kerak.', author: 'Zig Ziglar' },
    { text: 'Kichik odatlar katta o‘zgarishlarga olib keladi.', author: 'James Clear' },
    { text: 'O‘zingizni kechagidan yaxshiroq qilishga intiling.', author: 'Ernest Hemingway' },
    { text: 'Qiyinchiliklar insonning imkoniyatlarini yuzaga chiqaradi.', author: 'Epictetus' },
    { text: 'Harakat — barcha muvaffaqiyatlarning asosidir.', author: 'Pablo Picasso' },
    { text: 'Vaqtingizni qadrlang: hayot aynan undan tashkil topadi.', author: 'Benjamin Franklin' },
    { text: 'Maqsad sari sekin yurish ham to‘xtab qolishdan yaxshiroq.', author: 'Confucius' },
    { text: 'O‘z ustingizda ishlash — eng foydali sarmoyadir.', author: 'Warren Buffett' },
    { text: 'Bugun qilishingiz mumkin bo‘lgan ishni ortga surmang.', author: 'Benjamin Franklin' },
    { text: 'Buyuk maqsadlarga kichik, ammo izchil qadamlar bilan erishiladi.', author: 'Bruce Lee' },
    { text: 'Bilimning boshlanishi — o‘z bilimsizligingni anglash.', author: 'Socrates' },
    { text: 'O‘zingni yengish — eng katta g‘alabadir.', author: 'Plato' },
    { text: 'Biz qayta-qayta qiladigan ishlarimiz bilan shakllanamiz. Mukammallik esa odatdir.', author: 'Aristotle' },
    { text: 'Qiyinchiliklar insonni chiniqtiradi.', author: 'Seneca' },
    { text: 'Baxt hayot sharoitiga emas, fikrlash tarziga bog‘liq.', author: 'Marcus Aurelius' },
    { text: 'To‘siqning o‘zi yo‘lga aylanadi.', author: 'Marcus Aurelius' },
    { text: 'Shoshilma, lekin to‘xtama.', author: 'Johann Wolfgang von Goethe' },
    { text: 'Bilim — kuchdir.', author: 'Francis Bacon' },
    { text: 'O‘qish insonni to‘ldiradi, suhbat tayyorlaydi, yozish esa aniqlik beradi.', author: 'Francis Bacon' },
    { text: 'Kelajakni bashorat qilishning eng yaxshi yo‘li — uni yaratish.', author: 'Peter Drucker' },
    { text: 'Muvaffaqiyat — tayyorgarlik va imkoniyat uchrashgan nuqta.', author: 'Seneca' },
    { text: 'Hech qachon xato qilmagan odam, yangi narsani sinab ko‘rmagan bo‘lishi mumkin.', author: 'Albert Einstein' },
    { text: 'Tasavvur bilimdan muhimroq.', author: 'Albert Einstein' },
    { text: 'Hayot velosiped haydashga o‘xshaydi: muvozanatni saqlash uchun harakatda bo‘lish kerak.', author: 'Albert Einstein' },
    { text: 'Agar kichik ishlarni yaxshi bajarsang, katta ishlar o‘z-o‘zidan yaqinlashadi.', author: 'Dale Carnegie' },
    { text: 'Odamlar nima deganini emas, nima qilayotganini kuzat.', author: 'Ralph Waldo Emerson' },
    { text: 'O‘zing bo‘l; qolgan o‘rinlar band.', author: 'Oscar Wilde' },
    { text: 'Tajriba — xatolaringga bergan noming.', author: 'Oscar Wilde' },
    { text: 'Har bir kunni hayotingdagi eng yaxshi kunga aylantirishga intil.', author: 'Ralph Waldo Emerson' },
    { text: 'Orzularingni kichraytirma; harakatingni kuchaytir.', author: 'Johann Wolfgang von Goethe' },
    { text: 'Sabr achchiq, ammo mevasi shirin.', author: 'Jean-Jacques Rousseau' },
    { text: 'O‘zgarish — hayot qonuni.', author: 'John F. Kennedy' },
    { text: 'Buyuk ishlar kuch bilan emas, qat’iyat bilan bajariladi.', author: 'Samuel Johnson' },
    { text: 'Muvaffaqiyatning siri — boshlash.', author: 'Mark Twain' },
    { text: 'Yigirma yildan keyin qilmagan ishlaringdan ko‘proq afsuslanishing mumkin.', author: 'Mark Twain' },
    { text: 'Maqsadga yetishning siri — boshlashdir.', author: 'Mark Twain' },
    { text: 'Kelajak bugun qilayotgan ishlaringga bog‘liq.', author: 'Mahatma Gandhi' },
    { text: 'Dunyoda ko‘rmoqchi bo‘lgan o‘zgarishingning o‘zi bo‘l.', author: 'Mahatma Gandhi' },
    { text: 'Katta kuch oddiylikda yashaydi.', author: 'Leonardo da Vinci' },
    { text: 'O‘rganish hech qachon aqlni charchatmaydi.', author: 'Leonardo da Vinci' },
    { text: 'Yaxshi boshlanish — ishning yarmi.', author: 'Aristotle' },
    { text: 'Sifat tasodif emas; u doimo ongli sa’y-harakat natijasidir.', author: 'John Ruskin' },
    { text: 'Muvaffaqiyat — ishtiyoqni yo‘qotmasdan muvaffaqiyatsizlikdan muvaffaqiyatsizlikka o‘tishdir.', author: 'Winston Churchill' },
    { text: 'Hech qachon, hech qachon, hech qachon taslim bo‘lma.', author: 'Winston Churchill' },
    { text: 'Intizom — maqsad va natija orasidagi ko‘prik.', author: 'Jim Rohn' },
    { text: 'Sen o‘zgarmasang, hech narsa o‘zgarmaydi.', author: 'Jim Rohn' },
    { text: 'Vaqting cheklangan, uni birovning hayotini yashashga sarflama.', author: 'Steve Jobs' },
    { text: 'Buyuk ish qilishning yagona yo‘li — qilayotgan ishingni sevish.', author: 'Steve Jobs' },
    { text: 'Oddiylik — eng oliy murakkablik.', author: 'Leonardo da Vinci' },
    { text: 'Ijodkorlik — intellektning zavqlanishidir.', author: 'Albert Einstein' },
    { text: 'Muvaffaqiyatga erishish uchun avval boshlash kerak.', author: 'Zig Ziglar' },
    { text: 'Odamlar ko‘pincha qobiliyat emas, qat’iyat yetishmagani uchun muvaffaqiyatsizlikka uchraydi.', author: 'Zig Ziglar' },
    { text: 'Kichik intizomlar har kuni takrorlansa, katta natijalarga olib keladi.', author: 'John C. Maxwell' },
    { text: 'Yetakchilik — lavozim emas, ta’sirdir.', author: 'John C. Maxwell' },
    { text: 'O‘zingga ishon, shunda yo‘lning yarmi bosib o‘tiladi.', author: 'Theodore Roosevelt' },
    { text: 'Imkoniyatlar kamdan-kam hollarda o‘z-o‘zidan keladi; ularni yaratish kerak.', author: 'George Bernard Shaw' },
    { text: 'Hayot o‘zingni topish emas, o‘zingni yaratishdir.', author: 'George Bernard Shaw' },
    { text: 'Aql hamma narsani biladi, donolik esa qaysi narsaga e’tibor berishni biladi.', author: 'William James' },
    { text: 'Harakat qilmasdan turib, chegaralaringni bilmaysan.', author: 'Bruce Lee' },
    { text: 'Muvaffaqiyatli jangchi — oddiy odam, ammo diqqatini lazerdek jamlay oladi.', author: 'Bruce Lee' },
    { text: 'Bilim yetarli emas, uni qo‘llash kerak; istak yetarli emas, harakat qilish kerak.', author: 'Johann Wolfgang von Goethe' },
    { text: 'O‘zgarishdan qo‘rqma; u yangi imkoniyatlar eshigidir.', author: 'Nelson Mandela' },
    { text: 'Ta’lim — dunyoni o‘zgartirish uchun ishlatish mumkin bo‘lgan eng kuchli qurol.', author: 'Nelson Mandela' },
    { text: 'Men hech qachon yutqazmayman: yo g‘alaba qilaman, yo o‘rganaman.', author: 'Nelson Mandela' },
    { text: 'Muvaffaqiyat — kichik sa’y-harakatlarni kundan-kunga takrorlashdir.', author: 'Robert Collier' },
    { text: 'O‘zingni boshqarishni o‘rgansang, hayotingni boshqarishni boshlaysan.', author: 'Plato' },
    { text: 'Sabr — donolikning hamrohi.', author: 'Augustine of Hippo' },
    { text: 'Vaqt eng qimmat boylikdir.', author: 'Theophrastus' },
    { text: 'Yaxshi hayot yaxshi fikrlash va yaxshi harakat qilishdan boshlanadi.', author: 'Aristotle' }
  ];
  // Mahalliy kalendar sanasi bo‘yicha indeks: UTC siljishi sabab bir iqtibos qotib qolmaydi.
  const localDateKey = new Intl.DateTimeFormat('en-CA', {year:'numeric', month:'2-digit', day:'2-digit'}).format(new Date());
  const [quoteYear, quoteMonth, quoteDay] = localDateKey.split('-').map(Number);
  const dayNumber = Math.floor(Date.UTC(quoteYear, quoteMonth - 1, quoteDay) / 86400000);
  const dayIndex = ((dayNumber % quotes.length) + quotes.length) % quotes.length;
  const dailyQuote = quotes[dayIndex];
  $('#dailyQuote').textContent = '“' + dailyQuote.text + '”';
  const quoteAuthor = $('#dailyQuoteAuthor');
  if (quoteAuthor) quoteAuthor.textContent = '— ' + dailyQuote.author;

  let title = 'Bugun yangi imkoniyat.';
  let message = active.length
    ? `Bugun ${done}/${active.length} ta odat bajarildi. Kichik qadamlaringizni davom ettiring.`
    : 'Birinchi odatingizni qo‘shing — Vertex sizning rivojlanishingizni kuzatishni boshlaydi.';
  if (active.length && todayPct >= 100) {
    title = 'Ajoyib! Bugungi odatlaringiz bajarildi.';
    message = 'Bugungi rejangizni uddaladingiz. Endi natijani mustahkamlash va dam olish vaqti.';
  } else if (todayPct >= 60) {
    title = 'Yaxshi sur’atdasiz — davom eting!';
    message = `${incomplete} ta odat qoldi. Ularni bittadan yakunlash bugungi natijangizni yanada yaxshilaydi.`;
  } else if (done > 0) {
    title = 'Boshladingiz — endi davomiylik muhim.';
    message = `Bugungi odatlaringizning ${todayPct}% bajarildi. Keyingi kichik vazifani tanlang.`;
  } else if (active.length) {
    title = 'Birinchi odatni bajarishdan boshlang.';
    message = 'Hozir eng oson odatingizni tanlang. Kichik g‘alaba kuningizga turtki beradi.';
  }
  $('#smartInsightTitle').textContent = title;
  $('#smartInsightText').textContent = message;

  $('#weeklyGoalValue').textContent = weekPct + '%';
  $('#weeklyGoalBar').style.width = Math.min(100, weekPct / 70 * 100) + '%';
  $('#monthlyGoalValue').textContent = monthPct + '%';
  $('#monthlyGoalBar').style.width = Math.min(100, monthPct / 80 * 100) + '%';
  $('#goalFootnote').textContent = weekPct >= 70 && monthPct >= 80
    ? 'Ikkala izchillik maqsadiga ham yetdingiz. Zo‘r natija!'
    : weekPct >= 70
      ? 'Haftalik maqsad bajarildi — oylik izchillikni ham davom ettiring.'
      : 'Maqsadlar yo‘nalish beradi. Bugungi kichik qadamni bajaring.';
}

function renderSmartDailyAnalysis() {
  const metrics = $('#dailyAnalysisMetrics');
  const details = $('#dailyAnalysisDetails');
  if (!metrics || !details) return;

  const habits = activeHabits();
  if (!habits.length) {
    metrics.innerHTML = [
      ['0', 'Faol odatlar'], ['0%', 'Bugungi natija'], ['—', 'Kecha bilan farq']
    ].map(([value, label]) => `<div class="daily-analysis-metric"><strong>${value}</strong><span>${label}</span></div>`).join('');
    details.innerHTML = '<p class="daily-analysis-empty">Kunlik tahlilni boshlash uchun avval odat qo‘shing.</p>';
    return;
  }

  const done = doneCountOn(today());
  const remaining = Math.max(0, habits.length - done);
  const todayPct = Math.round(done / habits.length * 100);
  const yesterdayPct = Math.round(doneCountOn(shiftDate(today(), -1)) / habits.length * 100);
  const difference = todayPct - yesterdayPct;
  const differenceLabel = difference > 0 ? `+${difference}%` : difference < 0 ? `${difference}%` : '0%';
  const differenceText = difference > 0 ? 'kechagidan yuqori' : difference < 0 ? 'kechagidan past' : 'kecha bilan bir xil';

  metrics.innerHTML = [
    [`${done}/${habits.length}`, 'Bajarilgan odatlar'],
    [`${todayPct}%`, 'Bugungi natija'],
    [differenceLabel, 'Kecha bilan farq']
  ].map(([value, label]) => `<div class="daily-analysis-metric"><strong>${value}</strong><span>${label}</span></div>`).join('');

  const ranked = habits.map(habit => ({
    habit,
    rate: Math.round(getHabitLogs(habit.id, shiftDate(today(), -6), today()).length / 7 * 100),
    doneToday: isChecked(habit.id, today())
  })).sort((a, b) => b.rate - a.rate);
  const strongest = ranked[0];
  const focus = [...ranked].reverse().find(item => !item.doneToday) || ranked[ranked.length - 1];
  const status = remaining === 0
    ? 'Bugungi odatlaringizning barchasi bajarildi. Natijani saqlab qolish uchun o‘zingizga vaqt ajrating.'
    : `${remaining} ta odat hali bajarilmadi. Ulardan bittasini tanlab, kichik qadam bilan boshlang.`;

  details.innerHTML = `
    <p class="daily-analysis-summary">${status} <span>${differenceText}.</span></p>
    <div class="daily-analysis-habits">
      <div><small>ENG BARQAROR ODAT · 7 KUN</small><strong>${escapeHTML(strongest.habit.title)}</strong><span>${strongest.rate}% bajarilgan</span></div>
      <div><small>E’TIBOR TALAB QILADI</small><strong>${escapeHTML(focus.habit.title)}</strong><span>${focus.doneToday ? 'Bugun bajarildi' : 'Bugun hali belgilanmagan'} · 7 kunlik natija ${focus.rate}%</span></div>
    </div>`;
}

function renderSmartCoach() {
  const habits = activeHabits();
  const end = today();
  const start = shiftDate(end, -6);
  const totalPossible = habits.length * 7;
  const totalDone = state.logs.filter(log => log.date >= start && log.date <= end && habits.some(h => h.id === log.habitId)).length;
  const rate = totalPossible ? Math.round(totalDone / totalPossible * 100) : 0;
  const rateNode = $('#coachWeekRate');
  const headline = $('#coachHeadline');
  const advice = $('#coachAdvice');
  const insights = $('#coachInsights');
  if (!rateNode || !headline || !advice || !insights) return;
  rateNode.textContent = rate + '%';
  if (!habits.length) {
    headline.textContent = 'Avval odat qo‘shing';
    advice.textContent = 'Birinchi odatingizni yarating. Vertex uning bajarilishini kuzatib, keyin shaxsiy tavsiyalar beradi.';
    insights.innerHTML = '<span class="coach-chip">🎯 Boshlash uchun bitta kichik odat tanlang</span>';
    return;
  }
  const ranked = habits.map(h => {
    const count = getHabitLogs(h.id, start, end).length;
    return { habit: h, count, pct: Math.round(count / 7 * 100) };
  }).sort((a,b) => b.pct - a.pct);
  const weakest = [...ranked].sort((a,b) => a.pct - b.pct)[0];
  if (rate >= 80) {
    headline.textContent = 'Barqarorlik yaxshi ketmoqda!';
    advice.textContent = 'Mavjud tartibingizni saqlang. Yangi odat qo‘shishdan oldin hozirgilarini muntazam davom ettiring.';
  } else if (rate >= 50) {
    headline.textContent = 'Yaxshi poydevor bor — izchillikni oshiring.';
    advice.textContent = `Keyingi qadam: “${weakest.habit.title}” odatini qulayroq vaqtga rejalashtiring va bugun uning eng kichik variantini bajaring.`;
  } else {
    headline.textContent = 'Kichik qadamdan qayta boshlang.';
    advice.textContent = `Hozircha “${weakest.habit.title}” odatiga e’tibor qarating. Uni juda kichik vazifaga ajrating va bajarilgach belgilang.`;
  }
  const best = ranked[0];
  const items = [
    `<span class="coach-chip">🏅 Eng izchil: <b>${escapeHTML(best.habit.title)}</b> · ${best.pct}%</span>`,
    `<span class="coach-chip">🌱 E’tibor kerak: <b>${escapeHTML(weakest.habit.title)}</b> · ${weakest.pct}%</span>`,
    `<span class="coach-chip">📌 7 kunda: <b>${totalDone}</b> / ${totalPossible} bajarilish</span>`
  ];
  insights.innerHTML = items.join('');
}


function renderPersonalCoach() {
  const metrics = $('#personalCoachMetrics');
  const advice = $('#personalCoachAdvice');
  const action = $('#personalCoachAction');
  if (!metrics || !advice || !action) return;
  const habits = activeHabits();
  if (!habits.length) {
    metrics.innerHTML = '<span class="coach-metric">Hali odatlar yo‘q</span>';
    advice.textContent = 'Birinchi odatingizni qo‘shing. Yetarli tarix yig‘ilgach, Coach natijalarni taqqoslaydi.';
    action.textContent = 'Bugun bajarish oson bo‘lgan bitta odatni tanlang.';
    return;
  }
  const end = today(), thisStart = shiftDate(end, -6), prevEnd = shiftDate(end, -7), prevStart = shiftDate(end, -13);
  const possible = habits.length * 7;
  const thisDone = state.logs.filter(x => x.date >= thisStart && x.date <= end && habits.some(h => h.id === x.habitId)).length;
  const prevDone = state.logs.filter(x => x.date >= prevStart && x.date <= prevEnd && habits.some(h => h.id === x.habitId)).length;
  const current = Math.round(thisDone / possible * 100), previous = Math.round(prevDone / possible * 100);
  const delta = current - previous;
  const rank = habits.map(h => ({h, n:getHabitLogs(h.id,thisStart,end).length})).sort((a,b)=>b.n-a.n);
  const weak = [...rank].sort((a,b)=>a.n-b.n)[0];
  const best = rank[0];
  metrics.innerHTML = `<span class="coach-metric">Bu hafta <b>${current}%</b></span><span class="coach-metric">O‘tgan hafta <b>${previous}%</b></span><span class="coach-metric">Farq <b>${delta>0?'+':''}${delta}%</b></span>`;
  if (delta > 0) advice.textContent = `Oldingi 7 kunga nisbatan natijangiz ${delta} foiz punktga oshgan. “${best.h.title}” odati eng izchil bajarilgan (${best.n}/7). Shu odatga yordam bergan vaqt yoki sharoitni saqlab qoling.`;
  else if (delta < 0) advice.textContent = `Oldingi 7 kunga nisbatan natijangiz ${Math.abs(delta)} foiz punktga pasaygan. Bu sababni aniq ko‘rsatmaydi, ammo “${weak.h.title}” odati hozir eng ko‘p e’tibor talab qilmoqda (${weak.n}/7). Yuklamani vaqtincha kichraytirish foydali bo‘lishi mumkin.`;
  else advice.textContent = `Natijangiz oldingi 7 kun bilan bir xil. “${weak.h.title}” odatiga kichikroq va aniqroq qadam belgilab, izchillikni oshirib ko‘ring.`;
  action.innerHTML = `<strong>Bugungi kichik qadam:</strong> “${escapeHTML(weak.h.title)}” uchun 2–5 daqiqalik eng oson variantni bajaring va Vertex’da belgilang.`;
}


function renderProgressPrediction() {
  const metrics = $('#predictionMetrics'), note = $('#predictionNote'), bar = $('#predictionBar'), foot = $('#predictionFoot');
  if (!metrics || !note || !bar || !foot) return;
  const habits = activeHabits();
  if (!habits.length) { metrics.innerHTML = '<span class="coach-metric">Hali odatlar yo‘q</span>'; note.textContent = 'Prognoz uchun avval odat qo‘shing.'; bar.style.width = '0%'; foot.textContent = 'Odatlar tarixi yig‘ilgach, taxmin paydo bo‘ladi.'; return; }
  const end = today(), recentStart = shiftDate(end, -13), previousStart = shiftDate(end, -27), previousEnd = shiftDate(end, -14);
  const possible = habits.length * 14;
  const count = (a,b) => state.logs.filter(x => x.date >= a && x.date <= b && habits.some(h => h.id === x.habitId)).length;
  const recent = Math.round(count(recentStart,end) / possible * 100);
  const previous = Math.round(count(previousStart,previousEnd) / possible * 100);
  const change = recent - previous;
  const forecast = Math.max(0, Math.min(100, Math.round(recent + change * 0.5)));
  const logsInWindow = state.logs.filter(x => x.date >= previousStart && x.date <= end && habits.some(h => h.id === x.habitId)).length;
  metrics.innerHTML = `<span class="coach-metric">So‘nggi 14 kun <b>${recent}%</b></span><span class="coach-metric">Oldingi 14 kun <b>${previous}%</b></span><span class="coach-metric">Keyingi hafta taxmini <b>${forecast}%</b></span>`;
  bar.style.width = forecast + '%';
  if (logsInWindow < 3) { note.textContent = 'Hozircha tarix kam. Ko‘proq kunlarda odatlarni belgilasangiz, taxmin aniqroq yo‘nalish beradi.'; foot.textContent = 'Bu dastlabki taxmin; natija kafolatlanmaydi.'; }
  else if (change > 2) { note.textContent = `So‘nggi ikki haftada natija ${change} foiz punktga yaxshilangan. Shu sur’at saqlansa, keyingi 7 kun uchun taxminiy ko‘rsatkich ${forecast}%.`; foot.textContent = 'Tavsiya: hozirgi odat vaqtingizni saqlang.'; }
  else if (change < -2) { note.textContent = `So‘nggi ikki haftada natija ${Math.abs(change)} foiz punktga pasaygan. Hozirgi trend davom etsa, keyingi 7 kun taxminan ${forecast}% bo‘lishi mumkin.`; foot.textContent = 'Tavsiya: eng qiyin odatni kichikroq vazifaga ajrating.'; }
  else { note.textContent = `Natijangiz deyarli barqaror. Keyingi 7 kun uchun taxminiy ko‘rsatkich ${forecast}%.`; foot.textContent = 'Tavsiya: muntazamlikni saqlab, bitta kichik yaxshilanish kiriting.'; }
}

function renderCoachPlan(){const list=$('#coachPlanList'),summary=$('#coachPlanSummary');if(!list||!summary)return;const ranked=activeHabits().map(h=>({habit:h,pct:Math.round(getHabitLogs(h.id,shiftDate(today(),-6),today()).length/7*100)})).sort((a,b)=>a.pct-b.pct);if(!ranked.length){summary.textContent='Avval odat qo‘shing — shunda Vertex reja tuzadi.';list.innerHTML='<p>Hozircha reja tuzish uchun odatlar yo‘q.</p>';}else{const focus=ranked[0].habit;summary.textContent=`Reja eng ko‘p e’tibor talab qilayotgan “${focus.title}” odatiga asoslangan.`;const steps=['Qulay vaqtni tanlang.','Odatning kichik variantini bajaring.','Bajarilgach, Vertex’da belgilang.','Nima xalaqit berganini aniqlang.','Odatni kundalik ishga bog‘lang.','Natijani tekshirib, vaqtini moslang.','Haftani yakunlab, yangi maqsad belgilang.'];list.innerHTML=steps.map((s,i)=>`<div class="coach-plan-row"><b>${['Du','Se','Ch','Pa','Ju','Sh','Ya'][i]}</b><span>${s}</span><small>${escapeHTML(focus.title)}</small></div>`).join('');}const t=localStorage.getItem('vertex_coach_reminder_time')||'19:00';const input=$('#coachReminderTime');if(input)input.value=t;updateCoachReminderStatus();}
function updateCoachReminderStatus(){const n=$('#coachReminderStatus');if(n)n.textContent=`Eslatma ${localStorage.getItem('vertex_coach_reminder_time')||'19:00'} ga saqlangan. Vertex ochiq bo‘lganda ko‘rinadi.`;}

function renderDashboard() {
  renderStats();
  renderSmartDashboard();
  renderSmartDailyAnalysis();
  renderSmartCoach();
  renderPersonalCoach();
  renderProgressPrediction();
  renderCoachPlan();
  renderWeekStrip();
  renderDashboardHabits();
  renderDashboardTasks();
  $('#dashTimer').textContent = formatTime(timerSeconds);
  $('#dashTimerMode').textContent = state.pomodoro.mode === 'focus'
    ? 'FOCUS'
    : state.pomodoro.mode === 'short' ? 'SHORT BREAK' : 'LONG BREAK';
  const sessionLabel = $('#dashSessionLabel');
  if (sessionLabel) {
    sessionLabel.textContent = state.pomodoro.mode === 'focus'
      ? 'Bitta vazifaga e’tibor qarating.'
      : 'Tanaffusdan unumli foydalaning.';
  }
}

/* ==============================
   ODATLAR JADVALI
============================== */

function visibleHabits() {
  return state.habits
    .filter(habit => showArchived ? habit.isArchived : !habit.isArchived)
    .filter(habit => activeFilter === 'all' || habit.category === activeFilter);
}

function renderHabits() {
  const habits = visibleHabits();
  $('#habitCount').textContent = `${habits.length} ta odat`;
  const tbody = $('#habitTableBody');
  tbody.innerHTML = habits.map(habit => {
    const start = weekStart(today());
    const days = Array.from({ length: 7 }, (_, index) => shiftDate(start, index));
    const dayCells = days.map(date => `
      <td><button class="habit-cell-check ${isChecked(habit.id, date) ? 'checked' : ''}" style="${habitAccent(habit)}"
        data-toggle-check="${escapeHTML(habit.id)}" data-date="${date}"
        ${date > today() || habit.isArchived ? 'disabled' : ''}
        aria-label="${escapeHTML(habit.title)}">${isChecked(habit.id, date) ? '✓' : ''}</button></td>
    `).join('');
    return `
      <tr>
        <td class="habit-name-cell"><div class="habit-name-wrap">
          <span class="habit-glyph" style="${habitAccent(habit)}">${habitIcon(habit)}</span>
          <div class="habit-name-text"><strong>${escapeHTML(habit.title)}</strong>
            <small>${escapeHTML(categoryLabel(habit.category))} · haftasiga ${habit.targetDays} kun ${habit.isArchived ? ' · arxiv' : ''}</small>
          </div>
        </div></td>
        ${dayCells}
        <td class="streak-cell">↗ ${streakForHabit(habit.id)}d</td>
        <td><div class="row-actions">
          <button class="mini-action" data-edit-habit="${escapeHTML(habit.id)}" title="Tahrirlash">✎</button>
          <button class="mini-action" data-archive-habit="${escapeHTML(habit.id)}" title="Arxivlash">${habit.isArchived ? '↶' : '▣'}</button>
          <button class="mini-action danger" data-delete-habit="${escapeHTML(habit.id)}" title="O‘chirish">×</button>
        </div></td>
      </tr>
    `;
  }).join('');
  $('#habitsEmpty').classList.toggle('hidden', habits.length > 0);
  tbody.parentElement.classList.toggle('hidden', habits.length === 0);
  $$('#categoryFilters .filter-chip').forEach(button => {
    button.classList.toggle('active', button.dataset.filter === activeFilter);
  });
}

/* ==============================
   REJALASHTIRUVCHI
============================== */

function renderPlanner() {
  $('#plannerDate').value = plannerDate;
  $('#plannerDateTitle').textContent = plannerDate === today()
    ? 'Bugungi vazifalar'
    : dateLabel(plannerDate, { day: 'numeric', month: 'long', year: 'numeric' }) + ' vazifalari';
  const tasks = state.tasks
    .filter(task => task.date === plannerDate)
    .sort((a, b) => Number(a.done) - Number(b.done) || ({high:0,medium:1,low:2}[a.priority || 'medium'] - {high:0,medium:1,low:2}[b.priority || 'medium']));
  const done = tasks.filter(task => task.done).length;
  const percent = tasks.length ? Math.round(done / tasks.length * 100) : 0;
  $('#taskTotal').textContent = tasks.length;
  $('#taskDone').textContent = done;
  $('#taskPercent').textContent = percent + '%';
  $('#plannerStatus').textContent = !tasks.length
    ? 'Boshlashga tayyor'
    : percent === 100 ? 'Ajoyib! Hammasi bajarildi' : `${tasks.length - done} ta vazifa qoldi`;
  $('#plannerTaskList').innerHTML = tasks.map(task => `
    <div class="planner-task">
      <button class="task-check ${task.done ? 'done' : ''}" data-toggle-task="${escapeHTML(task.id)}">${task.done ? '✓' : ''}</button>
      <span class="task-title ${task.done ? 'done' : ''}">${escapeHTML(task.title)}</span>
      <span class="task-priority priority-${task.priority || 'medium'}">${task.priority === 'high' ? 'MUHIM' : task.priority === 'low' ? 'PAST' : 'ODATIY'}</span>
      <div class="task-actions"><button class="mini-action danger" data-delete-task="${escapeHTML(task.id)}" aria-label="Vazifani o‘chirish">×</button></div>
    </div>
  `).join('');
  $('#plannerEmpty').classList.toggle('hidden', tasks.length > 0);
  $('#plannerTaskList').classList.toggle('hidden', tasks.length === 0);
}

/* ==============================
   POMODORO HOLATINI SAQLASH
============================== */

function timerStorageKey(storageKey = activeStorageKey) {
  return `${storageKey}__pomodoro_timer_v1`;
}

function persistTimer() {
  try {
    localStorage.setItem(timerStorageKey(), JSON.stringify({
      mode: state.pomodoro.mode,
      seconds: timerSeconds,
      running: timerRunning,
      endsAt: timerRunning ? timerEndsAt : null
    }));
  } catch (error) {
    console.warn('Taymer holatini saqlab bo‘lmadi:', error);
  }
}

function restoreTimer() {
  timerRunning = false;
  timerEndsAt = null;
  timerSeconds = modeDuration(state.pomodoro.mode);
  try {
    const raw = localStorage.getItem(timerStorageKey());
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (!saved || saved.mode !== state.pomodoro.mode) return;

    if (saved.running && Number.isFinite(Number(saved.endsAt))) {
      timerEndsAt = Number(saved.endsAt);
      timerSeconds = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
      if (timerSeconds > 0) {
        timerRunning = true;
        return;
      }
      timerSeconds = 0;
    } else if (Number.isFinite(Number(saved.seconds))) {
      timerSeconds = Math.max(0, Math.min(modeDuration(state.pomodoro.mode), Math.round(Number(saved.seconds))));
    }
  } catch (error) {
    console.warn('Saqlangan taymer holatini o‘qib bo‘lmadi:', error);
    timerSeconds = modeDuration(state.pomodoro.mode);
  }
}

/* ==============================
   POMODORO TAYMERI
============================== */

function formatTime(seconds) {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.max(0, seconds) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function modeDuration(mode) {
  const minutes = mode === 'short'
    ? state.settings.shortMinutes
    : mode === 'long' ? state.settings.longMinutes : state.settings.focusMinutes;
  return minutes * 60;
}

function setTimerMode(mode) {
  if (!['focus', 'short', 'long'].includes(mode)) return;
  pauseTimer();
  state.pomodoro.mode = mode;
  timerSeconds = modeDuration(mode);
  persistTimer();
  saveState();
  renderTimer();
  renderDashboard();
}

function renderTimer() {
  const mode = state.pomodoro.mode;
  const labels = {
    focus: ['FOCUS SESSION', 'DIQQATNI JAMLANG'],
    short: ['SHORT BREAK', 'DAM OLING'],
    long: ['LONG BREAK', 'TO‘LIQ TIKLANING']
  };
  $('#timerModeLabel').textContent = labels[mode][0];
  $('#timerStatus').textContent = timerRunning ? 'SESSIYA DAVOM ETMOQDA' : labels[mode][1];
  $('#mainTimer').textContent = formatTime(timerSeconds);
  $('#timerStart').innerHTML = timerRunning ? 'Ⅱ Pauza' : '▶ Davom etish';
  $('#sessionCount').textContent = state.pomodoro.sessions;
  $$('#timerModes .timer-tab').forEach(button => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });
  $('#timerRing').classList.toggle('running', timerRunning);
  const fraction = 1 - timerSeconds / modeDuration(mode);
  const degrees = Math.max(0, Math.min(360, fraction * 360));
  $('#timerRing').style.background =
    `conic-gradient(var(--lime) ${degrees}deg,#323b28 ${degrees}deg 360deg)`;
}

function pauseTimer() {
  if (timerRunning && timerEndsAt) {
    timerSeconds = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));
  }
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerRunning = false;
  timerEndsAt = null;
  persistTimer();
}

function runTimerInterval() {
  // Bitta interval ishlaydi; deadline mutlaq vaqt bo‘lgani uchun tab yashirilsa ham hisob to‘g‘ri qoladi.
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  if (!timerRunning || !Number.isFinite(Number(timerEndsAt))) return;

  timerInterval = setInterval(() => {
    timerSeconds = Math.max(0, Math.ceil((timerEndsAt - Date.now()) / 1000));

    if (timerSeconds <= 0) {
      timerSeconds = 0;
      pauseTimer();

      if (state.pomodoro.mode === 'focus') {
        state.pomodoro.sessions++;
        saveState();
        notify('Fokus sessiyasi tugadi. Tanaffus qilish vaqti!');
      } else {
        notify('Tanaffus tugadi. Tayyor bo‘lsangiz, davom eting.');
      }

      renderTimer();
      renderDashboard();
      return;
    }

    const mainTimer = $('#mainTimer');
    const dashTimer = $('#dashTimer');
    if (mainTimer) mainTimer.textContent = formatTime(timerSeconds);
    if (dashTimer) dashTimer.textContent = formatTime(timerSeconds);

    const fraction = 1 - timerSeconds / modeDuration(state.pomodoro.mode);
    const degrees = fraction * 360;
    const ring = $('#timerRing');
    if (ring) ring.style.background =
      `conic-gradient(var(--lime) ${degrees}deg,#323b28 ${degrees}deg 360deg)`;
  }, 1000);
}

function startTimer() {
  if (timerRunning) {
    pauseTimer();
    renderTimer();
    renderDashboard();
    return;
  }

  if (timerSeconds <= 0) timerSeconds = modeDuration(state.pomodoro.mode);

  timerRunning = true;
  timerEndsAt = Date.now() + timerSeconds * 1000;
  persistTimer();
  renderTimer();
  renderDashboard();
  runTimerInterval();
}

function resetTimer() {
  pauseTimer();
  timerSeconds = modeDuration(state.pomodoro.mode);
  persistTimer();
  renderTimer();
  renderDashboard();
}

/* ==============================
   TAHLIL
============================== */

function longTermStats(days) {
  const end = today();
  const start = shiftDate(end, -(days - 1));
  const habits = activeHabits();
  let done = 0;
  let possible = 0;
  const habitStats = habits.map(habit => {
    const habitStart = habit.createdAt > start ? habit.createdAt : start;
    let eligible = 0;
    let completed = 0;
    if (habitStart <= end) {
      for (let date = habitStart; date <= end; date = shiftDate(date, 1)) {
        eligible++;
        if (isChecked(habit.id, date)) completed++;
      }
    }
    done += completed;
    possible += eligible;
    return { habit, eligible, completed, rate: eligible ? Math.round(completed / eligible * 100) : 0 };
  });

  const weekday = Array.from({ length: 7 }, (_, i) => ({
    label: ['Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba', 'Yakshanba'][i],
    possible: 0, done: 0
  }));
  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    const dayIndex = (parseDate(date).getDay() + 6) % 7;
    habits.forEach(habit => {
      if (date < habit.createdAt) return;
      weekday[dayIndex].possible++;
      if (isChecked(habit.id, date)) weekday[dayIndex].done++;
    });
  }
  weekday.forEach(day => day.rate = day.possible ? Math.round(day.done / day.possible * 100) : 0);

  let bestDay = null;
  weekday.forEach(day => {
    if (day.possible && (!bestDay || day.rate > bestDay.rate)) bestDay = day;
  });

  const dailyRows = [];
  for (let i = Math.min(days - 1, 13); i >= 0; i--) {
    const date = shiftDate(end, -i);
    const eligible = habits.filter(habit => date >= habit.createdAt);
    const completed = eligible.filter(habit => isChecked(habit.id, date)).length;
    const rate = eligible.length ? Math.round(completed / eligible.length * 100) : 0;
    dailyRows.push({ date, completed, eligible: eligible.length, rate });
  }
  return {
    days, start, end, habits: habitStats, done, possible,
    rate: possible ? Math.round(done / possible * 100) : 0,
    missed: Math.max(0, possible - done),
    average: days ? (done / days).toFixed(1) : '0',
    bestDay, weekday, dailyRows
  };
}

function showLongTermDetail(days) {
  const panel = $('#longTermDetail');
  if (!panel) return;
  const months = days === 90 ? 3 : days === 180 ? 6 : 12;
  const stats = longTermStats(days);
  const sortedHabits = [...stats.habits].sort((a, b) => b.rate - a.rate);
  $('#longTermDetailTitle').textContent = `${months} oylik batafsil statistika`;
  $('#longTermDetailStats').innerHTML = `
    <article class="stat-card"><div class="stat-top"><span>BAJARILISH DARAJASI</span></div><div class="stat-value"><strong>${stats.rate}%</strong></div><span class="stat-note">Mavjud kunlar bo‘yicha o‘rtacha</span></article>
    <article class="stat-card"><div class="stat-top"><span>BAJARILGANLAR</span></div><div class="stat-value"><strong>${stats.done}</strong></div><span class="stat-note">Jami bajarilgan odatlar</span></article>
    <article class="stat-card"><div class="stat-top"><span>BAJARILMAGANLAR</span></div><div class="stat-value"><strong>${stats.missed}</strong></div><span class="stat-note">Rejadagi imkoniyatlardan</span></article>
    <article class="stat-card"><div class="stat-top"><span>REJADAGI IMKONIYAT</span></div><div class="stat-value"><strong>${stats.possible}</strong></div><span class="stat-note">Odat mavjud bo‘lgan kunlar</span></article>
    <article class="stat-card"><div class="stat-top"><span>KUNLIK O‘RTACHA</span></div><div class="stat-value"><strong>${stats.average}</strong></div><span class="stat-note">Bajarilish / kun</span></article>
    <article class="stat-card"><div class="stat-top"><span>ENG SAMARALI HAFTA KUNI</span></div><div class="stat-value"><strong class="text-stat">${stats.bestDay ? stats.bestDay.label : '—'}</strong></div><span class="stat-note">${stats.bestDay ? stats.bestDay.rate + '% bajarilish' : 'Ma’lumot yetarli emas'}</span></article>`;

  const monthRows = [];
  for (let m = months - 1; m >= 0; m--) {
    const monthDate = parseDate(stats.end);
    monthDate.setDate(1);
    monthDate.setMonth(monthDate.getMonth() - m);
    const monthStart = localDateString(monthDate);
    const nextMonth = new Date(monthDate);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const monthEnd = localDateString(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 0, 12));
    const from = monthStart < stats.start ? stats.start : monthStart;
    const to = monthEnd > stats.end ? stats.end : monthEnd;
    let completed = 0, eligible = 0;
    if (from <= to) {
      for (let date = from; date <= to; date = shiftDate(date, 1)) {
        stats.habits.forEach(item => {
          if (date < item.habit.createdAt) return;
          eligible++;
          if (isChecked(item.habit.id, date)) completed++;
        });
      }
    }
    const pct = eligible ? Math.round(completed / eligible * 100) : 0;
    monthRows.push(`<button type="button" class="long-term-month-row month-detail-trigger" data-month="${monthStart.slice(0,7)}" aria-label="${dateLabel(monthStart,{month:'long',year:'numeric'})} statistikasini ochish"><span>${dateLabel(monthStart,{month:'short',year:'numeric'})}</span><span class="progress-track"><span class="progress-fill" style="width:${pct}%"></span></span><strong>${pct}%</strong><small>${completed}/${eligible}</small></button>`);
  }

  const habitRows = sortedHabits.length ? sortedHabits.map(item => `
    <div class="long-term-habit-row">
      <div class="long-term-habit-head"><span>${escapeHTML(item.habit.icon || '◉')} ${escapeHTML(item.habit.title)}</span><strong>${item.rate}%</strong></div>
      <div class="progress-track"><div class="progress-fill" style="width:${item.rate}%"></div></div>
      <small>${item.completed} / ${item.eligible} kun bajarilgan</small>
    </div>`).join('') : '<p class="long-term-empty">Hozircha faol odatlar mavjud emas.</p>';

  const weekdayRows = stats.weekday.map(day => `
    <div class="long-term-weekday-row"><span>${day.label}</span><div class="progress-track"><div class="progress-fill" style="width:${day.rate}%"></div></div><strong>${day.rate}%</strong></div>`).join('');

  const dailyRows = stats.dailyRows.map(day => `
    <div class="long-term-daily-row"><span>${dateLabel(day.date,{day:'numeric',month:'short'})}</span><div class="progress-track"><div class="progress-fill" style="width:${day.rate}%"></div></div><strong>${day.completed}/${day.eligible}</strong></div>`).join('');

  $('#longTermMonthChart').innerHTML = `
    <section class="long-term-breakdown"><div class="eyebrow">OYMA-OY NATIJA</div><h3>Har oy bo‘yicha bajarilish</h3>${monthRows.join('')}</section>
    <div class="long-term-detail-columns">
      <section class="long-term-breakdown"><div class="eyebrow">ODATLAR KESIMIDA</div><h3>Har bir odat natijasi</h3>${habitRows}</section>
      <section class="long-term-breakdown"><div class="eyebrow">HAFTA KUNLARI</div><h3>Qaysi kun samaraliroq?</h3>${weekdayRows}</section>
    </div>
    <section class="long-term-breakdown"><div class="eyebrow">SO‘NGGI 14 KUN</div><h3>Kunlik bajarilish tarixi</h3>${dailyRows}</section>`;
  panel.hidden = false;
  panel.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function renderCalendarDayDetails(date) {
  const box = document.getElementById('monthSelectedDayDetail');
  if (!box) return;
  const habits = activeHabits().filter(habit => date >= habit.createdAt);
  const completed = habits.filter(habit => isChecked(habit.id, date));
  const pct = habits.length ? Math.round(completed.length / habits.length * 100) : 0;
  const rows = habits.map(habit => {
    const done = isChecked(habit.id, date);
    const color = normalizeHabitColor(habit.color ?? habit.habitColor);
    return `<div class="month-selected-habit" style="--habit-accent:${color}"><span class="month-habit-dot" style="background:${color}"></span><span>${escapeHTML(habit.icon || '◉')} ${escapeHTML(habit.title)}</span><strong class="${done ? 'is-done' : 'is-missed'}">${done ? 'Bajarildi' : 'Bajarilmadi'}</strong></div>`;
  }).join('');
  box.innerHTML = `<div class="month-selected-heading"><div><div class="eyebrow">TANLANGAN SANA</div><h3>${dateLabel(date,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h3></div><strong class="month-selected-rate">${pct}%</strong></div><div class="month-selected-summary"><span>${completed.length} ta bajarildi</span><span>${Math.max(0,habits.length-completed.length)} ta bajarilmadi</span><span>${habits.length} ta odat</span></div><div class="month-selected-habits">${rows || '<p class="long-term-empty">Bu sanada hisoblanadigan odatlar mavjud emas.</p>'}</div>`;
  document.querySelectorAll('.month-calendar-day').forEach(button => button.classList.toggle('selected', button.dataset.date === date));
  document.querySelectorAll('.month-day-bar').forEach(bar => bar.classList.toggle('selected', bar.dataset.date === date));
}

function showCalendarMonthDetail(monthKey) {
  const [year, month] = monthKey.split('-').map(Number);
  const first = `${monthKey}-01`;
  const lastDate = new Date(year, month, 0, 12);
  const last = localDateString(lastDate);
  const start = first < shiftDate(today(), -364) ? shiftDate(today(), -364) : first;
  const end = last > today() ? today() : last;
  const habits = activeHabits();
  let done = 0, possible = 0;
  const rows = habits.map(habit => {
    let eligible = 0, completed = 0;
    for (let date = start; date <= end; date = shiftDate(date, 1)) {
      if (date < habit.createdAt) continue;
      eligible++;
      if (isChecked(habit.id, date)) completed++;
    }
    done += completed; possible += eligible;
    return {habit, eligible, completed, rate: eligible ? Math.round(completed / eligible * 100) : 0};
  }).sort((a,b) => b.rate-a.rate);
  const rate = possible ? Math.round(done / possible * 100) : 0;
  const panel = $('#longTermDetail');
  $('#longTermDetailTitle').textContent = `${dateLabel(first,{month:'long',year:'numeric'})} — batafsil statistika`;
  $('#longTermDetailStats').innerHTML = `
    <article class="stat-card"><div class="stat-top"><span>BAJARILISH DARAJASI</span></div><div class="stat-value"><strong>${rate}%</strong></div></article>
    <article class="stat-card"><div class="stat-top"><span>BAJARILGANLAR</span></div><div class="stat-value"><strong>${done}</strong></div></article>
    <article class="stat-card"><div class="stat-top"><span>REJADAGI IMKONIYAT</span></div><div class="stat-value"><strong>${possible}</strong></div></article>`;
  const habitRows = rows.map(x => `<div class="long-term-habit-row" style="--habit-accent:${normalizeHabitColor(x.habit.color ?? x.habit.habitColor)}"><div class="long-term-habit-head"><span>${escapeHTML(x.habit.icon || '◉')} ${escapeHTML(x.habit.title)}</span><strong>${x.rate}%</strong></div><div class="progress-track"><div class="progress-fill habit-colored-fill" style="width:${x.rate}%"></div></div><small>${x.completed} / ${x.eligible} kun bajarilgan</small></div>`).join('') || '<p class="long-term-empty">Faol odatlar mavjud emas.</p>';

  // Tanlangan oy uchun Analytics sahifasiga o‘xshash kunlik diagramma.
  const daily = [];
  const weekdayTotals = Array.from({length:7}, (_,i) => ({label:['Du','Se','Cho','Pa','Ju','Sha','Ya'][i], done:0, possible:0}));
  let bestDate = null;
  for (let date = start; date <= end; date = shiftDate(date, 1)) {
    const eligible = habits.filter(h => date >= h.createdAt);
    const completed = eligible.filter(h => isChecked(h.id, date)).length;
    const pct = eligible.length ? Math.round(completed / eligible.length * 100) : 0;
    const index = (parseDate(date).getDay() + 6) % 7;
    weekdayTotals[index].done += completed; weekdayTotals[index].possible += eligible.length;
    daily.push({date, completed, eligible:eligible.length, pct});
    if (eligible.length && (!bestDate || pct > bestDate.pct)) bestDate = {date,pct};
  }
  // Haftalik Analytics diagrammasidagi kabi: har bir bajarilgan odat o‘z rangli segmenti bilan ko‘rinadi.
  // Segmentlar orasida bo‘shliq yoki chegara yo‘q — ranglar ustunda silliq tutashadi.
  const dailyBars = daily.map(d => {
    const completedHabits = habits.filter(habit => d.date >= habit.createdAt && isChecked(habit.id, d.date));
    const segmentHeight = completedHabits.length ? 100 / completedHabits.length : 0;
    const segments = completedHabits.map(habit => {
      const color = normalizeHabitColor(habit.color ?? habit.habitColor);
      return `<i class="month-day-segment" title="${escapeHTML(habit.title)}" style="height:${segmentHeight}%;background:${color};flex:0 0 ${segmentHeight}%"></i>`;
    }).join('');
    return `<div class="month-day-bar" data-date="${d.date}" title="${dateLabel(d.date,{day:'numeric',month:'long'})}: ${d.completed}/${d.eligible} (${d.pct}%)"><span class="month-day-value">${d.pct}%</span><div class="month-day-track"><div class="month-day-stack" style="height:${d.pct}%">${segments}</div></div><small>${Number(d.date.slice(-2))}</small></div>`;
  }).join('');
  const weekdayStats = weekdayTotals.map(d => { const pct=d.possible?Math.round(d.done/d.possible*100):0; return `<div class="long-term-weekday-row"><span>${d.label}</span><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><strong>${pct}%</strong></div>`; }).join('');
  const firstWeekday = (new Date(year, month - 1, 1, 12).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month, 0, 12).getDate();
  const calendarCells = Array.from({length:firstWeekday}, () => '<span class="month-calendar-empty"></span>');
  for (let day = 1; day <= daysInMonth; day++) {
    const date = `${monthKey}-${String(day).padStart(2,'0')}`;
    const entry = daily.find(item => item.date === date);
    const pct = entry ? entry.pct : 0;
    const future = date > today();
    calendarCells.push(`<button type="button" class="month-calendar-day${future?' future':''}" data-date="${date}" ${future?'disabled':''} aria-label="${day}-kun, ${pct}% bajarilish"><span>${day}</span>${entry && entry.completed ? '<i></i>' : ''}</button>`);
  }
  const initialDate = end;
  $('#longTermMonthChart').innerHTML = `
    <section class="long-term-breakdown"><div class="eyebrow">OYLIK ANALITIKA</div><h3>Kunlar bo‘yicha bajarilish</h3><div class="month-daily-chart">${dailyBars}</div><div class="month-chart-legend"><span>Har bir ustun — bir kun</span><strong>${bestDate ? 'Eng yaxshi kun: '+dateLabel(bestDate.date,{day:'numeric',month:'long'})+' · '+bestDate.pct+'%' : 'Ma’lumot yetarli emas'}</strong></div></section>
    <section class="long-term-breakdown month-calendar-panel"><div class="eyebrow">OYLIK KALENDAR</div><h3>${dateLabel(first,{month:'long',year:'numeric'})}</h3><div class="month-calendar-grid month-calendar-weekdays"><span>Du</span><span>Se</span><span>Cho</span><span>Pa</span><span>Ju</span><span>Sha</span><span>Ya</span></div><div class="month-calendar-grid">${calendarCells.join('')}</div><p class="month-calendar-hint">Sanani bosing — o‘sha kundagi odatlar statistikasi chiqadi.</p><div id="monthSelectedDayDetail"></div></section>
    <div class="long-term-detail-columns"><section class="long-term-breakdown"><div class="eyebrow">HAFTA KUNLARI</div><h3>Haftalik samaradorlik</h3>${weekdayStats}</section><section class="long-term-breakdown"><div class="eyebrow">ODATLAR KESIMIDA</div><h3>Har bir odat natijasi</h3>${habitRows}</section></div>`;
  panel.hidden = false;
  renderCalendarDayDetails(initialDate);
  panel.scrollIntoView({behavior:'smooth', block:'nearest'});
}

function renderAnalytics() {
  const week = rateForDays(7);
  const month = rateForDays(30);
  $('#analyticsWeekRate').textContent = week + '%';
  $('#analyticsMonthRate').textContent = month + '%';
  $('#totalCompletions').textContent = state.logs.length;

  // Uzoq muddatli statistika: 90, 180 va 365 kunlik alohida davrlar.
  [90, 180, 365].forEach(days => {
    const period = longTermStats(days);
    const done = period.done;
    const rate = period.rate;
    const rateNode = document.getElementById(`analytics${days}Rate`);
    const doneNode = document.getElementById(`analytics${days}Done`);
    if (rateNode) rateNode.textContent = rate + '%';
    if (doneNode) doneNode.textContent = `${done} ta bajarilish · ${days} kun ichida`;
  });

  // Qo'shimcha Smart Analytics: oldingi davr bilan taqqoslash va eng samarali hafta kuni.
  const analyticsHabits = activeHabits();
  const periodRate = (offset, days) => {
    if (!analyticsHabits.length) return 0;
    let completed = 0;
    for (let i = offset; i < offset + days; i++) {
      const date = shiftDate(today(), -i);
      completed += analyticsHabits.filter(h => isChecked(h.id, date)).length;
    }
    return Math.round(completed / (analyticsHabits.length * days) * 100);
  };
  const previousWeek = periodRate(7, 7);
  const previousMonth = periodRate(30, 30);
  const weekDelta = week - previousWeek;
  const monthDelta = month - previousMonth;
  const weekCompare = $('#analyticsWeekCompare');
  const monthCompare = $('#analyticsMonthCompare');
  if (weekCompare) weekCompare.textContent = `${weekDelta > 0 ? '+' : ''}${weekDelta}% oldingi 7 kunga nisbatan`;
  if (monthCompare) monthCompare.textContent = `${monthDelta > 0 ? '+' : ''}${monthDelta}% oldingi 30 kunga nisbatan`;
  const score = Math.round((week * 0.6) + (month * 0.4));
  const scoreValue = $('#progressScore');
  const scoreBar = $('#progressScoreBar');
  const scoreLabel = $('#progressScoreLabel');
  if (scoreValue) scoreValue.textContent = score + '/100';
  if (scoreBar) scoreBar.style.width = score + '%';
  if (scoreLabel) scoreLabel.textContent = score >= 80 ? 'Juda yaxshi izchillik' : score >= 60 ? 'Yaxshi yo‘nalish' : score >= 35 ? 'Rivojlanish davom etmoqda' : 'Barqarorlikni shakllantiring';

  const weekdayTotals = Array.from({length: 7}, (_, day) => ({day, done: 0, possible: 0}));
  for (let i = 0; i < 30; i++) {
    const date = shiftDate(today(), -i);
    const weekday = (parseDate(date).getDay() + 6) % 7;
    weekdayTotals[weekday].done += analyticsHabits.filter(h => isChecked(h.id, date)).length;
    weekdayTotals[weekday].possible += analyticsHabits.length;
  }
  const bestWeekday = weekdayTotals.filter(x => x.possible).sort((a,b) => (b.done/b.possible) - (a.done/a.possible))[0];
  const bestDayNode = $('#bestWeekday');
  const bestDayRateNode = $('#bestWeekdayRate');
  if (bestDayNode) bestDayNode.textContent = bestWeekday && bestWeekday.done ? ['Dushanba','Seshanba','Chorshanba','Payshanba','Juma','Shanba','Yakshanba'][bestWeekday.day] : '—';
  if (bestDayRateNode) bestDayRateNode.textContent = bestWeekday && bestWeekday.possible ? `${Math.round(bestWeekday.done / bestWeekday.possible * 100)}% · oxirgi 30 kun` : 'Ma’lumot yig‘ilmoqda';

  const active = activeHabits();
  let best = null;
  if (active.length) {
    best = active.map(habit => {
      let count = 0;
      for (let i = 0; i < 30; i++) {
        if (isChecked(habit.id, shiftDate(today(), -i))) count++;
      }
      return { h: habit, rate: Math.round(count / 30 * 100), n: count };
    }).sort((a, b) => b.rate - a.rate || b.n - a.n)[0];
  }
  $('#bestHabit').textContent = best && best.n ? best.h.title : '—';
  $('#bestHabitRate').textContent = best && best.n
    ? `${best.rate}% · oxirgi 30 kun`
    : 'Hali yetarli ma’lumot yo‘q';

  const colorStats = $('#habitColorStats');
  if (colorStats) {
    colorStats.innerHTML = active.map(habit => {
      let count = 0;
      for (let i = 0; i < 30; i++) {
        if (isChecked(habit.id, shiftDate(today(), -i))) count++;
      }

      const percent = Math.round(count / 30 * 100);
      const accent = normalizeHabitColor(habit.color);

      return `
        <div class="habit-stat-row" style="${habitAccent(habit)}">
          <span class="habit-stat-icon"
            style="background:${accent}22;color:${accent}">
            ${habitIcon(habit)}
          </span>

          <div class="habit-stat-main">
            <div class="habit-stat-head">
              <strong>${escapeHTML(habit.title)}</strong>
              <span style="color:${accent}">${percent}%</span>
            </div>

            <div class="habit-stat-track">
              <i style="width:${percent}%;background:${accent}"></i>
            </div>

            <small>${count}/30 kun · oxirgi 30 kun</small>
          </div>
        </div>
      `;
    }).join('') || '<p class="habit-stat-empty">Hozircha faol odatlar mavjud emas.</p>';
  }

  const dates = Array.from({ length: 7 }, (_, i) => shiftDate(today(), i - 6));
  // Har bir kun ustuni bajarilgan odatlarning o'z rangidagi segmentlaridan tuziladi.
  // Shu sababli bir kunda 10 ta odat bajarilgan bo'lsa, ustunda 10 ta rangli bo'lak ko'rinadi.
  $('#weeklyChart').innerHTML = dates.map(date => {
    const completed = active.filter(habit => isChecked(habit.id, date));
    const total = active.length;
    const percent = total ? Math.round(completed.length / total * 100) : 0;
    const segmentHeight = completed.length ? (100 / completed.length) : 0;
    const segments = completed.map(habit => {
      const color = normalizeHabitColor(habit.color ?? habit.habitColor);
      return `<i class="bar-segment" title="${escapeHTML(habit.title)}" style="height:${segmentHeight}%;background:${color};background-color:${color};flex:0 0 ${segmentHeight}%"></i>`;
    }).join('');
    return `
      <div class="bar-col ${date === today() ? 'today' : ''}">
        <span class="bar-value">${percent}%</span>
        <div class="bar-track" title="${completed.length}/${total} odat bajarildi">
          <div class="bar-stack" style="height:${percent}%">${segments}</div>
        </div>
        <span class="bar-label">${DAY_NAMES[(parseDate(date).getDay() + 6) % 7]}</span>
      </div>
    `;
  }).join('');

  if (!active.length) {
    $('#insightTitle').textContent = 'Birinchi odatingizni yarating.';
    $('#insightText').textContent = 'Odatlar qo‘shilgach, bu sahifa bajarish ko‘rsatkichlari va foydali kuzatuvlarni ko‘rsatadi.';
    $('#nextStepText').textContent = 'Bitta sodda, o‘lchash mumkin bo‘lgan odat qo‘shing.';
  } else if (week >= 70) {
    $('#insightTitle').textContent = 'Siz yaxshi izchillik ko‘rsatyapsiz!';
    $('#insightText').textContent = `So‘nggi haftada odatlaringizning ${week}% ini bajardingiz. Shu ritmni saqlash uchun maqsadlarni real va barqaror tuting.`;
    $('#nextStepText').textContent = 'Hozirgi odatlarni davom ettiring; birdaniga ko‘p yangi maqsad qo‘shmang.';
  } else if (week > 0) {
    $('#insightTitle').textContent = 'Kichik qadamlar bilan davom eting.';
    $('#insightText').textContent = `Haftalik bajarish ko‘rsatkichi ${week}%. Qaysi kun yoki odat ko‘proq e’tibor talab qilayotganini kuzating.`;
    $('#nextStepText').textContent = 'Eng oson odatingizdan boshlang va uni har kuni belgilashga harakat qiling.';
  } else {
    $('#insightTitle').textContent = 'Bugun yangi boshlanish bo‘lishi mumkin.';
    $('#insightText').textContent = 'Hali bu haftada bajarilgan odat belgilanmagan. Bitta kichik harakat bilan boshlang.';
    $('#nextStepText').textContent = 'Birinchi odatingizni bugun bajaring va jadvalda belgilang.';
  }

  renderHabitIntelligence();
  renderEightWeekTrend();
  renderMonthlyActivityMap();
  renderMonthlyReview();
  renderHabitPeriodComparison();

  $('#categoryBreakdown').innerHTML = Object.entries(CATEGORIES)
    .filter(([key]) => key !== 'discipline' || state.habits.some(habit => habit.category === key))
    .map(([key, label]) => {
      const habits = active.filter(habit => habit.category === key);
      let count = 0;
      for (const habit of habits) {
        for (let i = 0; i < 30; i++) {
          if (isChecked(habit.id, shiftDate(today(), -i))) count++;
        }
      }
      const possible = habits.length * 30;
      const percent = possible ? Math.round(count / possible * 100) : 0;
      return `
        <div class="category-item">
          <span class="category-name">${escapeHTML(label)}</span>
          <strong>${percent}%</strong>
          <small>${habits.length} ta odat · 30 kun</small>
          <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        </div>
      `;
    }).join('');
}

function renderEightWeekTrend() {
  const chart = document.getElementById('vertexTrendChart');
  const summary = document.getElementById('vertexTrendSummary');
  if (!chart || !summary) return;
  const habits = activeHabits();
  if (!habits.length) {
    chart.innerHTML = '<p class="habit-stat-empty">Trendni ko‘rish uchun avval odat qo‘shing.</p>';
    summary.textContent = 'Odatlar qo‘shilgach, haftalik o‘zgarishlar shu yerda ko‘rinadi.';
    return;
  }
  const weeks = [];
  for (let w = 7; w >= 0; w--) {
    let done = 0;
    for (let d = 0; d < 7; d++) {
      const offset = w * 7 + d;
      const date = shiftDate(today(), -offset);
      done += habits.filter(h => isChecked(h.id, date)).length;
    }
    const possible = habits.length * 7;
    weeks.push({ label: w === 0 ? 'Joriy' : `${w} hf`, rate: Math.round(done / possible * 100), done });
  }
  chart.innerHTML = weeks.map((item, index) => `
    <div class="vertex-trend-col" title="${item.done}/${habits.length * 7} bajarilish">
      <strong>${item.rate}%</strong>
      <div class="vertex-trend-track"><i style="height:${item.rate}%"></i></div>
      <span>${item.label}</span>
    </div>`).join('');
  const current = weeks[7].rate;
  const previous = weeks[6].rate;
  const delta = current - previous;
  const direction = delta > 0 ? `Oldingi haftaga nisbatan ${delta} foiz punktga o‘sish bor.` : delta < 0 ? `Oldingi haftaga nisbatan ${Math.abs(delta)} foiz punktga pasaygan; kichik va bajarish oson maqsadlarni tanlang.` : 'Natija oldingi haftaga nisbatan bir xil.';
  summary.textContent = `Joriy hafta: ${current}%. ${direction}`;
}

function isValidTimeZone(zone) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date()); return true; }
  catch (_) { return false; }
}

function timezoneOffsetLabel(zone, date = new Date()) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(date);
    const raw = parts.find(p => p.type === 'timeZoneName')?.value || 'GMT';
    return raw.replace('GMT', 'GMT/UTC');
  } catch (_) { return 'GMT/UTC'; }
}

function renderRegionalTime() {
  const select = document.getElementById('vertexTimeZone');
  const clock = document.getElementById('vertexRegionalClock');
  const offset = document.getElementById('vertexGmtOffset');
  if (!select || !clock || !offset) return;
  const zone = isValidTimeZone(state.settings.timeZone) ? state.settings.timeZone : (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC');
  if (!select.options.length) {
    const zones = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [zone, 'UTC', 'Asia/Tashkent', 'Europe/London', 'America/New_York', 'Asia/Tokyo'];
    const unique = [...new Set([zone, 'UTC', 'Asia/Tashkent', ...zones])].sort();
    select.innerHTML = unique.map(z => `<option value="${z.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}">${z.replace(/_/g,' ')}</option>`).join('');
  }
  select.value = zone;
  const now = new Date();
  clock.textContent = new Intl.DateTimeFormat('uz-UZ', { timeZone: zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(now);
  offset.textContent = `${timezoneOffsetLabel(zone, now)} · ${new Intl.DateTimeFormat('uz-UZ', { timeZone: zone, dateStyle: 'full' }).format(now)}`;
}

/* ==============================
   SOZLAMALAR
============================== */

function renderSettings() {
  $('#userNameInput').value = state.userName;
  $('#focusMinutes').value = state.settings.focusMinutes;
  $('#shortMinutes').value = state.settings.shortMinutes;
  $('#longMinutes').value = state.settings.longMinutes;
  renderRegionalTime();

  const backup = getBackupInfo();
  const status = $('#backupStatus');
  const restoreButton = $('#restoreBackupBtn');

  if (status && restoreButton) {
    if (backup.available) {
      const dateText = backup.savedAt
        ? new Date(backup.savedAt).toLocaleString('uz-UZ')
        : 'sana noma’lum';
      status.textContent = `Oxirgi zaxira: ${dateText}`;
      restoreButton.disabled = false;
    } else {
      status.textContent = 'Hozircha avtomatik zaxira mavjud emas.';
      restoreButton.disabled = true;
    }
  }
}

function renderAll() {
  renderHeader();
  renderDashboard();
  renderHabits();
  renderPlanner();
  renderTimer();
  renderAnalytics();
  renderAchievements();
  renderSettings();
}


/* ==============================
   YUTUQLAR VA BADGE TIZIMI
============================== */
function renderMonthlyActivityMap() {
  const grid = $('#monthlyActivityGrid');
  const summary = $('#monthlyActivitySummary');
  const note = $('#monthlyActivityNote');
  if (!grid) return;
  const habits = activeHabits();
  if (!habits.length) {
    grid.innerHTML = '<p class="habit-stat-empty">Faollik xaritasini ko‘rish uchun avval odat qo‘shing.</p>';
    if (summary) summary.textContent = '0 / 30 faol kun';
    if (note) note.textContent = 'Odat qo‘shilgach, so‘nggi 30 kunlik belgilaringiz shu yerda aks etadi.';
    return;
  }
  let activeDays = 0;
  let totalDone = 0;
  const cells = [];
  for (let offset = 29; offset >= 0; offset--) {
    const date = shiftDate(today(), -offset);
    const done = habits.filter(habit => isChecked(habit.id, date)).length;
    const rate = done / habits.length;
    const level = done === 0 ? 0 : rate < 0.25 ? 1 : rate < 0.5 ? 2 : rate < 0.75 ? 3 : 4;
    if (done > 0) activeDays++;
    totalDone += done;
    const dayLabel = date.slice(8, 10) + '.' + date.slice(5, 7);
    const todayMark = date === today();
    const title = `${dayLabel}: ${done}/${habits.length} ta odat${todayMark ? ' · bugun' : ''}`;
    cells.push(`<div class="monthly-activity-cell activity-level-${level}${todayMark ? ' is-today' : ''}" role="listitem" tabindex="0" title="${title}" aria-label="${title}"><span>${date.slice(8,10)}</span><small>${done}</small></div>`);
  }
  grid.innerHTML = cells.join('');
  if (summary) summary.textContent = `${activeDays} / 30 faol kun`;
  if (note) note.textContent = `${totalDone} ta bajarilish · ${habits.length} ta faol odat asosida. Katakdagi yuqori raqam sana, pastdagi raqam bajarilgan odatlar soni.`;
}

function renderMonthlyReview() {
  const habits = activeHabits();
  const summarize = (offset, days) => {
    let done = 0;
    let activeDays = 0;
    for (let i = offset; i < offset + days; i++) {
      const date = shiftDate(today(), -i);
      const count = habits.filter(habit => isChecked(habit.id, date)).length;
      done += count;
      if (count > 0) activeDays++;
    }
    const possible = habits.length * days;
    return { done, activeDays, rate: possible ? Math.round(done / possible * 100) : 0 };
  };
  const current = summarize(0, 30);
  const previous = summarize(30, 30);
  const delta = current.rate - previous.rate;
  const setText = (id, value) => { const node = document.getElementById(id); if (node) node.textContent = value; };
  const setWidth = (id, value) => { const node = document.getElementById(id); if (node) node.style.width = `${value}%`; };
  setText('monthlyReviewCurrent', `${current.rate}%`);
  setText('monthlyReviewPrevious', `${previous.rate}%`);
  setWidth('monthlyReviewCurrentBar', current.rate);
  setWidth('monthlyReviewPreviousBar', previous.rate);
  setText('monthlyReviewCurrentMeta', `${current.done} ta bajarilish · ${current.activeDays} faol kun`);
  setText('monthlyReviewPreviousMeta', `${previous.done} ta bajarilish · ${previous.activeDays} faol kun`);
  setText('monthlyReviewDelta', `${delta > 0 ? '+' : ''}${delta} foiz punkt`);
  setText('monthlyReviewTrend', !habits.length ? 'Odatlar kerak' : delta > 0 ? 'O‘sish ↗' : delta < 0 ? 'Pasayish ↘' : 'Bir xil →');
  setText('monthlyReviewMessage', !habits.length
    ? 'Taqqoslash uchun avval faol odat qo‘shing.'
    : delta > 0 ? 'So‘nggi davrda bajarish ulushi oshgan. Shu ritmni saqlang.'
    : delta < 0 ? 'Natija oldingi davrga nisbatan pasaygan. Bitta odatni kichikroq qadamga ajrating.'
    : 'Ikki davr natijasi bir xil. Izchillikni davom ettiring.');
  setText('monthlyReviewFootnote', habits.length
    ? `Har bir davr ${habits.length} ta faol odat asosida hisoblandi. Foiz punkt — ikki davr foizlari orasidagi farq.`
    : 'Ma’lumotlar paydo bo‘lgach, ikki 30 kunlik davr avtomatik taqqoslanadi.');
}


function renderHabitPeriodComparison() {
  const host = document.getElementById('habitPeriodList');
  const note = document.getElementById('habitPeriodNote');
  if (!host) return;
  const habits = activeHabits();
  if (!habits.length) {
    host.innerHTML = '<p class="habit-stat-empty">Taqqoslash uchun avval faol odat qo‘shing.</p>';
    if (note) note.textContent = 'Odatlar qo‘shilgach, har biri alohida tahlil qilinadi.';
    return;
  }
  const rows = habits.map(habit => {
    let currentDone = 0;
    let previousDone = 0;
    for (let i = 0; i < 30; i++) {
      if (isChecked(habit.id, shiftDate(today(), -i))) currentDone++;
      if (isChecked(habit.id, shiftDate(today(), -(i + 30)))) previousDone++;
    }
    const currentRate = Math.round(currentDone / 30 * 100);
    const previousRate = Math.round(previousDone / 30 * 100);
    return { habit, currentDone, previousDone, currentRate, previousRate, delta: currentRate - previousRate };
  }).sort((a, b) => b.delta - a.delta || b.currentRate - a.currentRate || a.habit.title.localeCompare(b.habit.title));
  host.innerHTML = rows.map(row => {
    const color = normalizeHabitColor(row.habit.color ?? row.habit.habitColor);
    const trendClass = row.delta > 0 ? 'is-up' : row.delta < 0 ? 'is-down' : 'is-flat';
    const trendLabel = row.delta > 0 ? `+${row.delta} foiz punkt · o‘sish` : row.delta < 0 ? `${row.delta} foiz punkt · pasayish` : '0 foiz punkt · o‘zgarmagan';
    return `<article class="habit-period-row" style="${habitAccent(row.habit)}"><span class="habit-period-icon" style="background:${color}22;color:${color}">${habitIcon(row.habit)}</span><div class="habit-period-main"><div class="habit-period-heading"><strong>${escapeHTML(row.habit.title)}</strong><span class="habit-period-delta ${trendClass}">${trendLabel}</span></div><div class="habit-period-bars"><div><small>So‘nggi 30 kun · ${row.currentDone}/30</small><span class="review-track"><i style="width:${row.currentRate}%;background:${color}"></i></span></div><div><small>Oldingi 30 kun · ${row.previousDone}/30</small><span class="review-track"><i style="width:${row.previousRate}%;background:${color};opacity:.48"></i></span></div></div></div></article>`;
  }).join('');
  const improved = rows.filter(row => row.delta > 0).length;
  const declined = rows.filter(row => row.delta < 0).length;
  if (note) note.textContent = `${rows.length} ta odat taqqoslandi · ${improved} tasi o‘sdi · ${declined} tasida pasayish kuzatildi. Har bir foiz 30 kunlik davrda bajarilgan kunlar ulushidir.`;
}

function renderHabitIntelligence() {
  const host = $('#habitIntelligence');
  if (!host) return;
  const habits = activeHabits();
  if (!habits.length) {
    host.innerHTML = '<article class="intelligence-item"><span class="intelligence-icon">＋</span><div><strong>Birinchi odatingizni qo‘shing</strong><p>Kamida bir hafta belgi qo‘yilgach, bu yerda shaxsiy naqshlar ko‘rinadi.</p></div></article>';
    return;
  }
  const rate = (habit, days, offset = 0) => {
    let done = 0;
    for (let i = offset; i < offset + days; i++) if (isChecked(habit.id, shiftDate(today(), -i))) done++;
    return Math.round(done / days * 100);
  };
  const ranked = habits.map(h => ({habit:h, rate:rate(h,30), recent:rate(h,7), previous:rate(h,7,7), streak:streakForHabit(h.id)}));
  const strongest = [...ranked].sort((a,b)=>b.rate-a.rate || b.streak-a.streak)[0];
  const weakest = [...ranked].sort((a,b)=>a.rate-b.rate)[0];
  const improving = ranked.filter(x=>x.recent>x.previous).length;
  const declining = ranked.filter(x=>x.recent<x.previous).length;
  const totalPossible = habits.length * 30;
  const totalDone = habits.reduce((sum,h)=>{ let n=0; for(let i=0;i<30;i++) if(isChecked(h.id,shiftDate(today(),-i))) n++; return sum+n; },0);
  const overall = Math.round(totalDone / Math.max(1,totalPossible) * 100);
  const cards = [];
  cards.push(`<article class="intelligence-item"><span class="intelligence-icon">↗</span><div><strong>Umumiy barqarorlik: ${overall}%</strong><p>Faol odatlaringizning oxirgi 30 kundagi o‘rtacha bajarilish darajasi.</p></div></article>`);
  if (strongest && strongest.rate > 0) cards.push(`<article class="intelligence-item"><span class="intelligence-icon">🏆</span><div><strong>Kuchli odat: ${escapeHTML(strongest.habit.title)} · ${strongest.rate}%</strong><p>${strongest.streak} kunlik joriy seriya. Shu odatni qaysi vaqtda bajarishingizni kuzatib, foydali sharoitni takrorlang.</p></div></article>`);
  if (weakest) cards.push(`<article class="intelligence-item"><span class="intelligence-icon">🎯</span><div><strong>E’tibor talab qiladi: ${escapeHTML(weakest.habit.title)} · ${weakest.rate}%</strong><p>Keyingi 7 kun uchun maqsadni kichikroq qadamga ajrating va bajarishni qulay vaqtga bog‘lang.</p></div></article>`);
  cards.push(`<article class="intelligence-item"><span class="intelligence-icon">◷</span><div><strong>So‘nggi haftadagi yo‘nalish</strong><p>${improving} ta odat oldingi haftaga nisbatan yaxshilangan${declining ? `, ${declining} tasi pasaygan` : ''}. ${declining ? 'Pasaygan odatlarni vaqtincha soddalashtirish foydali bo‘lishi mumkin.' : 'Hozircha pasayish kuzatilmayapti; shu ritmni saqlang.'}</p></div></article>`);
  host.innerHTML = cards.join('');
}

function longestOverallStreak() {
  const active = activeHabits();
  if (!active.length) return 0;
  const dates = [...new Set(state.logs.map(log => log.date).filter(validDate))].sort();
  if (!dates.length) return 0;
  let best = 0, run = 0, previous = null;
  for (const date of dates) {
    run = previous && shiftDate(previous, 1) === date ? run + 1 : 1;
    best = Math.max(best, run);
    previous = date;
  }
  return best;
}

function renderAchievements() {
  const total = state.logs.length;
  const streak = currentStreak();
  const habits = state.habits.length;
  const xp = xpTotal();
  const sessions = Number(state.pomodoro?.sessions || 0);
  const level = Math.floor(xp / 100) + 1;
  const levelXP = xp % 100;
  const titles = ['Boshlovchi', 'Izlanuvchi', 'Intiluvchi', 'Barqaror', 'Usta', 'Chempion', 'Afsona'];
  const title = titles[Math.min(titles.length - 1, Math.floor((level - 1) / 3))];
  const setText = (id, value) => { const el = $('#' + id); if (el) el.textContent = value; };
  setText('gameXP', `${xp} XP`);
  setText('gameLevel', String(level));
  setText('gameTitle', title);
  setText('bestStreak', `${longestOverallStreak()} kun`);
  setText('nextLevelLabel', `${level + 1}-darajaga yo‘l`);
  setText('levelProgressText', `${levelXP} / 100 XP`);
  setText('levelRewardText', `${100 - levelXP} XP dan so‘ng yangi darajaga chiqasiz.`);
  const levelBar = $('#levelProgressBar'); if (levelBar) levelBar.style.width = `${levelXP}%`;
  const badges = [
    { icon: '🌱', name: 'Birinchi qadam', desc: 'Birinchi odatingizni yarating.', value: habits, goal: 1, unit: 'odat' },
    { icon: '✅', name: 'Boshlanish', desc: 'Birinchi odatni bajaring.', value: total, goal: 1, unit: 'bajarilish' },
    { icon: '🔥', name: 'Uch kunlik olov', desc: '3 kunlik ketma-ket seriyaga erishing.', value: streak, goal: 3, unit: 'kun' },
    { icon: '⚡', name: 'Bir haftalik ritm', desc: '7 kunlik seriyani saqlang.', value: streak, goal: 7, unit: 'kun' },
    { icon: '💎', name: 'Ikki haftalik qat’iyat', desc: '14 kun davomida izchil bo‘ling.', value: streak, goal: 14, unit: 'kun' },
    { icon: '🏆', name: 'Bir oylik afsona', desc: '30 kunlik seriyaga erishing.', value: streak, goal: 30, unit: 'kun' },
    { icon: '📚', name: 'Odatlar kolleksiyasi', desc: '5 ta odat yarating.', value: habits, goal: 5, unit: 'odat' },
    { icon: '🎯', name: 'Maqsad sari', desc: '10 ta odat yarating.', value: habits, goal: 10, unit: 'odat' },
    { icon: '🌟', name: 'O‘nlik', desc: '10 marta odatlarni bajaring.', value: total, goal: 10, unit: 'marta' },
    { icon: '🚀', name: 'Yuzlik', desc: '100 ta bajarilishni jamlang.', value: total, goal: 100, unit: 'marta' },
    { icon: '🧠', name: 'Fokus ustasi', desc: '5 ta Pomodoro sessiyasini yakunlang.', value: sessions, goal: 5, unit: 'sessiya' },
    { icon: '👑', name: 'Tajriba yig‘uvchi', desc: '500 XP to‘plang.', value: xp, goal: 500, unit: 'XP' }
  ];
  const unlocked = badges.filter(b => b.value >= b.goal).length;
  setText('achievementUnlocked', `${unlocked} / ${badges.length}`);
  const overall = $('#achievementOverall'); if (overall) overall.style.width = `${unlocked / badges.length * 100}%`;
  const grid = $('#achievementGrid');
  if (grid) grid.innerHTML = badges.map(b => {
    const done = b.value >= b.goal;
    const percent = Math.min(100, Math.round(b.value / b.goal * 100));
    return `<article class="achievement-card ${done ? 'unlocked' : 'locked'}"><div class="achievement-card-top"><span class="achievement-icon">${b.icon}</span><span class="achievement-state">${done ? '✓ OCHILDI' : '🔒 QULFLANGAN'}</span></div><h3>${b.name}</h3><p>${b.desc}</p><div class="achievement-progress"><span style="width:${percent}%"></span></div><div class="achievement-progress-label"><span>${Math.min(b.value, b.goal)} / ${b.goal} ${b.unit}</span><b>${percent}%</b></div></article>`;
  }).join('');
  // Weekly quests are calculated from existing logs; no new storage fields are needed.
  const questStart = shiftDate(today(), -6);
  const weekLogs = state.logs.filter(log => log.date >= questStart && log.date <= today());
  const activeDays = new Set(weekLogs.map(log => log.date)).size;
  const uniqueHabits = new Set(weekLogs.map(log => String(log.habitId))).size;
  const daysWithMultiple = new Set(weekLogs.filter(log => weekLogs.filter(x => x.date === log.date).length >= 2).map(log => log.date)).size;
  const weekHabitTarget = Math.min(4, Math.max(2, state.habits.filter(h => !h.archived).length));
  const questPool = [
    { icon: '🔥', title: 'Barqarorlik', detail: '5 xil kunda odat bajaring', value: activeDays, goal: 5, unit: 'kun' },
    { icon: '🎯', title: 'Maqsad sari', detail: 'Hafta davomida 10 ta bajarilish', value: weekLogs.length, goal: 10, unit: 'marta' },
    { icon: '🌿', title: 'Xilma-xillik', detail: '3 xil odat ustida ishlang', value: uniqueHabits, goal: 3, unit: 'odat' },
    { icon: '⚡', title: 'Ikki karra harakat', detail: '2 xil kunda kamida 2 tadan odat bajaring', value: daysWithMultiple, goal: 2, unit: 'kun' },
    { icon: '🧩', title: 'Odatlar jamoasi', detail: `${weekHabitTarget} xil odatni bajaring`, value: uniqueHabits, goal: weekHabitTarget, unit: 'odat' },
    { icon: '🌤️', title: 'Qayta boshlash', detail: 'Hafta davomida 3 ta bajarilishni jamlang', value: weekLogs.length, goal: 3, unit: 'marta' }
  ];
  // Rotate three quests each week using a stable week index; no extra storage is needed.
  const monday = new Date(`${questStart}T12:00:00`);
  const weekIndex = Math.floor((monday - new Date('2024-01-01T12:00:00')) / (7 * 86400000));
  const questOffset = ((weekIndex % questPool.length) + questPool.length) % questPool.length;
  const quests = [0, 1, 2].map(i => questPool[(questOffset + i) % questPool.length]);
  const questGrid = $('#weeklyChallenges');
  if (questGrid) questGrid.innerHTML = quests.map(q => {
    const done = q.value >= q.goal;
    const pct = Math.min(100, Math.round(q.value / q.goal * 100));
    return `<article class="challenge-card ${done ? 'completed' : ''}"><div class="challenge-top"><span>${q.icon}</span><b>${done ? '✓ BAJARILDI' : 'DAVOM ETMOQDA'}</b></div><h3>${q.title}</h3><p>${q.detail}</p><div class="challenge-track"><span style="width:${pct}%"></span></div><div class="challenge-meta"><span>${Math.min(q.value,q.goal)} / ${q.goal} ${q.unit}</span><strong>${pct}%</strong></div></article>`;
  }).join('');
  // A compact seven-day activity map, derived only from the existing habit log.
  const weekMap = $('#weeklyQuestCalendar');
  if (weekMap) {
    const dayLabels = ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'];
    const todayDate = today();
    const cells = Array.from({ length: 7 }, (_, i) => {
      const date = shiftDate(todayDate, i - 6);
      const count = weekLogs.filter(log => log.date === date).length;
      const day = new Date(`${date}T12:00:00`).getDay();
      const label = dayLabels[(day + 6) % 7];
      const isToday = date === todayDate;
      return `<div class="quest-day ${count ? 'has-activity' : ''} ${isToday ? 'is-today' : ''}" title="${date}: ${count} ta bajarilish"><span>${label}</span><b>${date.slice(8,10)}</b><small>${count ? `${count} ta` : '—'}</small></div>`;
    });
    const activeCount = cells.filter((_, i) => weekLogs.some(log => log.date === shiftDate(todayDate, i - 6))).length;
    weekMap.innerHTML = `<div class="quest-map-heading"><strong>7 KUNLIK FAOLLIK</strong><span>${activeCount}/7 faol kun</span></div><div class="quest-day-grid">${cells.join('')}</div>`;
  }
  // Weekly review: a read-only summary derived from the same seven-day log window.
  const recap = $('#weeklyRecap');
  if (recap) {
    const dayNames = ['Yakshanba', 'Dushanba', 'Seshanba', 'Chorshanba', 'Payshanba', 'Juma', 'Shanba'];
    const dailyCounts = Array.from({ length: 7 }, (_, i) => {
      const date = shiftDate(today(), i - 6);
      return { date, count: weekLogs.filter(log => log.date === date).length };
    });
    const activeDayCount = dailyCounts.filter(day => day.count > 0).length;
    const bestDay = dailyCounts.reduce((best, day) => day.count > best.count ? day : best, { date: '', count: 0 });
    const bestDayName = bestDay.count ? dayNames[parseDate(bestDay.date).getDay()] : 'Hali aniqlanmagan';
    const habitCounts = new Map();
    weekLogs.forEach(log => habitCounts.set(String(log.habitId), (habitCounts.get(String(log.habitId)) || 0) + 1));
    const topHabitEntry = [...habitCounts.entries()].sort((a, b) => b[1] - a[1])[0];
    const topHabit = topHabitEntry ? (state.habits.find(h => String(h.id) === topHabitEntry[0])?.name || 'Noma’lum odat') : 'Hali ma’lumot yo‘q';
    const cards = [
      { icon: '✓', label: 'Jami bajarilish', value: String(weekLogs.length), note: 'so‘nggi 7 kun' },
      { icon: '🔥', label: 'Faol kunlar', value: `${activeDayCount}/7`, note: 'kamida bitta odat bajarilgan' },
      { icon: '☀️', label: 'Eng faol kun', value: bestDayName, note: bestDay.count ? `${bestDay.count} ta bajarilish` : 'faollik qayd etilmagan' },
      { icon: '🏅', label: 'Yetakchi odat', value: topHabit, note: topHabitEntry ? `${topHabitEntry[1]} marta bajarilgan` : 'hali bajarilish yo‘q' }
    ];
    recap.innerHTML = cards.map(card => `<article class="weekly-recap-card"><span class="weekly-recap-icon">${card.icon}</span><span class="weekly-recap-label">${card.label}</span><strong>${escapeHTML(card.value)}</strong><small>${card.note}</small></article>`).join('');
  }

  const list = $('#habitXPList');
  if (list) {
    const rows = state.habits.map(h => ({ habit: h, count: state.logs.filter(log => log.habitId === h.id).length }))
      .sort((a,b) => b.count - a.count);
    list.innerHTML = rows.length ? rows.map(({habit,count}) => `<div class="habit-stat-row"><div class="habit-stat-name"><span>${escapeHTML(habit.icon || '🎯')}</span><strong>${escapeHTML(habit.name)}</strong></div><div class="habit-stat-track"><span style="width:${Math.min(100, count / Math.max(1, rows[0].count) * 100)}%;background:${escapeHTML(habit.color || 'var(--lime)')} "></span></div><b>${count * 10} XP</b></div>`).join('') : '<p class="subheading">Odat qo‘shganingizdan so‘ng XP reytingi shu yerda ko‘rinadi.</p>';
  }
}

/* ==============================
   IMPORT / EXPORT / RESET
============================== */

function exportData() {
  const blob = new Blob([
    JSON.stringify({
      ...state,
      exportedAt: new Date().toISOString(),
      app: 'VERTEX Growth System'
    }, null, 2)
  ], { type: 'application/json' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vertex-backup-${today()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();

  // Mobil brauzerlarda yuklash tugashiga vaqt beramiz.
  setTimeout(() => URL.revokeObjectURL(url), 1500);
  notify('Zaxira fayli tayyor.');
}

function importData(file) {
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    notify('Fayl hajmi 2 MB dan kichik bo‘lishi kerak.');
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
          !Array.isArray(parsed.habits)) {
        throw new Error('invalid');
      }
      if (!confirm('Import qilingan ma’lumotlar hozirgi ma’lumotlaringizni almashtiradi. Davom etasizmi?')) {
        return;
      }
      state = normalizeState(parsed);
      pauseTimer();
      timerSeconds = modeDuration(state.pomodoro.mode);
      persistTimer();
      saveState();
      renderAll();
      notify('Ma’lumotlar muvaffaqiyatli tiklandi.');
    } catch (error) {
      console.error('Import xatosi:', error);
      notify('Fayl noto‘g‘ri yoki Vertex zaxira nusxasi emas.');
    }
  };
  reader.onerror = () => notify('Faylni o‘qib bo‘lmadi. Qayta urinib ko‘ring.');
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm('Barcha odatlar, tarix va vazifalarni o‘chirishni xohlaysizmi? Bu amalni ortga qaytarib bo‘lmaydi.')) {
    return;
  }
  pauseTimer();
  state = DEFAULT_STATE();
  timerSeconds = state.settings.focusMinutes * 60;
  persistTimer();
  saveState();
  renderAll();
  goTo('dashboard');
  notify('Ish maydoni tozalandi.');
}

/* ==============================
   HODISALAR
============================== */

function bindEvents() {
  $('.habit-icon-picker').addEventListener('click', event => {
    const button = event.target.closest('[data-habit-icon]');
    if (!button) return;
    selectedHabitIcon = button.dataset.habitIcon;
    updateHabitPickerSelection();
  });
  $('.habit-color-picker').addEventListener('click', event => {
    const button = event.target.closest('[data-habit-color]');
    if (!button) return;
    selectedHabitColor = normalizeHabitColor(button.dataset.habitColor);
    updateHabitPickerSelection();
  });
  $$('.nav-item[data-page]').forEach(button => {
    button.addEventListener('click', () => goTo(button.dataset.page));
  });
  $$('[data-goto]').forEach(button => {
    button.addEventListener('click', () => goTo(button.dataset.goto));
  });
  $$('[data-action="add-habit"]').forEach(button => {
    button.addEventListener('click', () => openHabitModal());
  });
  $$('[data-action="add-task"]').forEach(button => {
    button.addEventListener('click', openTaskModal);
  });

  $('#quickSettings').addEventListener('click', () => goTo('settings'));
  $('#topSettings').addEventListener('click', () => goTo('settings'));
  $('#mobileMenu').addEventListener('click', () => $('#sidebar').classList.toggle('open'));

  $('#showArchived').addEventListener('change', event => {
    showArchived = event.target.checked;
    renderHabits();
  });

  $('#categoryFilters').addEventListener('click', event => {
    const button = event.target.closest('[data-filter]');
    if (!button) return;
    activeFilter = button.dataset.filter;
    renderHabits();
  });

  document.addEventListener('click', event => {
    const toggle = event.target.closest('[data-toggle-check]');
    if (toggle) {
      toggleCheck(toggle.dataset.toggleCheck, toggle.dataset.date);
      return;
    }

    const task = event.target.closest('[data-toggle-task]');
    if (task) {
      const item = state.tasks.find(t => t.id === task.dataset.toggleTask);
      if (item) {
        item.done = !item.done;
        const newlyCompleted = item.done;
        saveState();
        renderAll();
        if (newlyCompleted && item.date === today()) {
          celebrateCompletion('Zo‘r! Vazifani bajardingiz!');
        }
      }
      return;
    }

    const edit = event.target.closest('[data-edit-habit]');
    if (edit) {
      openHabitModal(state.habits.find(h => h.id === edit.dataset.editHabit));
      return;
    }

    const archive = event.target.closest('[data-archive-habit]');
    if (archive) {
      archiveHabit(archive.dataset.archiveHabit);
      return;
    }

    const del = event.target.closest('[data-delete-habit]');
    if (del) {
      deleteHabit(del.dataset.deleteHabit);
      return;
    }

    const delTask = event.target.closest('[data-delete-task]');
    if (delTask) {
      const item = state.tasks.find(t => t.id === delTask.dataset.deleteTask);
      if (item && confirm(`“${item.title}” vazifasini o‘chirasizmi?`)) {
        state.tasks = state.tasks.filter(t => t.id !== item.id);
        window.VertexSupabaseAuth?.cancelTaskReminder?.(item.id);
        saveState();
        renderAll();
        notify('Vazifa o‘chirildi.');
      }
      return;
    }

    if (event.target.closest('[data-close-modal]')) closeModals();
    if (event.target.classList.contains('modal-backdrop')) closeModals();
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModals();
  });

  $('#habitForm').addEventListener('submit', event => {
    event.preventDefault();
    const data = {
      title: $('#habitTitle').value.trim(),
      category: $('#habitCategory').value,
      targetDays: $('#habitTarget').value,
      color: selectedHabitColor || DEFAULT_HABIT_COLOR,
      icon: selectedHabitIcon || DEFAULT_HABIT_ICON
    };
    if (!data.title) return;
    const id = $('#habitId').value;
    if (id) updateHabit(id, data);
    else addHabit(data);
    closeModals();
  });

  $('#taskForm').addEventListener('submit', event => {
    event.preventDefault();
    const title = $('#taskTitleInput').value.trim();
    const date = $('#taskDateInput').value;
    if (!title || !validDate(date)) return;
    const time = $('#taskTimeInput').value || '';
    const reminderMinutes = Number($('#taskReminderInput').value || 0);
    state.tasks.push({ id: uid(), title, date, time, reminderMinutes, priority: $('#taskPriorityInput').value || 'medium', done: false });
    plannerDate = date;
    saveState();
    const createdTask = state.tasks[state.tasks.length - 1];
    window.VertexSupabaseAuth?.scheduleTaskReminder?.(createdTask).catch(error => { console.warn('Reminder scheduling:', error); notify('Vazifa saqlandi, lekin server eslatmasi sozlanmadi.'); });
    renderAll();
    closeModals();
    goTo('planner');
    notify('Vazifa qo‘shildi.');
  });

  $('#plannerDate').addEventListener('change', event => {
    if (validDate(event.target.value)) {
      plannerDate = event.target.value;
      renderPlanner();
    }
  });

  $('#timerModes').addEventListener('click', event => {
    const button = event.target.closest('[data-mode]');
    if (button) setTimerMode(button.dataset.mode);
  });
  $('#timerStart').addEventListener('click', startTimer);
  $('#timerReset').addEventListener('click', resetTimer);

  $('#profileForm').addEventListener('submit', event => {
    event.preventDefault();
    state.userName = $('#userNameInput').value.trim().slice(0, 40) || 'Foydalanuvchi';
    saveState();
    renderHeader();
    notify('Profil saqlandi.');
  });

  $('#vertexTimeZone')?.addEventListener('change', event => {
    const zone = event.target.value;
    if (!isValidTimeZone(zone)) return;
    state.settings.timeZone = zone;
    saveState();
    renderRegionalTime();
    notify('Hududiy vaqt sozlamasi saqlandi.');
  });
  $('#useDeviceTimeZone')?.addEventListener('click', () => {
    state.settings.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    saveState();
    renderSettings();
    notify('Qurilma vaqt zonasi tanlandi.');
  });

  $('#timerSettingsForm').addEventListener('submit', event => {
    event.preventDefault();
    state.settings.focusMinutes = clampInt($('#focusMinutes').value, 1, 120, 25);
    state.settings.shortMinutes = clampInt($('#shortMinutes').value, 1, 30, 5);
    state.settings.longMinutes = clampInt($('#longMinutes').value, 1, 60, 15);
    pauseTimer();
    timerSeconds = modeDuration(state.pomodoro.mode);
    persistTimer();
    saveState();
    renderTimer();
    renderDashboard();
    notify('Taymer sozlamalari saqlandi.');
  });

  $('#exportBtn').addEventListener('click', exportData);
  $('#importFile').addEventListener('change', event => {
    importData(event.target.files[0]);
    event.target.value = '';
  });
  $('#resetBtn').addEventListener('click', resetAll);

  const restoreButton = $('#restoreBackupBtn');
  if (restoreButton) {
    restoreButton.addEventListener('click', restoreBackup);
  }
}


async function enableVertexPush() {
  const status = document.getElementById('pushPermissionStatus');
  const button = document.getElementById('enablePushBtn');
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
    if (status) status.textContent = 'Bu brauzer push bildirishnomalarini qo‘llab-quvvatlamaydi.';
    return;
  }
  if (!window.VertexSupabaseAuth?.savePushSubscription) {
    if (status) status.textContent = 'Push server integratsiyasi hali sozlanmagan. Supabase sozlamalarini tekshiring.';
    return;
  }
  try {
    if (button) button.disabled = true;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Bildirishnoma ruxsati berilmadi. Brauzer sozlamalaridan ruxsat bering.');
    const registration = await navigator.serviceWorker.register('./service-worker.js');
    const publicKey = window.VERTEX_VAPID_PUBLIC_KEY;
    if (!publicKey) throw new Error('VAPID public key topilmadi. supabase-config.js ichiga VERTEX_VAPID_PUBLIC_KEY kiriting.');
    const applicationServerKey = urlBase64ToUint8Array(publicKey);
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey });
    await window.VertexSupabaseAuth.savePushSubscription(subscription.toJSON());
    if (status) status.textContent = '✓ Push bildirishnomalar yoqildi. Endi belgilangan vaqtda eslatmalar kelishi mumkin.';
    if (button) button.textContent = 'Yoqildi ✓';
    notify('Bildirishnomalar muvaffaqiyatli yoqildi.');
  } catch (error) {
    console.error('Vertex push setup:', error);
    if (status) status.textContent = error.message || 'Bildirishnomalarni yoqib bo‘lmadi.';
    notify(error.message || 'Push sozlamasida xatolik.');
  } finally { if (button) button.disabled = false; }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

function updatePushPermissionStatus() {
  const status = document.getElementById('pushPermissionStatus');
  const button = document.getElementById('enablePushBtn');
  if (!status || !('Notification' in window)) return;
  status.textContent = Notification.permission === 'granted' ? 'Bildirishnomalarga ruxsat berilgan.' : Notification.permission === 'denied' ? 'Bildirishnomalar brauzer sozlamalarida bloklangan.' : 'Hozircha ruxsat berilmagan.';
  if (button && Notification.permission === 'granted') button.textContent = 'Qayta ulash';
}


/* Vertex Focus Sounds — persistent Web Audio mixer. It lives outside page rendering,
   so changing app sections does not interrupt active layers. */
const VertexFocusAudio = (() => {
  const KEY = 'vertex_focus_audio_v1';
  const names = {rain:'Yomg‘ir',roofrain:'Tomdagi yomg‘ir',birds:'Qushlar',forest:'O‘rmon',whale:'Kitlar',ocean:'Okean to‘lqini',stream:'Jilg‘a',waterfall:'Sharshara',wind:'Shamol',leaves:'Barglar shitiri',fire:'Gulxan',crickets:'Tungi hasharotlar',thunder:'Momaqaldiroq',brown:'Brown noise',pink:'Pink noise',white:'White noise',cafe:'Kafe shovqini',library:'Kutubxona',fan:'Ventilyator',binaural:'Binaural 10 Hz','hz40':'40 Hz'};
  let ctx = null, master = null, limiter = null, layers = new Map(), masterVolume = 0.32, presets = {};
  let collapsed = false;
  const clamp = (n,min,max)=>Math.max(min,Math.min(max,n));
  function load(){try{const d=JSON.parse(localStorage.getItem(KEY)||'{}');masterVolume=clamp(Number(d.master ?? 32),0,70)/100;presets=d.presets||{};}catch(_){}}
  function save(){try{localStorage.setItem(KEY,JSON.stringify({master:Math.round(masterVolume*100),presets}));}catch(_){}}
  function ensure(){if(ctx)return;const AC=window.AudioContext||window.webkitAudioContext;if(!AC)throw new Error('Web Audio qo‘llab-quvvatlanmaydi');ctx=new AC();master=ctx.createGain();master.gain.value=masterVolume;limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-8;limiter.knee.value=8;limiter.ratio.value=12;limiter.attack.value=.004;limiter.release.value=.18;master.connect(limiter);limiter.connect(ctx.destination);}
  function noiseSource(type){const size=ctx.sampleRate*3,buffer=ctx.createBuffer(1,size,ctx.sampleRate),data=buffer.getChannelData(0);let last=0,b0=0,b1=0,b2=0,b3=0,b4=0,b5=0;for(let i=0;i<size;i++){const white=Math.random()*2-1;if(type==='brown'||type==='wind'||type==='ocean'||type==='thunder'){last=(last+.018*white)/1.018;data[i]=last*3.2;}else if(type==='pink'||type==='rain'||type==='roofrain'||type==='stream'||type==='fire'||type==='leaves'){b0=.99886*b0+white*.0555179;b1=.99332*b1+white*.0750759;b2=.969*b2+white*.153852;b3=.8665*b3+white*.3104856;b4=.55*b4+white*.5329522;b5=-.7616*b5-white*.016898;data[i]=(b0+b1+b2+b3+b4+b5+white*.5362)*.11;}else{data[i]=white*.5;}}const src=ctx.createBufferSource();src.buffer=buffer;src.loop=true;return src;}
  function addOsc(freq,type='sine',detune=0){const o=ctx.createOscillator();o.type=type;o.frequency.value=freq;o.detune.value=detune;return o;}
  function startLayer(id,volume=.22){ensure();if(ctx.state==='suspended')ctx.resume();if(layers.has(id))return;
    const gain=ctx.createGain();gain.gain.value=0;gain.connect(master);const nodes=[];
    // Original natural-style stereo loops generated for Vertex. Remaining layers keep their synth engines.
    const audioAssets={rain:'rain_soft_roof.wav',roofrain:'rain_soft_roof.wav',birds:'quiet_forest_birds.wav',forest:'quiet_forest_birds.wav',wind:'wind_in_trees.wav',ocean:'ocean_waves.wav',stream:'flowing_stream.wav',waterfall:'flowing_stream.wav',fire:'fireplace_crackle.wav',brown:'brown_noise.wav',pink:'pink_noise.wav'};
    if(audioAssets[id]){
      const audio=new Audio(`./assets/audio/${audioAssets[id]}`);audio.loop=true;audio.preload='auto';audio.crossOrigin='anonymous';
      const source=ctx.createMediaElementSource(audio);source.connect(gain);nodes.push(source,audio);
      audio.play().catch(err=>console.warn('Vertex audio playback:',err));
    } else {
    const addNoise=(kind,filterType,frequency,q=0.7,modulation=0)=>{const src=noiseSource(kind),filter=ctx.createBiquadFilter();filter.type=filterType;filter.frequency.value=frequency;filter.Q.value=q;src.connect(filter);filter.connect(gain);src.start();nodes.push(src,filter);if(modulation){const lfo=addOsc(modulation,'sine'),depth=ctx.createGain();depth.gain.value=frequency*.32;lfo.connect(depth);depth.connect(filter.frequency);lfo.start();nodes.push(lfo,depth);}};
    if(id==='rain')addNoise('rain','lowpass',4300);
    else if(id==='roofrain')addNoise('roofrain','bandpass',1700,0.55);
    else if(id==='wind')addNoise('wind','lowpass',850,.5,.08);
    else if(id==='ocean')addNoise('ocean','lowpass',1100,.7,.07);
    else if(id==='stream')addNoise('stream','bandpass',2100,.45);
    else if(id==='waterfall')addNoise('white','highpass',650,.4);
    else if(id==='leaves')addNoise('leaves','highpass',1250,.7);
    else if(id==='fire'){addNoise('fire','bandpass',950,.8);const crack=addOsc(42,'sawtooth');const cg=ctx.createGain();cg.gain.value=.012;crack.connect(cg);cg.connect(gain);crack.start();nodes.push(crack,cg);}
    else if(id==='thunder'){addNoise('thunder','lowpass',180,.6,.035);}
    else if(id==='brown'||id==='pink'||id==='white')addNoise(id,id==='brown'?'lowpass':id==='pink'?'bandpass':'highpass',id==='brown'?500:id==='pink'?1800:5000,.45);
    else if(id==='fan')addNoise('brown','lowpass',620,.35);
    else if(id==='cafe'){addNoise('pink','lowpass',1800,.35);}
    else if(id==='library'){addNoise('pink','lowpass',850,.45);}
    else if(id==='forest'){addNoise('wind','lowpass',650,.55,.06);for(let i=0;i<2;i++){const osc=addOsc(1900+i*500,'sine'),lfo=addOsc(.17+i*.11);const og=ctx.createGain();og.gain.value=.006;lfo.connect(og);og.connect(osc.frequency);osc.connect(gain);osc.start();lfo.start();nodes.push(osc,lfo,og);}}
    else if(id==='crickets'){for(let i=0;i<3;i++){const osc=addOsc(3600+i*420,'sine'),pulse=addOsc(4.2+i*.8),pg=ctx.createGain(),tone=ctx.createGain();pg.gain.value=0.5; pulse.connect(pg.gain);tone.gain.value=.008;osc.connect(tone);tone.connect(gain);osc.start();pulse.start();nodes.push(osc,pulse,pg,tone);}}
    else if(id==='birds'){for(let i=0;i<3;i++){const osc=addOsc(1600+i*430,'sine');const g=ctx.createGain();g.gain.value=0;const lfo=addOsc(.22+i*.13,'sine');const lfoGain=ctx.createGain();lfoGain.gain.value=.045;lfo.connect(lfoGain);lfoGain.connect(g.gain);osc.connect(g);g.connect(gain);osc.start();lfo.start();nodes.push(osc,g,lfo,lfoGain);}}
    else if(id==='whale'){const osc=addOsc(180,'sine');const lfo=addOsc(.055,'sine');const depth=ctx.createGain();depth.gain.value=75;lfo.connect(depth);depth.connect(osc.frequency);osc.connect(gain);osc.start();lfo.start();nodes.push(osc,lfo,depth);}
    else if(id==='binaural'){const left=addOsc(200),right=addOsc(210);const merger=ctx.createChannelMerger(2),gl=ctx.createGain(),gr=ctx.createGain();gl.gain.value=.5;gr.gain.value=.5;left.connect(gl);right.connect(gr);gl.connect(merger,0,0);gr.connect(merger,0,1);merger.connect(gain);left.start();right.start();nodes.push(left,right,gl,gr,merger);}
    else if(id==='hz40'){const osc=addOsc(40);osc.connect(gain);osc.start();nodes.push(osc);}
    }
    gain.gain.setTargetAtTime(volume,ctx.currentTime,.45);layers.set(id,{gain,nodes,volume});render();
  }
  function stopLayer(id){
    const layer=layers.get(id);
    if(!layer)return;
    // Remove this exact layer immediately. The delayed cleanup must still run even
    // if the same sound is started again before the fade-out finishes.
    layers.delete(id);
    try{layer.gain.gain.cancelScheduledValues(ctx.currentTime);layer.gain.gain.setTargetAtTime(0,ctx.currentTime,.12);}catch(_){}
    setTimeout(()=>{
      layer.nodes.forEach(node=>{
        try{
          if(typeof HTMLAudioElement!=='undefined' && node instanceof HTMLAudioElement){
            node.pause();
            node.currentTime=0;
            node.removeAttribute('src');
            node.load();
          }else{
            if(typeof node.stop==='function')node.stop();
            if(typeof node.disconnect==='function')node.disconnect();
          }
        }catch(_){}
      });
      try{layer.gain.disconnect();}catch(_){}
    },500);
    render();
  }
  function setVolume(id,v){const l=layers.get(id);if(!l)return;l.volume=clamp(Number(v),0,70)/100;l.gain.gain.setTargetAtTime(l.volume,ctx.currentTime,.08);}
  function render(){document.querySelectorAll('.sound-layer').forEach(b=>{const on=layers.has(b.dataset.sound);b.classList.toggle('active',on);b.setAttribute('aria-pressed',String(on));});const list=document.getElementById('soundActiveList');if(list){if(!layers.size)list.innerHTML='<span>Ovoz tanlanmagan</span>';else list.innerHTML=[...layers.entries()].map(([id,l])=>`<label class="sound-active-row"><span>${names[id]}</span><input type="range" min="0" max="70" value="${Math.round(l.volume*100)}" data-layer-volume="${id}" aria-label="${names[id]} ovozi"><b>${Math.round(l.volume*100)}%</b></label>`).join('');}const m=document.getElementById('soundMaster');if(m)m.value=Math.round(masterVolume*100);const out=document.getElementById('soundMasterValue');if(out)out.textContent=`${Math.round(masterVolume*100)}%`;const sel=document.getElementById('soundPresetSelect');if(sel){const keep=sel.value;sel.innerHTML='<option value="">Preset tanlang</option>'+Object.keys(presets).map(k=>`<option value="${k.replace(/"/g,'&quot;')}">${k}</option>`).join('');sel.value=keep;}}
  function setMaster(v){masterVolume=clamp(Number(v),0,70)/100;if(master)master.gain.setTargetAtTime(masterVolume,ctx.currentTime,.08);save();render();}
  function stopAll(){[...layers.keys()].forEach(stopLayer);}
  function applyPreset(name){const ids=presets[name];if(!Array.isArray(ids))return;stopAll();ids.forEach(id=>{if(names[id])startLayer(id,.22);});}
  const MUSIC_DB = 'vertex_local_music_v1';
  const MUSIC_STORE = 'tracks';
  let localTracks = [];
  let currentTrackId = null;
  let localMusicAudio = null;
  let localMusicUrl = null;
  let localMusicSource = null;
  let localMusicGain = null;
  let musicSeeking = false;
  function openMusicDB(){
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)){reject(new Error('IndexedDB mavjud emas'));return;}
      const req=indexedDB.open(MUSIC_DB,1);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(MUSIC_STORE))db.createObjectStore(MUSIC_STORE,{keyPath:'id'});};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  async function musicDB(action, value){
    const db=await openMusicDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(MUSIC_STORE, action==='getAll'?'readonly':'readwrite');
      const store=tx.objectStore(MUSIC_STORE);
      const req=action==='getAll'?store.getAll():action==='put'?store.put(value):store.delete(value);
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
      tx.oncomplete=()=>db.close();tx.onerror=()=>{db.close();reject(tx.error);};
    });
  }
  function safeTrackName(name){return String(name||'Audio').replace(/[<>]/g,'').slice(0,90);}
  async function refreshLocalTracks(){
    const list=document.getElementById('vertexLocalAudioList');if(!list)return;
    try{localTracks=await musicDB('getAll');}catch(err){list.innerHTML='<span>Qurilmada audio saqlash qo‘llab-quvvatlanmaydi.</span>';return;}
    const status=document.getElementById('vertexPlayerStatus');
    if(!localTracks.length){list.innerHTML='<span>Hozircha tanlangan qo‘shiqlar yo‘q.</span>';if(status)status.textContent='Kutubxonani ochib, qo‘shiqlarni tanlang';return;}
    list.innerHTML=localTracks.map((t,i)=>`<div class="sound-device-track ${currentTrackId===t.id?'is-playing':''}"><span title="${escapeHTML(safeTrackName(t.name))}">${i+1}. ${escapeHTML(safeTrackName(t.name))}</span><button type="button" data-local-play="${t.id}" aria-label="Ijro etish">${currentTrackId===t.id&&localMusicAudio&&!localMusicAudio.paused?'⏸':'▶'}</button><button type="button" data-local-delete="${t.id}" aria-label="O‘chirish">×</button></div>`).join('');
    const current=localTracks.find(t=>t.id===currentTrackId);
    const title=document.getElementById('vertexNowPlaying');if(title&&current)title.textContent=safeTrackName(current.name);
    const play=document.getElementById('vertexMusicPlay');if(play)play.textContent=localMusicAudio&&!localMusicAudio.paused?'Ⅱ':'▶';
  }
  async function addLocalFiles(files){
    for(const file of [...files]){
      if(!file.type.startsWith('audio/') && !/\.(mp3|m4a|wav|ogg|aac|flac)$/i.test(file.name))continue;
      await musicDB('put',{id:(crypto.randomUUID?.()||`${Date.now()}_${Math.random()}`),name:safeTrackName(file.name),type:file.type||'audio/mpeg',blob:file,addedAt:Date.now()});
    }
    await refreshLocalTracks();
  }
  function stopLocalMusic(){
    if(localMusicAudio){try{localMusicAudio.pause();localMusicAudio.currentTime=0;}catch(_){}}
    if(localMusicUrl){try{URL.revokeObjectURL(localMusicUrl);}catch(_){}}
    if(localMusicSource){try{localMusicSource.disconnect();}catch(_){}}
    if(localMusicGain){try{localMusicGain.disconnect();}catch(_){}}
    localMusicAudio=null;localMusicUrl=null;localMusicSource=null;localMusicGain=null;currentTrackId=null;
  }
  async function playLocalTrack(id){
    const track=localTracks.find(t=>t.id===id);if(!track)return;
    if(currentTrackId===id){stopLocalMusic();refreshLocalTracks();return;}
    stopLocalMusic();ensure();if(ctx.state==='suspended')await ctx.resume();
    const url=URL.createObjectURL(track.blob);
    const audio=new Audio(url);audio.preload='auto';
    const source=ctx.createMediaElementSource(audio),gain=ctx.createGain();gain.gain.value=.8;
    source.connect(gain);gain.connect(master);
    localMusicAudio=audio;localMusicUrl=url;localMusicSource=source;localMusicGain=gain;currentTrackId=id;
    audio.addEventListener('loadedmetadata',updatePlayerProgress);
    audio.addEventListener('timeupdate',updatePlayerProgress);
    audio.addEventListener('ended',()=>{const idx=localTracks.findIndex(t=>t.id===id);if(idx>=0&&idx<localTracks.length-1)playLocalTrack(localTracks[idx+1].id);else{stopLocalMusic();updatePlayerProgress();refreshLocalTracks();}},{once:true});
    const title=document.getElementById('vertexNowPlaying');if(title)title.textContent=safeTrackName(track.name);
    const status=document.getElementById('vertexPlayerStatus');if(status)status.textContent='Hozir ijro etilmoqda';
    try{await audio.play();}catch(err){stopLocalMusic();URL.revokeObjectURL(url);if(status)status.textContent='Ijro etib bo‘lmadi — boshqa formatni sinab ko‘ring';alert('Bu audio formatini brauzer ijro eta olmadi. MP3 yoki M4A faylini sinab ko‘ring.');}
    refreshLocalTracks();updatePlayerProgress();
  }
  function formatMusicTime(value){if(!Number.isFinite(value)||value<0)return '0:00';const m=Math.floor(value/60),sec=Math.floor(value%60);return `${m}:${String(sec).padStart(2,'0')}`;}
  function updatePlayerProgress(){const a=localMusicAudio;const seek=document.getElementById('vertexMusicSeek');const cur=document.getElementById('vertexCurrentTime');const dur=document.getElementById('vertexDuration');if(cur)cur.textContent=formatMusicTime(a?.currentTime||0);if(dur)dur.textContent=formatMusicTime(a?.duration||0);if(seek&&!musicSeeking){seek.value=a&&Number.isFinite(a.duration)&&a.duration>0?Math.round(a.currentTime/a.duration*1000):0;}const play=document.getElementById('vertexMusicPlay');if(play)play.textContent=a&&!a.paused?'Ⅱ':'▶';}
  function playNextTrack(direction){if(!localTracks.length)return;let i=localTracks.findIndex(t=>t.id===currentTrackId);i=i<0?(direction>0?0:localTracks.length-1):(i+direction+localTracks.length)%localTracks.length;playLocalTrack(localTracks[i].id);}
  function init(){load();const masterInput=document.getElementById('soundMaster');if(masterInput){masterInput.max='70';masterInput.value=Math.round(masterVolume*100);masterInput.addEventListener('input',e=>setMaster(e.target.value));}document.getElementById('soundMasterValue')?.replaceChildren(document.createTextNode(`${Math.round(masterVolume*100)}%`));
    document.getElementById('vertexGrantMusicAccess')?.addEventListener('click',()=>document.getElementById('vertexLocalAudioFiles')?.click());
    document.getElementById('vertexLocalAudioFiles')?.addEventListener('change',async e=>{try{await addLocalFiles(e.target.files);const status=document.getElementById('vertexPlayerStatus');if(status)status.textContent=`${e.target.files.length} ta audio fayl kutubxonaga qo‘shildi`;if(!currentTrackId&&localTracks.length)playLocalTrack(localTracks[0].id);}catch(err){console.error('Local audio import:',err);alert('Qo‘shiqlarni qurilmada saqlashda xatolik yuz berdi.');}e.target.value='';});
    document.getElementById('vertexMusicPlay')?.addEventListener('click',async()=>{if(!localMusicAudio){if(localTracks.length)await playLocalTrack(localTracks[0].id);else document.getElementById('vertexLocalAudioFiles')?.click();return;}if(localMusicAudio.paused){try{await localMusicAudio.play();}catch(e){console.warn(e);}}else localMusicAudio.pause();updatePlayerProgress();refreshLocalTracks();});
    document.getElementById('vertexMusicPrev')?.addEventListener('click',()=>playNextTrack(-1));
    document.getElementById('vertexMusicNext')?.addEventListener('click',()=>playNextTrack(1));
    document.getElementById('vertexMusicSeek')?.addEventListener('input',e=>{musicSeeking=true;if(localMusicAudio&&Number.isFinite(localMusicAudio.duration)){localMusicAudio.currentTime=Number(e.target.value)/1000*localMusicAudio.duration;updatePlayerProgress();}});
    document.getElementById('vertexMusicSeek')?.addEventListener('change',()=>{musicSeeking=false;updatePlayerProgress();});
    document.getElementById('vertexMusicVolume')?.addEventListener('input',e=>{const v=Number(e.target.value)/100;if(localMusicGain)localMusicGain.gain.setTargetAtTime(v,ctx.currentTime,.04);});
    document.addEventListener('click',e=>{const play=e.target.closest('[data-local-play]');if(play){playLocalTrack(play.dataset.localPlay);return;}const del=e.target.closest('[data-local-delete]');if(del){if(currentTrackId===del.dataset.localDelete)stopLocalMusic();musicDB('delete',del.dataset.localDelete).then(refreshLocalTracks).catch(console.error);return;}const b=e.target.closest('.sound-layer');if(b){const id=b.dataset.sound;try{layers.has(id)?stopLayer(id):startLayer(id);}catch(err){console.warn(err);alert('Ushbu brauzer audio funksiyasini qo‘llab-quvvatlamaydi.');}return;}if(e.target.closest('#stopAllSounds')){stopAll();return;}if(e.target.closest('#soundCollapse')){collapsed=!collapsed;document.getElementById('vertexSoundDock')?.classList.toggle('collapsed',collapsed);e.target.textContent=collapsed?'+':'−';return;}if(e.target.closest('#saveSoundPreset')){if(!layers.size){alert('Avval kamida bitta ovozni yoqing.');return;}const name=prompt('Preset nomi:');if(name&&name.trim()){presets[name.trim().slice(0,24)]=[...layers.keys()];save();render();}return;}});
    document.addEventListener('change',e=>{if(e.target.id==='soundPresetSelect'&&e.target.value)applyPreset(e.target.value);});
    refreshLocalTracks();
    document.addEventListener('input',e=>{const el=e.target.closest('[data-layer-volume]');if(el){setVolume(el.dataset.layerVolume,el.value);const row=el.closest('.sound-active-row');if(row)row.querySelector('b').textContent=`${el.value}%`;}});render();}
  return {init,stopAll:()=>{stopAll();stopLocalMusic();}};
})();

function init() {
  renderHabitPickers();
  state = loadState();
  restoreTimer();
  plannerDate = today();

  // Start independent controls before the main UI render/event binding.
  // This prevents an unrelated render/bind error from disabling audio or timezone.
  try {
    VertexFocusAudio.init();
  } catch (error) {
    console.error('Vertex audio initialization error:', error);
  }
  try {
    renderRegionalTime();
    if (!window.__vertexRegionalClockTimer) {
      window.__vertexRegionalClockTimer = setInterval(() => {
        try { renderRegionalTime(); } catch (error) { console.warn('Regional clock:', error); }
      }, 1000);
    }
    const timeZoneSelect = document.getElementById('vertexTimeZone');
    if (timeZoneSelect && !timeZoneSelect.dataset.vertexBound) {
      timeZoneSelect.dataset.vertexBound = '1';
      timeZoneSelect.addEventListener('change', event => {
        const zone = event.target.value;
        if (!isValidTimeZone(zone)) return;
        state.settings.timeZone = zone;
        saveState();
        renderRegionalTime();
        notify('Hududiy vaqt sozlamasi saqlandi.');
      });
    }
    const deviceZoneButton = document.getElementById('useDeviceTimeZone');
    if (deviceZoneButton && !deviceZoneButton.dataset.vertexBound) {
      deviceZoneButton.dataset.vertexBound = '1';
      deviceZoneButton.addEventListener('click', () => {
        state.settings.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        saveState();
        renderRegionalTime();
        notify('Qurilma vaqt zonasi tanlandi.');
      });
    }
  } catch (error) {
    console.error('Vertex regional time initialization error:', error);
  }

  bindEvents();
  updatePushPermissionStatus();
  document.getElementById('enablePushBtn')?.addEventListener('click', enableVertexPush);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./service-worker.js').catch(error => console.warn('SW registration:', error));
  if(!document.documentElement.dataset.coachReminderBound){document.documentElement.dataset.coachReminderBound='1';document.addEventListener('click',e=>{if(e.target.closest('#saveCoachReminder')){const i=document.getElementById('coachReminderTime');if(i&&i.value){localStorage.setItem('vertex_coach_reminder_time',i.value);updateCoachReminderStatus();}}});}
  // Delegated event handling: works even if analytics cards are re-rendered.
  if (!document.documentElement.dataset.longTermEventsBound) {
    document.documentElement.dataset.longTermEventsBound = '1';
    document.addEventListener('click', event => {
      const card = event.target.closest('.long-term-select[data-period]');
      if (card) {
        event.preventDefault();
        const period = Number(card.dataset.period);
        if ([90, 180, 365].includes(period)) {
          try {
            showLongTermDetail(period);
          } catch (error) {
            console.error('Long-term analytics error:', error);
            const panel = document.getElementById('longTermDetail');
            if (panel) {
              panel.hidden = false;
              const title = document.getElementById('longTermDetailTitle');
              if (title) title.textContent = 'Statistikani yuklashda xatolik';
              const statsBox = document.getElementById('longTermDetailStats');
              if (statsBox) statsBox.textContent = 'Iltimos, sahifani yangilang va qayta urinib ko‘ring.';
            }
          }
        }
        return;
      }
      const monthButton = event.target.closest('.month-detail-trigger[data-month]');
      if (monthButton) { showCalendarMonthDetail(monthButton.dataset.month); return; }
      const calendarDay = event.target.closest('.month-calendar-day[data-date]');
      if (calendarDay && !calendarDay.disabled) { renderCalendarDayDetails(calendarDay.dataset.date); return; }
      if (event.target.closest('#closeLongTermDetail')) {
        const panel = document.getElementById('longTermDetail');
        if (panel) panel.hidden = true;
      }
    });
    document.addEventListener('keydown', event => {
      const card = event.target.closest?.('.long-term-select[data-period]');
      if (card && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        const period = Number(card.dataset.period);
        if ([90, 180, 365].includes(period)) showLongTermDetail(period);
      }
    });
  }
  renderAll();
  // Saqlangan faol sessiyani mavjud tugash vaqtini o‘zgartirmasdan davom ettiramiz.
  if (timerRunning) runTimerInterval();
}

document.addEventListener('DOMContentLoaded', () => {
  try {
    init();
  } catch (error) {
    console.error('Vertex ishga tushishida xatolik:', error);
    const caption = document.querySelector('.vertex-loading-caption');
    if (caption) caption.textContent = 'YUKLASHDA XATOLIK — SAHIFANI YANGILANG';
  } finally {
    // Skeleton ekran hech qachon doimiy qolib ketmasin.
    document.body.classList.remove('vertex-loading');
    document.getElementById('vertexLoadingScreen')?.remove();
  }
});

})();
