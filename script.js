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
  return `--habit-accent:${normalizeHabitColor(habit?.color)}`;
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
    longMinutes: 15
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
    )
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
  const index = state.logs.findIndex(
    log => log.habitId === habitId && log.date === date
  );
  if (index >= 0) state.logs.splice(index, 1);
  else state.logs.push({ habitId, date });
  saveState();
  renderAll();
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
  if (!habits.length || !Number.isFinite(days) || days <= 0) return 0;
  const end = today();
  const start = shiftDate(end, -(days - 1));
  let done = 0;
  let possible = 0;

  // Odat yaratilishidan oldingi kunlarni bajarilmagan deb hisoblamaymiz.
  for (const habit of habits) {
    const created = validDate(habit.createdAt) ? habit.createdAt : start;
    const firstEligible = created > start ? created : start;
    for (let date = firstEligible; date <= end; date = shiftDate(date, 1)) {
      possible++;
      if (isChecked(habit.id, date)) done++;
    }
  }
  return possible ? Math.round(done / possible * 100) : 0;
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
  const quotes = [
    'Muvaffaqiyat — har kuni takrorlangan kichik harakatlar yig‘indisi.',
    'Mukammallikni emas, muntazamlikni tanlang.',
    'Bugungi harakatingiz ertangi imkoniyatingizni yaratadi.',
    'Kichik qadam ham oldinga qadamdir.',
    'Intizom — maqsadlaringizga olib boradigan kundalik ko‘prik.',
    'Boshlash uchun eng yaxshi vaqt — hozir.',
    'Natija birdan kelmaydi, lekin har bir urinish hisobga kiradi.'
  ];
  const dayIndex = Math.floor(parseDate(today()).getTime() / 86400000) % quotes.length;
  $('#dailyQuote').textContent = quotes[(dayIndex + quotes.length) % quotes.length];

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

function renderDashboard() {
  renderStats();
  renderSmartDashboard();
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
    const monthDate = parseDate(end);
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
    monthRows.push(`<div class="long-term-month-row"><span>${dateLabel(monthStart,{month:'short',year:'numeric'})}</span><div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div><strong>${pct}%</strong><small>${completed}/${eligible}</small></div>`);
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
  panel.classList.remove('hidden');
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
      const color = normalizeHabitColor(habit.color);
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

/* ==============================
   SOZLAMALAR
============================== */

function renderSettings() {
  $('#userNameInput').value = state.userName;
  $('#focusMinutes').value = state.settings.focusMinutes;
  $('#shortMinutes').value = state.settings.shortMinutes;
  $('#longMinutes').value = state.settings.longMinutes;

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
  const iconPicker = $('.habit-icon-picker');
  if (iconPicker) {
    iconPicker.addEventListener('click', event => {
      const button = event.target.closest('[data-habit-icon]');
      if (!button) return;
      selectedHabitIcon = button.dataset.habitIcon;
      updateHabitPickerSelection();
    });
  }
  const colorPicker = $('.habit-color-picker');
  if (colorPicker) {
    colorPicker.addEventListener('click', event => {
      const button = event.target.closest('[data-habit-color]');
      if (!button) return;
      selectedHabitColor = normalizeHabitColor(button.dataset.habitColor);
      updateHabitPickerSelection();
    });
  }
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
        saveState();
        renderAll();
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
    state.tasks.push({ id: uid(), title, date, priority: $('#taskPriorityInput').value || 'medium', done: false });
    plannerDate = date;
    saveState();
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

function init() {
  renderHabitPickers();
  state = loadState();
  restoreTimer();
  plannerDate = today();
  bindEvents();
  // Delegated event handling: works even if analytics cards are re-rendered.
  if (!document.documentElement.dataset.longTermEventsBound) {
    document.documentElement.dataset.longTermEventsBound = '1';
    document.addEventListener('click', event => {
      const card = event.target instanceof Element ? event.target.closest('.long-term-select[data-period]') : null;
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
      if (event.target instanceof Element && event.target.closest('#closeLongTermDetail')) {
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

document.addEventListener('DOMContentLoaded', init);

})();
