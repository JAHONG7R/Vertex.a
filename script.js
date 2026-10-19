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
    `v${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 8)}`
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

const CATEGORY_ICONS = {
  focus: '◈',
  health: '✳',
  learning: '▤',
  mindset: '◎',
  recovery: '☾',
  discipline: '↗'
};

const DAY_NAMES = [
  'Du', 'Se', 'Cho', 'Pay', 'Ju', 'Shan', 'Yak'
];

const DAY_LONG = [
  'Dushanba',
  'Seshanba',
  'Chorshanba',
  'Payshanba',
  'Juma',
  'Shanba',
  'Yakshanba'
];

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
let toastTimeout = null;

/*
 * SUPABASE INTEGRATSIYASI UCHUN:
 * Mehmon ma'lumotlari va akkaunt ma'lumotlari
 * alohida localStorage kalitlarida saqlanadi.
 */
let activeStorageKey = STORAGE_KEY;

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function validDate(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) {
    return false;
  }

  const d = parseDate(s);

  return (
    !Number.isNaN(d.getTime()) &&
    localDateString(d) === String(s)
  );
}

function normalizeCategory(category) {
  return Object.hasOwn(CATEGORIES, category)
    ? category
    : 'focus';
}

function normalizeHabit(habit) {
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
    targetDays: [3, 5, 6, 7].includes(target)
      ? target
      : 5,
    isArchived: Boolean(
      habit.isArchived ??
      habit.is_archived ??
      habit.archived
    ),
    createdAt: validDate(habit.createdAt)
      ? habit.createdAt
      : today()
  };
}

function normalizeState(raw) {
  const next = DEFAULT_STATE();

  if (!raw || typeof raw !== 'object') {
    return next;
  }

  next.userName = String(
    raw.userName ??
    raw.profileName ??
    raw.name ??
    'Foydalanuvchi'
  ).slice(0, 40) || 'Foydalanuvchi';

  next.habits = safeArray(raw.habits)
    .map(normalizeHabit)
    .filter(Boolean);

  const seen = new Set();

  const pushLog = (habitId, date) => {
    const id = String(habitId);
    const key = `${id}|${date}`;

    if (
      validDate(date) &&
      next.habits.some(h => h.id === id) &&
      !seen.has(key)
    ) {
      next.logs.push({
        habitId: id,
        date
      });

      seen.add(key);
    }
  };

  if (Array.isArray(raw.logs)) {
    raw.logs.forEach(log => {
      const habitId =
        log.habitId ??
        log.habit_id;

      const date =
        log.date ??
        log.completed_date ??
        log.day;

      if (habitId != null) {
        pushLog(habitId, String(date ?? ''));
      }
    });
  } else if (
    raw.checks &&
    typeof raw.checks === 'object'
  ) {
    Object.entries(raw.checks).forEach(([key, value]) => {
      if (
        value !== true &&
        value !== 1 &&
        value !== 'true'
      ) {
        return;
      }

      const dateMatch = key.match(/\d{4}-\d{2}-\d{2}/);

      if (!dateMatch) return;

      const date = dateMatch[0];

      const habitId = key
        .replace(date, '')
        .replace(/[_|:/-]+$/, '')
        .replace(/^[_|:/-]+/, '');

      let habit = next.habits.find(
        h => h.id === habitId
      );

      if (!habit) {
        const reverse = key
          .slice(date.length)
          .replace(/^[_|:/-]+/, '')
          .replace(/[_|:/-]+$/, '');

        habit = next.habits.find(
          h => h.id === reverse
        );
      }

      if (habit) {
        pushLog(habit.id, date);
      }
    });
  }

  next.tasks = safeArray(raw.tasks)
    .map(task => ({
      id: String(task.id ?? uid()),

      title: String(
        task.title ??
        task.name ??
        task.text ??
        ''
      ).trim().slice(0, 120),

      date: validDate(
        task.date ??
        task.dueDate ??
        task.due_date
      )
        ? String(
            task.date ??
            task.dueDate ??
            task.due_date
          )
        : today(),

      done: Boolean(
        task.done ??
        task.completed ??
        task.is_done
      )
    }))
    .filter(task => task.title);

  const settings =
    raw.settings &&
    typeof raw.settings === 'object'
      ? raw.settings
      : {};

  next.settings = {
    focusMinutes: clampInt(
      settings.focusMinutes ??
      settings.focus ??
      raw.focusMinutes,
      1,
      120,
      25
    ),

    shortMinutes: clampInt(
      settings.shortMinutes ??
      settings.shortBreakMinutes ??
      5,
      1,
      30,
      5
    ),

    longMinutes: clampInt(
      settings.longMinutes ??
      settings.longBreakMinutes ??
      15,
      1,
      60,
      15
    )
  };

  const rawMode = raw.pomodoro?.mode;

  next.pomodoro = {
    mode: ['focus', 'short', 'long'].includes(rawMode)
      ? rawMode
      : 'focus',

    sessions: Math.max(
      0,
      Number(raw.pomodoro?.sessions) || 0
    )
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
   LOCAL STORAGE VA BULUTGA XABAR
============================== */

function migrateOldData() {
  for (const key of OLD_KEYS) {
    try {
      const raw = localStorage.getItem(key);

      if (!raw) continue;

      const converted = normalizeState(JSON.parse(raw));

      if (
        converted.habits.length ||
        converted.logs.length ||
        converted.tasks.length
      ) {
        state = converted;
        saveState();
        return true;
      }
    } catch (error) {
      console.warn(
        'Eski ma’lumotlarni ko‘chirish imkoni bo‘lmadi:',
        error
      );
    }
  }

  return false;
}

function loadState() {
  /*
   * Ilova birinchi ishga tushganda faqat mehmon
   * ma'lumotlarini o'qiydi. Akkaunt ma'lumotlarini
   * supabase-auth.js alohida yuklaydi.
   */
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (raw) {
      return normalizeState(JSON.parse(raw));
    }
  } catch (error) {
    console.warn(
      'Saqlangan ma’lumotlarni o‘qib bo‘lmadi:',
      error
    );
  }

  state = DEFAULT_STATE();
  migrateOldData();

  return state;
}

function saveState() {
  try {
    localStorage.setItem(
      activeStorageKey,
      JSON.stringify(state)
    );

    /*
     * Bulutli modul ushbu hodisani tinglaydi.
     * Faqat akkaunt kaliti mos bo'lsa, bulutga yozadi.
     */
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

    notify(
      'Ma’lumotni saqlab bo‘lmadi. Brauzer xotirasini tekshiring.'
    );
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

  toastTimeout = setTimeout(() => {
    element.classList.remove('show');
  }, 2800);
}

/*
 * Supabase autentifikatsiya moduli uchun
 * xavfsiz ko'chirma va holatni almashtirish interfeysi.
 */
window.VertexApp = {
  getState() {
    return JSON.parse(JSON.stringify(state));
  },

  getGuestState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      return raw
        ? normalizeState(JSON.parse(raw))
        : DEFAULT_STATE();
    } catch (error) {
      console.error(
        'Mehmon ma’lumotlarini o‘qishda xatolik:',
        error
      );

      return DEFAULT_STATE();
    }
  },

  getStorageKey() {
    return activeStorageKey;
  },

  setState(raw, storageKey = STORAGE_KEY) {
    activeStorageKey = storageKey;
    state = normalizeState(raw);

    pauseTimer();

    timerSeconds = modeDuration(state.pomodoro.mode);
    plannerDate = today();

    try {
      localStorage.setItem(
        activeStorageKey,
        JSON.stringify(state)
      );
    } catch (error) {
      console.error(
        'Holatni saqlashda xatolik:',
        error
      );
    }

    if ($('#todayPercent')) {
      renderAll();
    }
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

function dateLabel(
  date,
  options = { day: 'numeric', month: 'short' }
) {
  return parseDate(date).toLocaleDateString(
    'uz-UZ',
    options
  );
}

function isChecked(habitId, date) {
  return state.logs.some(
    log =>
      log.habitId === habitId &&
      log.date === date
  );
}

function toggleCheck(habitId, date) {
  if (date > today()) {
    notify('Kelajakdagi kunni belgilab bo‘lmaydi.');
    return;
  }

  const index = state.logs.findIndex(
    log =>
      log.habitId === habitId &&
      log.date === date
  );

  if (index >= 0) {
    state.logs.splice(index, 1);
  } else {
    state.logs.push({ habitId, date });
  }

  saveState();
  renderAll();
}

function getHabitLogs(habitId, from, to) {
  return state.logs.filter(
    log =>
      log.habitId === habitId &&
      log.date >= from &&
      log.date <= to
  );
}

function streakForHabit(habitId) {
  let date = today();
  let count = 0;

  if (!isChecked(habitId, date)) {
    date = shiftDate(date, -1);
  }

  for (let i = 0; i < 500; i++) {
    if (isChecked(habitId, date)) {
      count++;
      date = shiftDate(date, -1);
    } else {
      break;
    }
  }

  return count;
}

function currentStreak() {
  let date = today();
  let count = 0;

  const active = state.habits.filter(
    habit => !habit.isArchived
  );

  const hasAny = day =>
    active.some(habit => isChecked(habit.id, day));

  if (!hasAny(date)) {
    date = shiftDate(date, -1);
  }

  for (let i = 0; i < 500; i++) {
    if (hasAny(date)) {
      count++;
      date = shiftDate(date, -1);
    } else {
      break;
    }
  }

  return count;
}

function xpTotal() {
  return state.logs.length * 10;
}

function activeHabits() {
  return state.habits.filter(
    habit => !habit.isArchived
  );
}

function doneCountOn(date) {
  return activeHabits().filter(
    habit => isChecked(habit.id, date)
  ).length;
}

function todayRate() {
  const habits = activeHabits();

  return habits.length
    ? Math.round(
        doneCountOn(today()) / habits.length * 100
      )
    : 0;
}

function rateForDays(days) {
  const habits = activeHabits();

  if (!habits.length) return 0;

  const end = today();
  const start = shiftDate(end, -(days - 1));

  let done = 0;

  for (
    let date = start;
    date <= end;
    date = shiftDate(date, 1)
  ) {
    done += habits.filter(
      habit => isChecked(habit.id, date)
    ).length;
  }

  return Math.round(
    done / (habits.length * days) * 100
  );
}

function weekDates(anchor = today()) {
  const start = weekStart(anchor);

  return Array.from(
    { length: 7 },
    (_, index) => shiftDate(start, index)
  );
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
    element.classList.toggle(
      'active',
      element.id === `page-${page}`
    );
  });

  $$('.nav-item[data-page]').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.page === page
    );
  });

  const names = {
    dashboard: 'UMUMIY KO‘RINISH',
    habits: 'ODATLAR',
    planner: 'REJALASHTIRUVCHI',
    pomodoro: 'FOKUS TAYMERI',
    analytics: 'TAHLIL',
    settings: 'SOZLAMALAR'
  };

  $('#pageCrumb').textContent =
    names[page] || page.toUpperCase();

  $('#sidebar').classList.remove('open');

  if (page === 'planner') renderPlanner();
  if (page === 'pomodoro') renderTimer();
  if (page === 'analytics') renderAnalytics();
}

function openModal(id) {
  const element = $('#' + id);

  if (!element) return;

  element.classList.remove('hidden');

  const input = $(
    'input:not([type=hidden]), select',
    element
  );

  if (input) {
    setTimeout(() => input.focus(), 30);
  }
}

function closeModals() {
  $$('.modal-backdrop').forEach(element => {
    element.classList.add('hidden');
  });
}

function openHabitModal(habit = null) {
  $('#habitForm').reset();

  $('#habitId').value = habit?.id || '';
  $('#habitTitle').value = habit?.title || '';
  $('#habitCategory').value =
    habit?.category || 'focus';

  $('#habitTarget').value = String(
    habit?.targetDays || 5
  );

  $('#habitModalTitle').textContent = habit
    ? 'Odatni tahrirlash'
    : 'Yangi odat';

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
  const habit = {
    id: uid(),
    title: data.title.trim(),
    category: data.category,
    targetDays: Number(data.targetDays),
    isArchived: false,
    createdAt: today()
  };

  state.habits.unshift(habit);

  saveState();
  renderAll();

  notify('Yangi odat qo‘shildi.');
}

function updateHabit(id, data) {
  const habit = state.habits.find(
    item => item.id === id
  );

  if (!habit) return;

  habit.title = data.title.trim();
  habit.category = data.category;
  habit.targetDays = Number(data.targetDays);

  saveState();
  renderAll();

  notify('Odat yangilandi.');
}

function deleteHabit(id) {
  const habit = state.habits.find(
    item => item.id === id
  );

  if (!habit) return;

  if (
    !confirm(
      `“${habit.title}” odatini va uning belgilashlar tarixini o‘chirmoqchimisiz?`
    )
  ) {
    return;
  }

  state.habits = state.habits.filter(
    item => item.id !== id
  );

  state.logs = state.logs.filter(
    log => log.habitId !== id
  );

  saveState();
  renderAll();

  notify('Odat o‘chirildi.');
}

function archiveHabit(id) {
  const habit = state.habits.find(
    item => item.id === id
  );

  if (!habit) return;

  habit.isArchived = !habit.isArchived;

  saveState();
  renderAll();

  notify(
    habit.isArchived
      ? 'Odat arxivlandi.'
      : 'Odat arxivdan qaytarildi.'
  );
}

/* ==============================
   HEADER VA STATISTIKA
============================== */

function renderHeader() {
  const date = parseDate(today());

  $('#todayLabel').textContent =
    date.toLocaleDateString('uz-UZ', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).toUpperCase();

  $('#footerDate').textContent =
    date.toLocaleDateString('uz-UZ', {
      weekday: 'long',
      day: 'numeric',
      month: 'long'
    });

  const name = state.userName || 'Foydalanuvchi';

  $('#sidebarName').textContent = name;

  $('#sidebarAvatar').textContent =
    (name.trim()[0] || 'U').toUpperCase();

  $('#userNameInput').value = name;

  const hour = new Date().getHours();

  $('#greetingTitle').textContent =
    hour < 12
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

  $('#todayDoneText').textContent =
    `${done} / ${active.length} bajarildi`;

  $('#todayProgress').style.width = percent + '%';

  $('#currentStreak').innerHTML =
    `${currentStreak()} <small>kun</small>`;

  $('#xpValue').innerHTML =
    `${xp} <small>XP</small>`;

  $('#levelLabel').textContent =
    `${level}-daraja · keyingi darajagacha ${100 - (xp % 100)} XP`;

  $('#levelProgress').style.width = (xp % 100) + '%';

  const adherence = rateForDays(30);

  $('#adherenceValue').textContent =
    adherence + '%';

  $('#adherenceProgress').style.width =
    adherence + '%';
}

function renderWeekStrip() {
  const dates = weekDates();

  $('#weekStrip').innerHTML = dates.map(
    (date, index) => `
      <div class="week-day ${
        date === today() ? 'today' : ''
      } ${
        doneCountOn(date) > 0 ? 'done' : ''
      }">
        <span class="day-name">${DAY_NAMES[index]}</span>
        <span class="day-num">${parseDate(date).getDate()}</span>
        <span class="day-dot"></span>
      </div>
    `
  ).join('');
}

function renderDashboardHabits() {
  const habits = activeHabits().slice(0, 5);
  const box = $('#dashboardHabits');

  box.innerHTML = habits.map(habit => `
    <div class="habit-preview">
      <span class="habit-glyph">
        ${CATEGORY_ICONS[habit.category] || '◉'}
      </span>

      <div class="habit-preview-info">
        <strong>${escapeHTML(habit.title)}</strong>
        <small>
          ${escapeHTML(categoryLabel(habit.category))}
          · ${streakForHabit(habit.id)} kunlik seriya
        </small>
      </div>

      <button
        class="check-button ${
          isChecked(habit.id, today()) ? 'checked' : ''
        }"
        data-toggle-check="${escapeHTML(habit.id)}"
        data-date="${today()}"
        aria-label="Odat holatini o‘zgartirish"
      >${isChecked(habit.id, today()) ? '✓' : '○'}</button>
    </div>
  `).join('');

  $('#dashboardEmpty').classList.toggle(
    'hidden',
    habits.length > 0
  );

  box.classList.toggle(
    'hidden',
    habits.length === 0
  );
}

function renderDashboardTasks() {
  const tasks = state.tasks
    .filter(task => task.date === today())
    .sort((a, b) => Number(a.done) - Number(b.done))
    .slice(0, 4);

  $('#dashboardTasks').innerHTML = tasks.map(task => `
    <div class="task-row">
      <button
        class="task-check ${task.done ? 'done' : ''}"
        data-toggle-task="${escapeHTML(task.id)}"
        aria-label="Vazifa holatini o‘zgartirish"
      >${task.done ? '✓' : ''}</button>

      <span class="task-title ${
        task.done ? 'done' : ''
      }">${escapeHTML(task.title)}</span>

      <span class="task-date">
        ${task.done ? 'BAJARILDI' : 'BUGUN'}
      </span>
    </div>
  `).join('');

  $('#dashboardTasksEmpty').classList.toggle(
    'hidden',
    tasks.length > 0
  );
}

function renderDashboard() {
  renderStats();
  renderWeekStrip();
  renderDashboardHabits();
  renderDashboardTasks();

  $('#dashTimer').textContent = formatTime(timerSeconds);

  $('#dashTimerMode').textContent =
    state.pomodoro.mode === 'focus'
      ? 'FOCUS'
      : state.pomodoro.mode === 'short'
        ? 'SHORT BREAK'
        : 'LONG BREAK';
}

/* ==============================
   ODATLAR JADVALI
============================== */

function visibleHabits() {
  return state.habits
    .filter(habit =>
      showArchived
        ? habit.isArchived
        : !habit.isArchived
    )
    .filter(habit =>
      activeFilter === 'all' ||
      habit.category === activeFilter
    );
}

function renderHabits() {
  const habits = visibleHabits();

  $('#habitCount').textContent =
    `${habits.length} ta odat`;

  const tbody = $('#habitTableBody');

  tbody.innerHTML = habits.map(habit => {
    const start = weekStart(today());

    const days = Array.from(
      { length: 7 },
      (_, index) => shiftDate(start, index)
    );

    const dayCells = days.map(date => `
      <td>
        <button
          class="habit-cell-check ${
            isChecked(habit.id, date) ? 'checked' : ''
          }"
          data-toggle-check="${escapeHTML(habit.id)}"
          data-date="${date}"
          ${
            date > today() || habit.isArchived
              ? 'disabled'
              : ''
          }
          aria-label="${escapeHTML(habit.title)}"
        >${isChecked(habit.id, date) ? '✓' : ''}</button>
      </td>
    `).join('');

    return `
      <tr>
        <td class="habit-name-cell">
          <div class="habit-name-wrap">
            <span class="habit-glyph">
              ${CATEGORY_ICONS[habit.category] || '◉'}
            </span>

            <div class="habit-name-text">
              <strong>${escapeHTML(habit.title)}</strong>
              <small>
                ${escapeHTML(categoryLabel(habit.category))}
                · haftasiga ${habit.targetDays} kun
                ${habit.isArchived ? ' · arxiv' : ''}
              </small>
            </div>
          </div>
        </td>

        ${dayCells}

        <td class="streak-cell">
          ↗ ${streakForHabit(habit.id)}d
        </td>

        <td>
          <div class="row-actions">
            <button
              class="mini-action"
              data-edit-habit="${escapeHTML(habit.id)}"
              title="Tahrirlash"
            >✎</button>

            <button
              class="mini-action"
              data-archive-habit="${escapeHTML(habit.id)}"
              title="Arxivlash"
            >${habit.isArchived ? '↶' : '▣'}</button>

            <button
              class="mini-action danger"
              data-delete-habit="${escapeHTML(habit.id)}"
              title="O‘chirish"
            >×</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  $('#habitsEmpty').classList.toggle(
    'hidden',
    habits.length > 0
  );

  tbody.parentElement.classList.toggle(
    'hidden',
    habits.length === 0
  );

  $$('#categoryFilters .filter-chip').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.filter === activeFilter
    );
  });
}

/* ==============================
   REJALASHTIRUVCHI
============================== */

function renderPlanner() {
  $('#plannerDate').value = plannerDate;

  $('#plannerDateTitle').textContent =
    plannerDate === today()
      ? 'Bugungi vazifalar'
      : dateLabel(plannerDate, {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }) + ' vazifalari';

  const tasks = state.tasks
    .filter(task => task.date === plannerDate)
    .sort((a, b) => Number(a.done) - Number(b.done));

  const done = tasks.filter(task => task.done).length;

  const percent = tasks.length
    ? Math.round(done / tasks.length * 100)
    : 0;

  $('#taskTotal').textContent = tasks.length;
  $('#taskDone').textContent = done;
  $('#taskPercent').textContent = percent + '%';

  $('#plannerStatus').textContent =
    !tasks.length
      ? 'Boshlashga tayyor'
      : percent === 100
        ? 'Ajoyib! Hammasi bajarildi'
        : `${tasks.length - done} ta vazifa qoldi`;

  $('#plannerTaskList').innerHTML = tasks.map(task => `
    <div class="planner-task">
      <button
        class="task-check ${task.done ? 'done' : ''}"
        data-toggle-task="${escapeHTML(task.id)}"
      >${task.done ? '✓' : ''}</button>

      <span class="task-title ${
        task.done ? 'done' : ''
      }">${escapeHTML(task.title)}</span>

      <div class="task-actions">
        <button
          class="mini-action danger"
          data-delete-task="${escapeHTML(task.id)}"
          aria-label="Vazifani o‘chirish"
        >×</button>
      </div>
    </div>
  `).join('');

  $('#plannerEmpty').classList.toggle(
    'hidden',
    tasks.length > 0
  );

  $('#plannerTaskList').classList.toggle(
    'hidden',
    tasks.length === 0
  );
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
  const minutes =
    mode === 'short'
      ? state.settings.shortMinutes
      : mode === 'long'
        ? state.settings.longMinutes
        : state.settings.focusMinutes;

  return minutes * 60;
}

function setTimerMode(mode) {
  pauseTimer();

  state.pomodoro.mode = mode;
  timerSeconds = modeDuration(mode);

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

  $('#timerStatus').textContent = timerRunning
    ? 'SESSIYA DAVOM ETMOQDA'
    : labels[mode][1];

  $('#mainTimer').textContent = formatTime(timerSeconds);

  $('#timerStart').innerHTML = timerRunning
    ? 'Ⅱ Pauza'
    : '▶ Davom etish';

  $('#sessionCount').textContent =
    state.pomodoro.sessions;

  $$('#timerModes .timer-tab').forEach(button => {
    button.classList.toggle(
      'active',
      button.dataset.mode === mode
    );
  });

  $('#timerRing').classList.toggle(
    'running',
    timerRunning
  );

  const fraction =
    1 - timerSeconds / modeDuration(mode);

  const degrees = Math.max(
    0,
    Math.min(360, fraction * 360)
  );

  $('#timerRing').style.background =
    `conic-gradient(var(--lime) ${degrees}deg,#323b28 ${degrees}deg 360deg)`;
}

function pauseTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  timerRunning = false;
}

function startTimer() {
  if (timerRunning) {
    pauseTimer();
    renderTimer();
    return;
  }

  if (timerSeconds <= 0) {
    timerSeconds = modeDuration(state.pomodoro.mode);
  }

  timerRunning = true;
  renderTimer();

  timerInterval = setInterval(() => {
    timerSeconds--;

    if (timerSeconds <= 0) {
      timerSeconds = 0;
      pauseTimer();

      if (state.pomodoro.mode === 'focus') {
        state.pomodoro.sessions++;

        saveState();

        notify(
          'Fokus sessiyasi tugadi. Tanaffus qilish vaqti!'
        );
      } else {
        notify(
          'Tanaffus tugadi. Tayyor bo‘lsangiz, davom eting.'
        );
      }

      renderTimer();
      renderDashboard();

      return;
    }

    $('#mainTimer').textContent = formatTime(timerSeconds);
    $('#dashTimer').textContent = formatTime(timerSeconds);

    const fraction =
      1 - timerSeconds / modeDuration(state.pomodoro.mode);

    const degrees = fraction * 360;

    $('#timerRing').style.background =
      `conic-gradient(var(--lime) ${degrees}deg,#323b28 ${degrees}deg 360deg)`;
  }, 1000);
}

function resetTimer() {
  pauseTimer();

  timerSeconds = modeDuration(state.pomodoro.mode);

  renderTimer();
  renderDashboard();
}

/* ==============================
   TAHLIL
============================== */

function renderAnalytics() {
  const week = rateForDays(7);
  const month = rateForDays(30);

  $('#analyticsWeekRate').textContent = week + '%';
  $('#analyticsMonthRate').textContent = month + '%';
  $('#totalCompletions').textContent = state.logs.length;

  const active = activeHabits();
  let best = null;

  if (active.length) {
    best = active.map(habit => {
      let count = 0;

      for (let i = 0; i < 30; i++) {
        if (isChecked(habit.id, shiftDate(today(), -i))) {
          count++;
        }
      }

      return {
        h: habit,
        rate: Math.round(count / 30 * 100),
        n: count
      };
    }).sort(
      (a, b) => b.rate - a.rate || b.n - a.n
    )[0];
  }

  $('#bestHabit').textContent =
    best && best.n ? best.h.title : '—';

  $('#bestHabitRate').textContent =
    best && best.n
      ? `${best.rate}% · oxirgi 30 kun`
      : 'Hali yetarli ma’lumot yo‘q';

  const dates = Array.from(
    { length: 7 },
    (_, i) => shiftDate(today(), i - 6)
  );

  $('#weeklyChart').innerHTML = dates.map(date => {
    const total = active.length;
    const done = doneCountOn(date);

    const percent = total
      ? Math.round(done / total * 100)
      : 0;

    return `
      <div class="bar-col ${
        date === today() ? 'today' : ''
      }">
        <span class="bar-value">${percent}%</span>

        <div class="bar-track">
          <div
            class="bar-fill"
            style="height:${percent}%"
          ></div>
        </div>

        <span class="bar-label">${
          DAY_NAMES[(parseDate(date).getDay() + 6) % 7]
        }</span>
      </div>
    `;
  }).join('');

  if (!active.length) {
    $('#insightTitle').textContent =
      'Birinchi odatingizni yarating.';

    $('#insightText').textContent =
      'Odatlar qo‘shilgach, bu sahifa bajarish ko‘rsatkichlari va foydali kuzatuvlarni ko‘rsatadi.';

    $('#nextStepText').textContent =
      'Bitta sodda, o‘lchash mumkin bo‘lgan odat qo‘shing.';
  } else if (week >= 70) {
    $('#insightTitle').textContent =
      'Siz yaxshi izchillik ko‘rsatyapsiz!';

    $('#insightText').textContent =
      `So‘nggi haftada odatlaringizning ${week}% ini bajardingiz. Shu ritmni saqlash uchun maqsadlarni real va barqaror tuting.`;

    $('#nextStepText').textContent =
      'Hozirgi odatlarni davom ettiring; birdaniga ko‘p yangi maqsad qo‘shmang.';
  } else if (week > 0) {
    $('#insightTitle').textContent =
      'Kichik qadamlar bilan davom eting.';

    $('#insightText').textContent =
      `Haftalik bajarish ko‘rsatkichi ${week}%. Qaysi kun yoki odat ko‘proq e’tibor talab qilayotganini kuzating.`;

    $('#nextStepText').textContent =
      'Eng oson odatingizdan boshlang va uni har kuni belgilashga harakat qiling.';
  } else {
    $('#insightTitle').textContent =
      'Bugun yangi boshlanish bo‘lishi mumkin.';

    $('#insightText').textContent =
      'Hali bu haftada bajarilgan odat belgilanmagan. Bitta kichik harakat bilan boshlang.';

    $('#nextStepText').textContent =
      'Birinchi odatingizni bugun bajaring va jadvalda belgilang.';
  }

  $('#categoryBreakdown').innerHTML =
    Object.entries(CATEGORIES)
      .filter(([key]) =>
        key !== 'discipline' ||
        state.habits.some(habit => habit.category === key)
      )
      .map(([key, label]) => {
        const habits = active.filter(
          habit => habit.category === key
        );

        let count = 0;

        for (const habit of habits) {
          for (let i = 0; i < 30; i++) {
            if (isChecked(habit.id, shiftDate(today(), -i))) {
              count++;
            }
          }
        }

        const possible = habits.length * 30;

        const percent = possible
          ? Math.round(count / possible * 100)
          : 0;

        return `
          <div class="category-item">
            <span class="category-name">
              ${escapeHTML(label)}
            </span>

            <strong>${percent}%</strong>

            <small>
              ${habits.length} ta odat · 30 kun
            </small>

            <div class="progress-track">
              <div
                class="progress-fill"
                style="width:${percent}%"
              ></div>
            </div>
          </div>
        `;
      })
      .join('');
}

/* ==============================
   SOZLAMALAR
============================== */

function renderSettings() {
  $('#userNameInput').value = state.userName;

  $('#focusMinutes').value =
    state.settings.focusMinutes;

  $('#shortMinutes').value =
    state.settings.shortMinutes;

  $('#longMinutes').value =
    state.settings.longMinutes;
}

function renderAll() {
  renderHeader();
  renderStats();
  renderWeekStrip();
  renderDashboardHabits();
  renderDashboardTasks();
  renderHabits();
  renderPlanner();
  renderTimer();
  renderAnalytics();
  renderSettings();
}

/* ==============================
   IMPORT / EXPORT / RESET
============================== */

function exportData() {
  const blob = new Blob(
    [
      JSON.stringify({
        ...state,
        exportedAt: new Date().toISOString(),
        app: 'VERTEX Growth System'
      }, null, 2)
    ],
    { type: 'application/json' }
  );

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');

  a.href = url;
  a.download = `vertex-backup-${today()}.json`;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);

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

      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !Array.isArray(parsed.habits)
      ) {
        throw new Error('invalid');
      }

      if (
        !confirm(
          'Import qilingan ma’lumotlar hozirgi ma’lumotlaringizni almashtiradi. Davom etasizmi?'
        )
      ) {
        return;
      }

      state = normalizeState(parsed);

      saveState();
      renderAll();

      notify('Ma’lumotlar muvaffaqiyatli tiklandi.');
    } catch (error) {
      notify(
        'Fayl noto‘g‘ri yoki Vertex zaxira nusxasi emas.'
      );
    }
  };

  reader.readAsText(file);
}

function resetAll() {
  if (
    !confirm(
      'Barcha odatlar, tarix va vazifalarni o‘chirishni xohlaysizmi? Bu amalni ortga qaytarib bo‘lmaydi.'
    )
  ) {
    return;
  }

  pauseTimer();

  state = DEFAULT_STATE();
  timerSeconds = state.settings.focusMinutes * 60;

  saveState();
  renderAll();
  goTo('dashboard');

  notify('Ish maydoni tozalandi.');
}

/* ==============================
   HODISALAR
============================== */

function bindEvents() {
  $$('.nav-item[data-page]').forEach(button => {
    button.addEventListener(
      'click',
      () => goTo(button.dataset.page)
    );
  });

  $$('[data-goto]').forEach(button => {
    button.addEventListener(
      'click',
      () => goTo(button.dataset.goto)
    );
  });

  $$('[data-action="add-habit"]').forEach(button => {
    button.addEventListener(
      'click',
      () => openHabitModal()
    );
  });

  $$('[data-action="add-task"]').forEach(button => {
    button.addEventListener(
      'click',
      openTaskModal
    );
  });

  $('#quickSettings').addEventListener(
    'click',
    () => goTo('settings')
  );

  $('#topSettings').addEventListener(
    'click',
    () => goTo('settings')
  );

  $('#mobileMenu').addEventListener(
    'click',
    () => $('#sidebar').classList.toggle('open')
  );

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
      toggleCheck(
        toggle.dataset.toggleCheck,
        toggle.dataset.date
      );

      return;
    }

    const task = event.target.closest('[data-toggle-task]');

    if (task) {
      const item = state.tasks.find(
        t => t.id === task.dataset.toggleTask
      );

      if (item) {
        item.done = !item.done;
        saveState();
        renderAll();
      }

      return;
    }

    const edit = event.target.closest('[data-edit-habit]');

    if (edit) {
      openHabitModal(
        state.habits.find(
          h => h.id === edit.dataset.editHabit
        )
      );

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
      const item = state.tasks.find(
        t => t.id === delTask.dataset.deleteTask
      );

      if (
        item &&
        confirm(`“${item.title}” vazifasini o‘chirasizmi?`)
      ) {
        state.tasks = state.tasks.filter(
          t => t.id !== item.id
        );

        saveState();
        renderAll();

        notify('Vazifa o‘chirildi.');
      }

      return;
    }

    if (event.target.closest('[data-close-modal]')) {
      closeModals();
    }

    if (event.target.classList.contains('modal-backdrop')) {
      closeModals();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModals();
  });

  $('#habitForm').addEventListener('submit', event => {
    event.preventDefault();

    const data = {
      title: $('#habitTitle').value.trim(),
      category: $('#habitCategory').value,
      targetDays: $('#habitTarget').value
    };

    if (!data.title) return;

    const id = $('#habitId').value;

    if (id) {
      updateHabit(id, data);
    } else {
      addHabit(data);
    }

    closeModals();
  });

  $('#taskForm').addEventListener('submit', event => {
    event.preventDefault();

    const title = $('#taskTitleInput').value.trim();
    const date = $('#taskDateInput').value;

    if (!title || !validDate(date)) return;

    state.tasks.push({
      id: uid(),
      title,
      date,
      done: false
    });

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

    if (button) {
      setTimerMode(button.dataset.mode);
    }
  });

  $('#timerStart').addEventListener(
    'click',
    startTimer
  );

  $('#timerReset').addEventListener(
    'click',
    resetTimer
  );

  $('#profileForm').addEventListener('submit', event => {
    event.preventDefault();

    state.userName =
      $('#userNameInput').value.trim().slice(0, 40) ||
      'Foydalanuvchi';

    saveState();
    renderHeader();

    notify('Profil saqlandi.');
  });

  $('#timerSettingsForm').addEventListener('submit', event => {
    event.preventDefault();

    state.settings.focusMinutes = clampInt(
      $('#focusMinutes').value,
      1,
      120,
      25
    );

    state.settings.shortMinutes = clampInt(
      $('#shortMinutes').value,
      1,
      30,
      5
    );

    state.settings.longMinutes = clampInt(
      $('#longMinutes').value,
      1,
      60,
      15
    );

    pauseTimer();

    timerSeconds = modeDuration(state.pomodoro.mode);

    saveState();
    renderTimer();
    renderDashboard();

    notify('Taymer sozlamalari saqlandi.');
  });

  $('#exportBtn').addEventListener(
    'click',
    exportData
  );

  $('#importFile').addEventListener('change', event => {
    importData(event.target.files[0]);
    event.target.value = '';
  });

  $('#resetBtn').addEventListener(
    'click',
    resetAll
  );
}

function init() {
  state = loadState();

  timerSeconds = modeDuration(state.pomodoro.mode);
  plannerDate = today();

  bindEvents();
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);

})();
