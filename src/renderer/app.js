/* ─────────────────────────────────────────────────────────────────────────────
   DayFlow — main renderer application
   ───────────────────────────────────────────────────────────────────────────── */

'use strict';

const app = (() => {

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  tasks: [],          // { id, title, completed, priority, tags: [], createdAt }
  timelineItems: [],  // { id, taskId, taskTitle, date, startMin, durationMin, color, completed }
  blockedTimes: [],   // { id, label, date, startMin, durationMin, bg, fg }
  tags: [],           // { id, name, color }
  dayMeta: {},        // { 'YYYY-MM-DD': { theme: 'none', objectives: ['','',''] } }
  settings: { workStart: '08:00', workEnd: '18:00', theme: 'dark' }
};

let currentDate = new Date();
currentDate.setHours(0,0,0,0);

let dragPayload = null;  // { type: 'task'|'timeline', data }
let pendingSchedule = null; // task waiting for duration modal
let activeTagFilter = null; // tag id or null

// ── Day Themes ────────────────────────────────────────────────────────────────
const DAY_THEMES = {
  none: { label: 'Theme…', bgDark: null, bgLight: null, color: null, banner: null },

  focus: {
    label: '🎯 Focus',
    bgDark:  'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(59,90,246,0.18) 0%, transparent 100%)',
    bgLight: 'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(59,90,246,0.10) 0%, transparent 100%)',
    color: '#3b5af6',
    banner: `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="80" cy="80" r="72" stroke="currentColor" stroke-width="1.5" opacity="0.2"/>
      <circle cx="80" cy="80" r="52" stroke="currentColor" stroke-width="1.5" opacity="0.3"/>
      <circle cx="80" cy="80" r="32" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
      <circle cx="80" cy="80" r="14" fill="currentColor" opacity="0.45"/>
      <line x1="80" y1="0" x2="80" y2="160" stroke="currentColor" stroke-width="1" opacity="0.1"/>
      <line x1="0" y1="80" x2="160" y2="80" stroke="currentColor" stroke-width="1" opacity="0.1"/>
    </svg>`
  },

  creative: {
    label: '💡 Creative',
    bgDark:  'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(212,168,67,0.18) 0%, transparent 100%)',
    bgLight: 'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(212,168,67,0.11) 0%, transparent 100%)',
    color: '#d4a843',
    banner: `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M80 20 C55 20 36 40 36 66 C36 86 48 100 62 112 L62 124 L98 124 L98 112 C112 100 124 86 124 66 C124 40 105 20 80 20Z" stroke="currentColor" stroke-width="2" opacity="0.45"/>
      <line x1="65" y1="128" x2="95" y2="128" stroke="currentColor" stroke-width="2" opacity="0.35"/>
      <line x1="68" y1="135" x2="92" y2="135" stroke="currentColor" stroke-width="2" opacity="0.28"/>
      <path d="M72 72 Q80 58 88 72" stroke="currentColor" stroke-width="1.5" opacity="0.4"/>
      <line x1="80" y1="8" x2="80" y2="14" stroke="currentColor" stroke-width="2" opacity="0.22" stroke-linecap="round"/>
      <line x1="47" y1="19" x2="51" y2="24" stroke="currentColor" stroke-width="2" opacity="0.18" stroke-linecap="round"/>
      <line x1="113" y1="19" x2="109" y2="24" stroke="currentColor" stroke-width="2" opacity="0.18" stroke-linecap="round"/>
      <line x1="24" y1="52" x2="30" y2="54" stroke="currentColor" stroke-width="2" opacity="0.16" stroke-linecap="round"/>
      <line x1="136" y1="52" x2="130" y2="54" stroke="currentColor" stroke-width="2" opacity="0.16" stroke-linecap="round"/>
    </svg>`
  },

  flow: {
    label: '🌊 Flow',
    bgDark:  'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(63,212,196,0.15) 0%, transparent 100%)',
    bgLight: 'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(63,212,196,0.09) 0%, transparent 100%)',
    color: '#3fd4c4',
    banner: `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 36 Q40 16 80 36 Q120 56 150 36" stroke="currentColor" stroke-width="2.5" opacity="0.28" stroke-linecap="round"/>
      <path d="M10 66 Q40 46 80 66 Q120 86 150 66" stroke="currentColor" stroke-width="2.5" opacity="0.38" stroke-linecap="round"/>
      <path d="M10 96 Q40 76 80 96 Q120 116 150 96" stroke="currentColor" stroke-width="2.5" opacity="0.42" stroke-linecap="round"/>
      <path d="M10 126 Q40 106 80 126 Q120 146 150 126" stroke="currentColor" stroke-width="2.5" opacity="0.32" stroke-linecap="round"/>
    </svg>`
  },

  recharge: {
    label: '🌙 Recharge',
    bgDark:  'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(165,94,234,0.18) 0%, transparent 100%)',
    bgLight: 'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(165,94,234,0.10) 0%, transparent 100%)',
    color: '#a55eea',
    banner: `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M95 24 C64 30 44 58 44 90 C44 122 64 148 95 154 C70 144 52 118 52 90 C52 62 70 36 95 24Z" fill="currentColor" opacity="0.4"/>
      <circle cx="120" cy="35" r="4" fill="currentColor" opacity="0.45"/>
      <circle cx="142" cy="60" r="3" fill="currentColor" opacity="0.35"/>
      <circle cx="132" cy="82" r="2" fill="currentColor" opacity="0.3"/>
      <circle cx="110" cy="22" r="2.5" fill="currentColor" opacity="0.4"/>
      <circle cx="148" cy="43" r="2" fill="currentColor" opacity="0.28"/>
      <circle cx="125" cy="50" r="1.5" fill="currentColor" opacity="0.22"/>
    </svg>`
  },

  energy: {
    label: '⚡ Energy',
    bgDark:  'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(255,165,2,0.18) 0%, transparent 100%)',
    bgLight: 'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(255,165,2,0.10) 0%, transparent 100%)',
    color: '#ffa502',
    banner: `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M96 15 L48 86 L82 86 L64 145 L118 66 L84 66 Z"
            stroke="currentColor" stroke-width="2"
            fill="currentColor" fill-opacity="0.12"
            opacity="0.65" stroke-linejoin="round"/>
    </svg>`
  },

  nature: {
    label: '🌿 Nature',
    bgDark:  'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(46,204,113,0.15) 0%, transparent 100%)',
    bgLight: 'radial-gradient(ellipse 55% 45% at 100% 0%, rgba(46,204,113,0.09) 0%, transparent 100%)',
    color: '#2ecc71',
    banner: `<svg viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M80 148 L80 68" stroke="currentColor" stroke-width="2.5" opacity="0.35" stroke-linecap="round"/>
      <path d="M80 90 C80 90 44 74 26 44 C54 42 76 60 80 90Z" fill="currentColor" opacity="0.38"/>
      <path d="M80 68 C80 68 116 48 138 18 C110 18 84 38 80 68Z" fill="currentColor" opacity="0.32"/>
      <path d="M80 112 C80 112 50 100 36 78 C62 76 78 94 80 112Z" fill="currentColor" opacity="0.26"/>
    </svg>`
  }
};

const QUADRANT_COLORS = {
  do:        { bg: '#2d0f3d', border: '#c45fef', text: '#e8b8ff' },
  schedule:  { bg: '#0f2d1a', border: '#2ecc71', text: '#a8f0c0' },
  delegate:  { bg: '#0f1f3d', border: '#3b9eff', text: '#a8d4ff' },
  eliminate: { bg: '#2d1f0a', border: '#ff9f3b', text: '#ffd8a8' },
  none:      { bg: '#1a2030', border: '#6b8cba', text: '#c0d0e8' }
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await loadData();
  applyTheme(state.settings.theme || 'dark');
  renderAll();
  startClock();
  startTimerLoop();
  fetchCalendar();
  bindEvents();
}

// ── Persistence ───────────────────────────────────────────────────────────────
async function loadData() {
  try {
    const saved = await window.electronAPI.loadData();
    if (saved) {
      state.tasks         = saved.tasks        || [];
      state.timelineItems = saved.timelineItems|| [];
      state.blockedTimes  = saved.blockedTimes || [];
      state.tags          = saved.tags         || [];
      state.dayMeta       = saved.dayMeta      || {};
      if (saved.settings)  state.settings = { ...state.settings, ...saved.settings };
    }
  } catch(e) { console.warn('Load failed', e); }
}

async function saveData() {
  try {
    await window.electronAPI.saveData({
      tasks: state.tasks,
      timelineItems: state.timelineItems,
      blockedTimes: state.blockedTimes,
      tags: state.tags,
      dayMeta: state.dayMeta,
      settings: state.settings
    });
  } catch(e) { console.warn('Save failed', e); }
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
const debouncedSave = debounce(saveData, 600);

// ── Theme ─────────────────────────────────────────────────────────────────────
function applyTheme(theme) {
  const root = document.documentElement;
  const icon  = document.getElementById('theme-icon');
  const label = document.getElementById('theme-label');

  if (theme === 'light') {
    root.classList.add('light');
    if (icon)  icon.textContent  = '☀️';
    if (label) label.textContent = 'Light';
  } else {
    root.classList.remove('light');
    if (icon)  icon.textContent  = '🌙';
    if (label) label.textContent = 'Dark';
  }
  state.settings.theme = theme;
  applyDayTheme(getDayMeta().theme || 'none');
}

function toggleTheme() {
  const next = state.settings.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  debouncedSave();
}


// ── Day Meta (theme + objectives) ────────────────────────────────────────────
function getDayMeta(date) {
  const key = dateKey(date || currentDate);
  if (!state.dayMeta[key]) {
    state.dayMeta[key] = { theme: 'none', objectives: ['', '', ''] };
  }
  return state.dayMeta[key];
}

function applyDayTheme(themeKey) {
  const theme = DAY_THEMES[themeKey] || DAY_THEMES.none;
  const panel  = document.getElementById('main-panel');
  const banner = document.getElementById('day-banner');
  const isLight = state.settings.theme === 'light';

  panel.style.backgroundImage = theme.bgDark
    ? (isLight ? theme.bgLight : theme.bgDark)
    : '';

  if (theme.banner && banner) {
    banner.innerHTML  = theme.banner;
    banner.style.color = theme.color;
    banner.classList.remove('day-banner--hidden');
  } else if (banner) {
    banner.innerHTML = '';
    banner.classList.add('day-banner--hidden');
  }
}

function renderDayMeta() {
  const meta = getDayMeta();

  const sel = document.getElementById('day-theme-select');
  if (sel) sel.value = meta.theme || 'none';

  document.querySelectorAll('.obj-input').forEach(input => {
    const idx = parseInt(input.dataset.idx);
    input.value = (meta.objectives && meta.objectives[idx]) || '';
  });

  applyDayTheme(meta.theme || 'none');
}

function renderAll() {
  renderDateHeader();
  renderTagFilterBar();
  renderTaskList();
  renderMatrix();
  renderTimeline();
  applyWorkHours();
  renderDayMeta();
}

// ── Date Helpers ──────────────────────────────────────────────────────────────
function dateKey(d) {
  return d.toISOString().split('T')[0];
}

function todayItems(arr) {
  const key = dateKey(currentDate);
  return arr.filter(x => x.date === key);
}

function minToTime(min) {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function timeToMin(str) {
  const [h, m] = str.split(':').map(Number);
  return h * 60 + m;
}

// ── Date Header ───────────────────────────────────────────────────────────────
function renderDateHeader() {
  const opts = { weekday: 'long', month: 'long', day: 'numeric' };
  document.getElementById('date-display').textContent =
    currentDate.toLocaleDateString('en-US', opts);

  const isToday = dateKey(currentDate) === dateKey(new Date());
  const yr = currentDate.getFullYear();
  document.getElementById('date-sub').textContent =
    `${isToday ? 'TODAY · ' : ''}${yr}`;
}

// ── Task List ─────────────────────────────────────────────────────────────────
function renderTaskList() {
  const filter = document.getElementById('priority-filter').value;
  const ul = document.getElementById('task-list');
  ul.innerHTML = '';

  const visible = state.tasks.filter(t => {
    if (t.completed) return false;
    if (filter !== 'all' && !(t.priority === filter || (filter === 'none' && !t.priority))) return false;
    if (activeTagFilter && !(t.tags || []).includes(activeTagFilter)) return false;
    return true;
  });

  visible.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    li.draggable = true;
    li.dataset.id = task.id;

    const badge = task.priority ?
      `<span class="task-priority-badge badge-${task.priority}">${shortLabel(task.priority)}</span>` : '';

    const taskTags = (task.tags || []).map(tid => {
      const tag = state.tags.find(tg => tg.id === tid);
      return tag ? `<span class="task-tag-chip" style="--tag-color:${tag.color}" data-tag-id="${tag.id}">${escHtml(tag.name)}</span>` : '';
    }).join('');

    // Show scheduled time if this task is on today's timeline
    const todayScheduled = state.timelineItems.filter(i =>
      i.taskId === task.id && i.date === dateKey(currentDate)
    );
    const scheduledBadge = todayScheduled.length > 0
      ? todayScheduled.map(i =>
          `<span class="task-scheduled-badge">⏱ ${minToTime(i.startMin)}</span>`
        ).join('')
      : '';

    li.innerHTML = `
      <button class="task-complete-btn" title="Mark complete">${task.completed ? '✓' : ''}</button>
      <div class="task-main">
        <div class="task-title-row">
          <span class="task-title">${escHtml(task.title)}</span>
          ${scheduledBadge}
        </div>
        ${taskTags ? `<div class="task-tag-row">${taskTags}</div>` : ''}
      </div>
      ${badge}
      <div class="task-actions">
        <button class="task-action-btn" title="Add/edit tags" data-action="tags">⊕</button>
        <button class="task-action-btn" title="Set priority" data-action="priority">◈</button>
        <button class="task-action-btn" title="Delete" data-action="delete">✕</button>
      </div>
    `;

    // Drag
    li.addEventListener('dragstart', (e) => {
      dragPayload = { type: 'task', task };
      li.classList.add('dragging');
      updateDragGhost(task.title);
      e.dataTransfer.effectAllowed = 'copy';
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      hideDragGhost();
    });

    // Complete button
    li.querySelector('.task-complete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleTaskComplete(task.id);
    });

    // Tag chips — click to filter by that tag
    li.querySelectorAll('.task-tag-chip').forEach(chip => {
      chip.addEventListener('click', (e) => {
        e.stopPropagation();
        const tid = chip.dataset.tagId;
        activeTagFilter = activeTagFilter === tid ? null : tid;
        renderTagFilterBar();
        renderTaskList();
      });
    });

    // Inline title edit on double-click
    li.querySelector('.task-title')?.addEventListener('dblclick', e => {
      e.stopPropagation();
      startInlineEdit(task, e.currentTarget);
    });

    // Action buttons
    li.querySelectorAll('.task-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.action === 'delete')   deleteTask(task.id);
        if (btn.dataset.action === 'priority') showPriorityMenu(task.id, btn);
        if (btn.dataset.action === 'tags')     showTagMenu(task.id, btn);
      });
    });

    ul.appendChild(li);
  });

  // Completed section
  const done = state.tasks.filter(t => t.completed);
  if (done.length && filter === 'all' && !activeTagFilter) {
    const sep = document.createElement('li');
    sep.style.cssText = 'padding: 10px 0 4px; font-size:10px; color: var(--text-muted); text-transform:uppercase; letter-spacing:.08em;';
    sep.textContent = `Completed (${done.length})`;
    ul.appendChild(sep);
    done.forEach(task => {
      const li = document.createElement('li');
      li.className = 'task-item completed';
      li.innerHTML = `
        <button class="task-complete-btn" title="Unmark">✓</button>
        <span class="task-title">${escHtml(task.title)}</span>
        <div class="task-actions">
          <button class="task-action-btn" data-action="delete">✕</button>
        </div>
      `;
      li.querySelector('.task-complete-btn').addEventListener('click', () => toggleTaskComplete(task.id));
      li.querySelector('[data-action=delete]').addEventListener('click', () => deleteTask(task.id));
      ul.appendChild(li);
    });
  }
}

function shortLabel(p) {
  return { do: 'Q1', schedule: 'Q2', delegate: 'Q3', eliminate: 'Q4' }[p] || p;
}

function addTask(title) {
  if (!title.trim()) return;
  state.tasks.unshift({ id: uid(), title: title.trim(), completed: false, priority: null, createdAt: Date.now() });
  renderTaskList();
  renderMatrix();
  debouncedSave();
}

function renameTask(id, newTitle) {
  const task = state.tasks.find(t => t.id === id);
  if (!task || !newTitle.trim()) return;
  task.title = newTitle.trim();
  state.timelineItems.filter(i => i.taskId === id).forEach(i => i.taskTitle = task.title);
  renderTaskList();
  renderMatrix();
  renderTimeline();
  debouncedSave();
}

function startInlineEdit(task, titleEl) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = task.title;
  input.className = 'task-title-edit';

  let committed = false;

  const commit = () => {
    if (committed) return;
    committed = true;
    const val = input.value.trim();
    if (val && val !== task.title) renameTask(task.id, val);
    else renderTaskList();
  };

  const cancel = () => {
    if (committed) return;
    committed = true;
    renderTaskList();
  };

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  { e.preventDefault(); commit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
    e.stopPropagation();
  });
  input.addEventListener('blur', commit);
  input.addEventListener('click', e => e.stopPropagation());

  titleEl.replaceWith(input);
  input.focus();
  input.select();
}

function deleteTask(id) {
  state.tasks = state.tasks.filter(t => t.id !== id);
  state.timelineItems = state.timelineItems.filter(i => i.taskId !== id);
  renderAll();
  debouncedSave();
}

function toggleTaskComplete(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) { task.completed = !task.completed; }
  // also mark timeline items
  state.timelineItems.filter(i => i.taskId === id).forEach(i => {
    i.completed = task?.completed ?? false;
  });
  renderTaskList();
  renderMatrix();
  renderTimeline();
  debouncedSave();
}

function setTaskPriority(taskId, priority) {
  const task = state.tasks.find(t => t.id === taskId);
  if (task) { task.priority = priority === task.priority ? null : priority; }
  renderTaskList();
  renderMatrix();
  debouncedSave();
}

function showPriorityMenu(taskId, btn) {
  document.querySelectorAll('.priority-menu').forEach(m => m.remove());
  const menu = document.createElement('div');
  menu.className = 'priority-menu';
  menu.style.cssText = `
    position: fixed; z-index: 500; background: var(--bg-raised);
    border: 1px solid var(--border-mid); border-radius: var(--radius-md);
    padding: 6px; display: flex; flex-direction: column; gap: 3px;
    box-shadow: var(--shadow-float); min-width: 160px;
  `;

  const options = [
    { val: 'do',       label: 'Q1 – Do First',   color: 'var(--q1-color)' },
    { val: 'schedule', label: 'Q2 – Schedule',    color: 'var(--q2-color)' },
    { val: 'delegate', label: 'Q3 – Delegate',    color: 'var(--q3-color)' },
    { val: 'eliminate',label: 'Q4 – Eliminate',   color: 'var(--q4-color)' },
    { val: null,       label: 'Clear priority',   color: 'var(--text-muted)' }
  ];

  options.forEach(opt => {
    const item = document.createElement('button');
    item.style.cssText = `background: none; border: none; color: ${opt.color}; font-size: 12px;
      padding: 5px 10px; border-radius: 4px; cursor: pointer; text-align: left; font-family: var(--font-sans);`;
    item.textContent = opt.label;
    item.addEventListener('click', () => { setTaskPriority(taskId, opt.val); menu.remove(); });
    item.addEventListener('mouseenter', () => item.style.background = 'var(--bg-active)');
    item.addEventListener('mouseleave', () => item.style.background = 'none');
    menu.appendChild(item);
  });

  const rect = btn.getBoundingClientRect();
  menu.style.top  = `${rect.bottom + 4}px`;
  menu.style.left = `${rect.left}px`;
  document.body.appendChild(menu);
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 10);
}

// ── Tags ──────────────────────────────────────────────────────────────────────

const TAG_PALETTE = [
  '#e05a5a','#e07a3a','#d4a843','#7ab843','#3ab87a',
  '#3ab8c4','#3a7ae0','#7a3ae0','#c43ab8','#e03a7a'
];

function getAllTagsUsed() {
  const used = new Set();
  state.tasks.forEach(t => (t.tags || []).forEach(id => used.add(id)));
  return state.tags.filter(tg => used.has(tg.id));
}

function renderTagFilterBar() {
  const bar = document.getElementById('tag-filter-bar');
  if (!bar) return;
  bar.innerHTML = '';

  const usedTags = getAllTagsUsed();
  if (usedTags.length === 0) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'flex';

  // "All" pill
  const allPill = document.createElement('button');
  allPill.className = 'tag-filter-pill' + (!activeTagFilter ? ' active' : '');
  allPill.textContent = 'All';
  allPill.addEventListener('click', () => {
    activeTagFilter = null;
    renderTagFilterBar();
    renderTaskList();
  });
  bar.appendChild(allPill);

  usedTags.forEach(tag => {
    const pill = document.createElement('button');
    pill.className = 'tag-filter-pill' + (activeTagFilter === tag.id ? ' active' : '');
    pill.style.setProperty('--tag-color', tag.color);
    pill.textContent = tag.name;
    pill.addEventListener('click', () => {
      activeTagFilter = activeTagFilter === tag.id ? null : tag.id;
      renderTagFilterBar();
      renderTaskList();
    });
    bar.appendChild(pill);
  });
}

function showTagMenu(taskId, btn) {
  document.querySelectorAll('.tag-menu').forEach(m => m.remove());

  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!task.tags) task.tags = [];

  const menu = document.createElement('div');
  menu.className = 'tag-menu';
  menu.style.cssText = `
    position: fixed; z-index: 500; background: var(--bg-raised);
    border: 1px solid var(--border-mid); border-radius: var(--radius-md);
    padding: 8px; display: flex; flex-direction: column; gap: 4px;
    box-shadow: var(--shadow-float); min-width: 200px;
  `;

  // Header
  const header = document.createElement('div');
  header.style.cssText = 'font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:.08em; color:var(--text-muted); padding: 2px 4px 6px; border-bottom: 1px solid var(--border-subtle); margin-bottom:2px;';
  header.textContent = 'Tags';
  menu.appendChild(header);

  // Existing tags
  state.tags.forEach(tag => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; align-items:center; gap:8px; padding:5px 6px; border-radius:5px; cursor:pointer; transition:background .1s;';
    const hasTag = task.tags.includes(tag.id);
    row.innerHTML = `
      <span style="width:10px;height:10px;border-radius:50%;background:${tag.color};flex-shrink:0;"></span>
      <span style="flex:1;font-size:12px;color:var(--text-primary);">${escHtml(tag.name)}</span>
      <span style="font-size:13px;color:var(--text-muted);">${hasTag ? '✓' : ''}</span>
    `;
    row.addEventListener('mouseenter', () => row.style.background = 'var(--bg-active)');
    row.addEventListener('mouseleave', () => row.style.background = 'none');
    row.addEventListener('click', () => {
      toggleTaskTag(taskId, tag.id);
      menu.remove();
    });
    menu.appendChild(row);
  });

  // Divider + Create new tag
  const divider = document.createElement('div');
  divider.style.cssText = 'border-top:1px solid var(--border-subtle); margin: 4px 0;';
  menu.appendChild(divider);

  const createRow = document.createElement('div');
  createRow.style.cssText = 'display:flex; align-items:center; gap:6px; padding:4px 6px;';
  createRow.innerHTML = `
    <input class="new-tag-input" type="text" placeholder="New tag name…" style="
      flex:1; background:var(--bg-surface); border:1px solid var(--border-mid);
      border-radius:var(--radius-sm); color:var(--text-primary); font-family:var(--font-sans);
      font-size:12px; padding:5px 8px; outline:none;
    "/>
    <div class="new-tag-color-dot" style="width:14px;height:14px;border-radius:50%;background:${TAG_PALETTE[0]};cursor:pointer;flex-shrink:0;border:2px solid rgba(255,255,255,0.3);"></div>
    <button class="new-tag-add-btn" style="
      background:var(--accent-gold); border:none; border-radius:4px; color:#0b0b10;
      font-size:11px; font-weight:600; padding:4px 8px; cursor:pointer;
    ">Add</button>
  `;
  menu.appendChild(createRow);

  // Color picker on dot click
  let newTagColor = TAG_PALETTE[0];
  const dot = createRow.querySelector('.new-tag-color-dot');
  dot.addEventListener('click', (e) => {
    e.stopPropagation();
    showColorPicker(dot, TAG_PALETTE, (color) => {
      newTagColor = color;
      dot.style.background = color;
    });
  });

  // Add button
  const addBtn = createRow.querySelector('.new-tag-add-btn');
  const input  = createRow.querySelector('.new-tag-input');
  const doCreate = () => {
    const name = input.value.trim();
    if (!name) return;
    const newTag = { id: uid(), name, color: newTagColor };
    state.tags.push(newTag);
    toggleTaskTag(taskId, newTag.id);
    menu.remove();
  };
  addBtn.addEventListener('click', doCreate);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doCreate(); e.stopPropagation(); });

  // Manage tags link
  if (state.tags.length > 0) {
    const manageRow = document.createElement('div');
    manageRow.style.cssText = 'padding:4px 6px;';
    const manageBtn = document.createElement('button');
    manageBtn.style.cssText = 'background:none;border:none;color:var(--text-muted);font-size:11px;cursor:pointer;padding:2px 0;';
    manageBtn.textContent = 'Manage tags…';
    manageBtn.addEventListener('click', () => { menu.remove(); openManageTagsModal(); });
    manageRow.appendChild(manageBtn);
    menu.appendChild(manageRow);
  }

  const rect = btn.getBoundingClientRect();
  menu.style.top  = `${rect.bottom + 4}px`;
  menu.style.left = `${Math.max(0, rect.right - 200)}px`;
  document.body.appendChild(menu);
  input.focus();
  setTimeout(() => document.addEventListener('click', () => menu.remove(), { once: true }), 10);
}

function showColorPicker(anchor, palette, onSelect) {
  document.querySelectorAll('.color-picker-popup').forEach(p => p.remove());
  const popup = document.createElement('div');
  popup.className = 'color-picker-popup';
  popup.style.cssText = `
    position:fixed; z-index:600; background:var(--bg-raised); border:1px solid var(--border-mid);
    border-radius:var(--radius-sm); padding:8px; display:flex; flex-wrap:wrap; gap:5px;
    box-shadow:var(--shadow-float); width:138px;
  `;
  palette.forEach(color => {
    const dot = document.createElement('div');
    dot.style.cssText = `width:18px;height:18px;border-radius:50%;background:${color};cursor:pointer;transition:transform .1s;`;
    dot.addEventListener('mouseenter', () => dot.style.transform = 'scale(1.2)');
    dot.addEventListener('mouseleave', () => dot.style.transform = 'scale(1)');
    dot.addEventListener('click', (e) => { e.stopPropagation(); onSelect(color); popup.remove(); });
    popup.appendChild(dot);
  });
  const rect = anchor.getBoundingClientRect();
  popup.style.top  = `${rect.bottom + 4}px`;
  popup.style.left = `${rect.left - 60}px`;
  document.body.appendChild(popup);
  setTimeout(() => document.addEventListener('click', () => popup.remove(), { once: true }), 10);
}

function toggleTaskTag(taskId, tagId) {
  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;
  if (!task.tags) task.tags = [];
  const idx = task.tags.indexOf(tagId);
  if (idx === -1) task.tags.push(tagId);
  else            task.tags.splice(idx, 1);
  renderTagFilterBar();
  renderTaskList();
  debouncedSave();
}

function openManageTagsModal() {
  document.querySelectorAll('.manage-tags-modal').forEach(m => m.remove());

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay manage-tags-modal';
  overlay.innerHTML = `
    <div class="modal" style="min-width:320px;">
      <h2>Manage Tags</h2>
      <div id="manage-tags-list" style="display:flex;flex-direction:column;gap:6px;max-height:300px;overflow-y:auto;"></div>
      <div class="modal-actions">
        <button class="btn-primary" id="manage-tags-close-btn">Done</button>
      </div>
    </div>
  `;

  function refreshList() {
    const list = overlay.querySelector('#manage-tags-list');
    list.innerHTML = '';
    if (state.tags.length === 0) {
      list.innerHTML = '<span style="color:var(--text-muted);font-size:12px;">No tags yet.</span>';
      return;
    }
    state.tags.forEach(tag => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 8px;background:var(--bg-surface);border-radius:var(--radius-sm);border:1px solid var(--border-subtle);';
      row.innerHTML = `
        <div class="tag-color-swatch" data-tag-id="${tag.id}" style="width:14px;height:14px;border-radius:50%;background:${tag.color};cursor:pointer;flex-shrink:0;border:2px solid rgba(255,255,255,0.2);"></div>
        <span style="flex:1;font-size:13px;color:var(--text-primary);">${escHtml(tag.name)}</span>
        <button class="rename-tag-btn" data-tag-id="${tag.id}" style="background:none;border:none;color:var(--text-muted);font-size:11px;cursor:pointer;padding:2px 5px;border-radius:3px;" title="Rename">✎</button>
        <button class="delete-tag-btn" data-tag-id="${tag.id}" style="background:none;border:none;color:var(--text-muted);font-size:12px;cursor:pointer;padding:2px 5px;border-radius:3px;" title="Delete">✕</button>
      `;
      row.querySelector('.tag-color-swatch').addEventListener('click', (e) => {
        showColorPicker(e.target, TAG_PALETTE, (color) => {
          tag.color = color;
          e.target.style.background = color;
          renderTagFilterBar();
          renderTaskList();
          debouncedSave();
        });
      });
      row.querySelector('.rename-tag-btn').addEventListener('click', () => {
        const name = prompt('Rename tag:', tag.name);
        if (name && name.trim()) {
          tag.name = name.trim();
          refreshList();
          renderTagFilterBar();
          renderTaskList();
          debouncedSave();
        }
      });
      row.querySelector('.delete-tag-btn').addEventListener('click', () => {
        state.tags = state.tags.filter(tg => tg.id !== tag.id);
        state.tasks.forEach(t => { if (t.tags) t.tags = t.tags.filter(id => id !== tag.id); });
        if (activeTagFilter === tag.id) activeTagFilter = null;
        refreshList();
        renderTagFilterBar();
        renderTaskList();
        debouncedSave();
      });
      list.appendChild(row);
    });
  }

  refreshList();
  overlay.querySelector('#manage-tags-close-btn').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  document.body.appendChild(overlay);
}

function renderMatrix() {
  ['do','schedule','delegate','eliminate'].forEach(q => {
    const el = document.getElementById(`q-${q}`);
    if (!el) return;
    el.innerHTML = '';
    state.tasks.filter(t => t.priority === q && !t.completed).forEach(task => {
      const li = document.createElement('li');
      li.className = 'q-task-item';
      li.textContent = task.title;
      li.draggable = true;
      li.addEventListener('dragstart', e => {
        dragPayload = { type: 'task', task };
        e.dataTransfer.effectAllowed = 'copy';
      });
      el.appendChild(li);
    });
  });
}

function dropOnQuadrant(e, quadrant) {
  e.preventDefault();
  if (!dragPayload) return;
  const { task } = dragPayload;
  if (task) setTaskPriority(task.id, quadrant);
  dragPayload = null;
}

// ── Timeline Rendering ────────────────────────────────────────────────────────
function getWorkMinutes() {
  const start = timeToMin(state.settings.workStart);
  const end   = timeToMin(state.settings.workEnd);
  return { start, end, totalHours: (end - start) / 60 };
}

function applyWorkHours() {
  const { start, end } = getWorkMinutes();
  const totalMin = end - start;
  const totalPx  = (totalMin / 60) * parseInt(getComputedStyle(document.documentElement).getPropertyValue('--timeline-unit') || '80');
  document.getElementById('timeline-track').style.minHeight = `${totalPx + 40}px`;
  renderHourLabels();
}

function renderHourLabels() {
  const { start, end } = getWorkMinutes();
  const hoursEl = document.getElementById('timeline-hours');
  hoursEl.innerHTML = '';

  // Top spacer
  const spacer = document.createElement('div');
  spacer.style.height = '20px';
  hoursEl.appendChild(spacer);

  for (let m = start; m <= end; m += 60) {
    const label = document.createElement('div');
    label.className = 'hour-label';
    const h = Math.floor(m / 60);
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 || 12;
    label.textContent = `${h12}${ampm}`;
    hoursEl.appendChild(label);
  }
}

function minToY(min) {
  const { start } = getWorkMinutes();
  const unit = 80; // px per hour
  return 20 + ((min - start) / 60) * unit;
}

function yToMin(y) {
  const { start } = getWorkMinutes();
  const unit = 80;
  const rawMin = ((y - 20) / unit) * 60 + start;
  // Snap to 15-minute grid
  return Math.round(rawMin / 15) * 15;
}

function renderTimeline() {
  const container = document.getElementById('timeline-items');
  container.innerHTML = '';

  const key = dateKey(currentDate);
  const todayTItems  = state.timelineItems.filter(i => i.date === key);
  const todayBlocked = state.blockedTimes.filter(b => b.date === key);
  const unit = 80;

  // Blocked items (full width, no overlap handling needed)
  todayBlocked.forEach(block => {
    const top    = minToY(block.startMin);
    const height = Math.max((block.durationMin / 60) * unit, 20);

    const el = document.createElement('div');
    el.className = 'timeline-block';
    el.style.cssText = `top:${top}px; height:${height}px; background:${block.bg||'#2a2a3a'}; color:${block.fg||'#a0a0c0'};`;

    el.innerHTML = `
      <span class="block-label-text">${escHtml(block.label)}</span>
      <div class="block-actions">
        <button class="block-edit-btn" title="Edit">✎</button>
        <button class="block-remove-btn" title="Remove">✕</button>
      </div>
    `;
    el.querySelector('.block-remove-btn').addEventListener('click', () => removeBlock(block.id));
    el.querySelector('.block-edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openBlockEditPopover(block.id, el);
    });
    el.addEventListener('dblclick', () => openBlockEditPopover(block.id, el));
    container.appendChild(el);
  });

  // ── Overlap layout for task items ─────────────────────────────────────────
  // Sort by start time
  const sorted = [...todayTItems].sort((a, b) => a.startMin - b.startMin);

  // Assign each item a column within its overlap group.
  // We track "columns" as arrays of end-times so we can slot each item into
  // the first column whose last item has already ended.
  const layout = []; // parallel to sorted: { col, totalCols }
  const colEnds = []; // colEnds[c] = endMin of last item placed in column c

  // First pass: assign columns
  const itemCols = sorted.map(item => {
    const endMin = item.startMin + item.durationMin;
    // Find first free column
    let col = colEnds.findIndex(e => e <= item.startMin);
    if (col === -1) col = colEnds.length;
    colEnds[col] = endMin;
    return col;
  });

  // Second pass: for each item, find how many columns are active during its span
  // (i.e. the width of the overlap group it belongs to)
  const totalCols = sorted.map((item, i) => {
    const end = item.startMin + item.durationMin;
    let maxCol = itemCols[i];
    sorted.forEach((other, j) => {
      // overlaps if they share any time
      if (other.startMin < end && (other.startMin + other.durationMin) > item.startMin) {
        if (itemCols[j] > maxCol) maxCol = itemCols[j];
      }
    });
    return maxCol + 1;
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  const nowMin = nowToMinutes();
  const GUTTER = 4; // px gap between columns

  sorted.forEach((item, i) => {
    const col   = itemCols[i];
    const cols  = totalCols[i];
    const top   = minToY(item.startMin);
    const height = Math.max((item.durationMin / 60) * unit, 28);
    const colors = QUADRANT_COLORS[getTaskPriority(item.taskId)] || QUADRANT_COLORS.none;

    const isActive = nowMin >= item.startMin && nowMin < item.startMin + item.durationMin;

    const el = document.createElement('div');
    el.className = 'timeline-card' + (item.completed ? ' completed' : '') + (isActive ? ' active-now' : '');
    el.dataset.id = item.id;

    // Position: split the track horizontally into `cols` equal columns
    // The track spans from left:8px to right:8px, so usable width = 100% - 16px
    const pct     = 100 / cols;
    const leftPct = col * pct;
    const widthPct = pct;
    // Apply gutter between columns (not on outermost edges)
    const gutterLeft  = col > 0        ? GUTTER / 2 : 0;
    const gutterRight = col < cols - 1 ? GUTTER / 2 : 0;

    el.style.cssText = `
      position: absolute;
      top: ${top}px;
      height: ${height}px;
      left: calc(8px + ${leftPct}% + ${gutterLeft}px);
      width: calc(${widthPct}% - ${gutterLeft + gutterRight}px - ${cols === 1 ? 16 : col === cols-1 ? 8 : 0}px);
      background: ${colors.bg};
      border-color: ${colors.border};
    `;

    const endMin = item.startMin + item.durationMin;
    el.innerHTML = `
      <span class="tc-title"><span class="tc-time">${minToTime(item.startMin)} – ${minToTime(endMin)}</span><span class="tc-task-title"> ${escHtml(item.taskTitle)}</span></span>
      <div class="tc-actions">
        <button class="tc-btn" data-action="edit" title="Edit time">✎</button>
        <button class="tc-btn" data-action="complete" title="${item.completed?'Unmark':'Mark complete'}">${item.completed?'↺':'✓'}</button>
        <button class="tc-btn" data-action="remove" title="Remove from timeline">✕</button>
      </div>
    `;

    el.querySelectorAll('.tc-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.dataset.action === 'complete') toggleTimelineComplete(item.id);
        if (btn.dataset.action === 'remove')   removeTimelineItem(item.id);
        if (btn.dataset.action === 'edit')     openTimelineEditPopover(item.id, el);
      });
    });

    // Double-click title → inline rename
    el.querySelector('.tc-task-title').addEventListener('dblclick', e => {
      e.stopPropagation();
      const task = state.tasks.find(t => t.id === item.taskId);
      if (!task) return;

      const input = document.createElement('input');
      input.type = 'text';
      input.value = item.taskTitle;
      input.className = 'tc-title-edit';

      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        const val = input.value.trim();
        if (val && val !== task.title) renameTask(task.id, val);
        else renderTimeline();
      };
      const cancel = () => {
        if (committed) return;
        committed = true;
        renderTimeline();
      };
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
        e.stopPropagation();
      });
      input.addEventListener('blur', commit);
      input.addEventListener('click', e => e.stopPropagation());

      e.currentTarget.replaceWith(input);
      input.focus();
      input.select();
    });

    // Double-click anywhere else → edit time/duration
    el.addEventListener('dblclick', (e) => {
      if (!e.target.closest('.tc-btn') && !e.target.closest('.tc-task-title')) {
        openTimelineEditPopover(item.id, el);
      }
    });

    container.appendChild(el);
  });

  updateTimeIndicator();
}

function getTaskPriority(taskId) {
  return state.tasks.find(t => t.id === taskId)?.priority || 'none';
}

function removeTimelineItem(id) {
  state.timelineItems = state.timelineItems.filter(i => i.id !== id);
  renderTimeline();
  debouncedSave();
}

function openTimelineEditPopover(itemId, cardEl) {
  // Close any existing popover
  document.querySelectorAll('.timeline-edit-popover').forEach(p => p.remove());

  const item = state.timelineItems.find(i => i.id === itemId);
  if (!item) return;

  const popover = document.createElement('div');
  popover.className = 'timeline-edit-popover';

  const durOptions = [15, 30, 45, 60, 90, 120];

  popover.innerHTML = `
    <div class="tep-header">
      <span class="tep-title">Edit Schedule</span>
      <button class="tep-close">✕</button>
    </div>
    <label class="tep-label">Start time
      <input class="tep-start" type="time" value="${minToTime(item.startMin)}" />
    </label>
    <label class="tep-label">Duration
      <div class="tep-dur-btns">
        ${durOptions.map(m => `<button class="tep-dur-btn${item.durationMin === m ? ' active' : ''}" data-min="${m}">${m < 60 ? m+'m' : (m/60)+'h'}</button>`).join('')}
      </div>
      <div class="tep-custom-row">
        <input class="tep-minutes" type="number" min="5" max="480" value="${item.durationMin}" /> <span>min</span>
      </div>
    </label>
    <div class="tep-actions">
      <button class="tep-cancel btn-secondary">Cancel</button>
      <button class="tep-save btn-primary">Save</button>
    </div>
  `;

  // Position popover next to the card
  document.body.appendChild(popover);
  const cardRect = cardEl.getBoundingClientRect();
  const popW = 220;
  const spaceRight = window.innerWidth - cardRect.right;
  const left = spaceRight >= popW + 12
    ? cardRect.right + 8
    : cardRect.left - popW - 8;
  const top = Math.min(cardRect.top, window.innerHeight - popover.offsetHeight - 16);
  popover.style.left = `${Math.max(8, left)}px`;
  popover.style.top  = `${Math.max(8, top)}px`;

  // Duration quick-select buttons
  const minutesInput = popover.querySelector('.tep-minutes');
  popover.querySelectorAll('.tep-dur-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      popover.querySelectorAll('.tep-dur-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      minutesInput.value = btn.dataset.min;
    });
  });

  minutesInput.addEventListener('input', () => {
    popover.querySelectorAll('.tep-dur-btn').forEach(b => b.classList.remove('active'));
  });

  // Save
  popover.querySelector('.tep-save').addEventListener('click', () => {
    const newStart = timeToMin(popover.querySelector('.tep-start').value);
    const newDur   = Math.max(5, parseInt(minutesInput.value) || 30);
    item.startMin    = newStart;
    item.durationMin = newDur;
    popover.remove();
    renderTimeline();
    renderTaskList(); // update sidebar scheduled badge
    debouncedSave();
    showToast('Updated', `Rescheduled to ${minToTime(newStart)}, ${newDur} min`, 'info');
  });

  // Cancel / close
  const close = () => popover.remove();
  popover.querySelector('.tep-cancel').addEventListener('click', close);
  popover.querySelector('.tep-close').addEventListener('click', close);

  // Click-outside to close
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!popover.contains(e.target) && !cardEl.contains(e.target)) {
        popover.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 10);

  // Focus the start input
  popover.querySelector('.tep-start').focus();
}



function toggleTimelineComplete(id) {
  const item = state.timelineItems.find(i => i.id === id);
  if (item) item.completed = !item.completed;
  // sync task
  const task = state.tasks.find(t => t.id === item?.taskId);
  if (task) task.completed = item.completed;
  renderTaskList();
  renderTimeline();
  debouncedSave();
}

function removeBlock(id) {
  state.blockedTimes = state.blockedTimes.filter(b => b.id !== id);
  renderTimeline();
  debouncedSave();
}

function openBlockEditPopover(blockId, cardEl) {
  document.querySelectorAll('.block-edit-popover').forEach(p => p.remove());

  const block = state.blockedTimes.find(b => b.id === blockId);
  if (!block) return;

  const endMin = block.startMin + block.durationMin;

  const BG_MAP = {
    '#coral':  { bg: 'rgba(255,107,107,0.22)', fg: '#ff6b6b' },
    '#teal':   { bg: 'rgba(29,209,161,0.20)',  fg: '#1dd1a1' },
    '#sky':    { bg: 'rgba(84,160,255,0.20)',  fg: '#54a0ff' },
    '#violet': { bg: 'rgba(165,94,234,0.20)',  fg: '#a55eea' },
    '#amber':  { bg: 'rgba(255,165,2,0.20)',   fg: '#ffa502' }
  };
  const SWATCH_COLORS = Object.keys(BG_MAP);
  const SWATCH_DISPLAY = ['#ff6b6b', '#1dd1a1', '#54a0ff', '#a55eea', '#ffa502'];
  const SWATCH_LABELS  = ['Coral', 'Teal', 'Sky Blue', 'Violet', 'Amber'];

  // Detect current color key by matching bg
  let selectedKey = SWATCH_COLORS.find(k => BG_MAP[k].bg === block.bg) || SWATCH_COLORS[0];

  const popover = document.createElement('div');
  popover.className = 'block-edit-popover';
  popover.innerHTML = `
    <div class="tep-header">
      <span class="tep-title">Edit Block</span>
      <button class="tep-close">✕</button>
    </div>
    <label class="tep-label">Label
      <input class="bep-label-input" type="text" value="${escHtml(block.label)}" />
    </label>
    <div class="tep-label">Time
      <div class="bep-time-row">
        <input class="bep-start" type="time" value="${minToTime(block.startMin)}" />
        <span style="color:var(--text-muted)">–</span>
        <input class="bep-end" type="time" value="${minToTime(endMin)}" />
      </div>
    </div>
    <div class="tep-label">Color
      <div class="bep-swatches">
        ${SWATCH_COLORS.map((key, i) => `
          <div class="bep-swatch${key === selectedKey ? ' active' : ''}"
               data-key="${key}"
               style="background:${SWATCH_DISPLAY[i]}"
               title="${SWATCH_LABELS[i]}">
          </div>`).join('')}
      </div>
    </div>
    <div class="tep-actions">
      <button class="tep-cancel btn-secondary">Cancel</button>
      <button class="bep-save btn-primary">Save</button>
    </div>
  `;

  // Swatch selection
  popover.querySelectorAll('.bep-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      popover.querySelectorAll('.bep-swatch').forEach(s => s.classList.remove('active'));
      swatch.classList.add('active');
      selectedKey = swatch.dataset.key;
    });
  });

  // Save
  popover.querySelector('.bep-save').addEventListener('click', () => {
    const newLabel = popover.querySelector('.bep-label-input').value.trim() || 'Blocked';
    const newStart = timeToMin(popover.querySelector('.bep-start').value);
    const newEnd   = timeToMin(popover.querySelector('.bep-end').value);
    if (newEnd <= newStart) { showToast('Invalid', 'End must be after start', 'urgent'); return; }

    const colors = BG_MAP[selectedKey];
    block.label       = newLabel;
    block.startMin    = newStart;
    block.durationMin = newEnd - newStart;
    block.bg          = colors.bg;
    block.fg          = colors.fg;

    popover.remove();
    renderTimeline();
    debouncedSave();
  });

  // Position
  document.body.appendChild(popover);
  const cardRect = cardEl.getBoundingClientRect();
  const popW = 240;
  const spaceRight = window.innerWidth - cardRect.right;
  const left = spaceRight >= popW + 12 ? cardRect.right + 8 : cardRect.left - popW - 8;
  const top  = Math.min(cardRect.top, window.innerHeight - popover.offsetHeight - 16);
  popover.style.left = `${Math.max(8, left)}px`;
  popover.style.top  = `${Math.max(8, top)}px`;

  // Close
  const close = () => popover.remove();
  popover.querySelector('.tep-cancel').addEventListener('click', close);
  popover.querySelector('.tep-close').addEventListener('click', close);
  setTimeout(() => {
    document.addEventListener('click', function handler(e) {
      if (!popover.contains(e.target) && !cardEl.contains(e.target)) {
        popover.remove();
        document.removeEventListener('click', handler);
      }
    });
  }, 10);

  popover.querySelector('.bep-label-input').focus();
}


function onTimelineDragOver(e) {
  e.preventDefault();
  if (!dragPayload) return;

  const rect = document.getElementById('timeline-track').getBoundingClientRect();
  const y = e.clientY - rect.top;
  const snappedMin = yToMin(y);

  const preview = document.getElementById('drop-preview');
  const durationMin = 30; // default
  const previewH = (durationMin / 60) * 80;
  preview.style.top    = `${minToY(snappedMin)}px`;
  preview.style.height = `${previewH}px`;
  preview.classList.remove('hidden');
  e.dataTransfer.dropEffect = 'copy';
}

function onTimelineDragLeave(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    document.getElementById('drop-preview').classList.add('hidden');
  }
}

function onTimelineDrop(e) {
  e.preventDefault();
  document.getElementById('drop-preview').classList.add('hidden');
  if (!dragPayload || dragPayload.type !== 'task') return;

  const rect = document.getElementById('timeline-track').getBoundingClientRect();
  const y = e.clientY - rect.top;
  const snappedMin = yToMin(y);

  // Open duration modal
  pendingSchedule = { task: dragPayload.task, startMin: snappedMin };
  openDurationModal(dragPayload.task.title, snappedMin);
  dragPayload = null;
}

// ── Duration Modal ────────────────────────────────────────────────────────────
function openDurationModal(taskTitle, startMin) {
  document.getElementById('duration-task-name').textContent = taskTitle;
  document.getElementById('duration-start').value = minToTime(startMin);
  document.getElementById('duration-minutes').value = 30;
  document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.dur-btn[data-min="30"]')?.classList.add('active');
  document.getElementById('duration-modal-overlay').classList.remove('hidden');
}

function closeDurationModal() {
  document.getElementById('duration-modal-overlay').classList.add('hidden');
  pendingSchedule = null;
}

function confirmDuration() {
  if (!pendingSchedule) return;
  const startVal = document.getElementById('duration-start').value;
  const startMin = timeToMin(startVal);
  const durMin   = parseInt(document.getElementById('duration-minutes').value) || 30;
  const { task } = pendingSchedule;

  state.timelineItems.push({
    id: uid(),
    taskId: task.id,
    taskTitle: task.title,
    date: dateKey(currentDate),
    startMin,
    durationMin: durMin,
    completed: false
  });

  closeDurationModal();
  renderTimeline();
  debouncedSave();
  showToast('Scheduled', `"${task.title}" added to ${minToTime(startMin)}`, 'info');
}

// ── Block Time Modal ──────────────────────────────────────────────────────────
let selectedBlockColor = '#coral';

function openBlockModal() {
  const now = new Date();
  const roundedMin = Math.round((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
  document.getElementById('block-start').value = minToTime(roundedMin);
  document.getElementById('block-end').value   = minToTime(roundedMin + 60);
  document.getElementById('block-label').value = '';
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeBlockModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

function saveBlock() {
  const label    = document.getElementById('block-label').value.trim() || 'Blocked';
  const startMin = timeToMin(document.getElementById('block-start').value);
  const endMin   = timeToMin(document.getElementById('block-end').value);
  if (endMin <= startMin) { alert('End must be after start'); return; }

  const BG_MAP = {
    '#coral':  { bg: 'rgba(255,107,107,0.22)', fg: '#ff6b6b' },
    '#teal':   { bg: 'rgba(29,209,161,0.20)',  fg: '#1dd1a1' },
    '#sky':    { bg: 'rgba(84,160,255,0.20)',  fg: '#54a0ff' },
    '#violet': { bg: 'rgba(165,94,234,0.20)',  fg: '#a55eea' },
    '#amber':  { bg: 'rgba(255,165,2,0.20)',   fg: '#ffa502' }
  };
  const colors = BG_MAP[selectedBlockColor] || BG_MAP['#coral'];

  state.blockedTimes.push({
    id: uid(),
    label,
    date: dateKey(currentDate),
    startMin,
    durationMin: endMin - startMin,
    bg: colors.bg,
    fg: colors.fg
  });

  closeBlockModal();
  renderTimeline();
  debouncedSave();
}

// ── Time Indicator ────────────────────────────────────────────────────────────
function nowToMinutes() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function updateTimeIndicator() {
  const indicator = document.getElementById('time-indicator');
  const key = dateKey(currentDate);
  const todayKey = dateKey(new Date());

  if (key !== todayKey) {
    indicator.style.display = 'none';
    return;
  }

  indicator.style.display = 'block';
  const y = minToY(nowToMinutes());
  indicator.style.top = `${y}px`;
}

function startClock() {
  updateTimeIndicator();
  setInterval(updateTimeIndicator, 30_000);
}

// ── Alert / Timer Loop ────────────────────────────────────────────────────────
const NOTIFIED = new Set(); // prevent duplicate alerts

function startTimerLoop() {
  checkAlerts();
  setInterval(checkAlerts, 30_000);
}

function checkAlerts() {
  const key = dateKey(currentDate);
  const todayKey = dateKey(new Date());
  if (key !== todayKey) return;

  const nowMin = nowToMinutes();

  state.timelineItems
    .filter(i => i.date === todayKey && !i.completed)
    .forEach(item => {
      const startMin = item.startMin;
      const endMin   = item.startMin + item.durationMin;

      // 5 min before start
      const preStart5Key = `pre5-${item.id}`;
      if (nowMin >= startMin - 5 && nowMin < startMin - 1 && !NOTIFIED.has(preStart5Key)) {
        NOTIFIED.add(preStart5Key);
        const msg = `"${item.taskTitle}" starts in 5 minutes`;
        fireAlert(msg, '⏰ Starting Soon', 'normal');
      }

      // 1 min before start
      const preStart1Key = `pre1-${item.id}`;
      if (nowMin >= startMin - 1 && nowMin < startMin && !NOTIFIED.has(preStart1Key)) {
        NOTIFIED.add(preStart1Key);
        const msg = `"${item.taskTitle}" starts in 1 minute`;
        fireAlert(msg, '⏰ Starting Now', 'urgent');
      }

      // 5 min remaining
      const preEnd5Key = `end5-${item.id}`;
      if (nowMin >= endMin - 5 && nowMin < endMin - 1 && !NOTIFIED.has(preEnd5Key)) {
        NOTIFIED.add(preEnd5Key);
        const msg = `"${item.taskTitle}" has 5 minutes remaining`;
        fireAlert(msg, '⚡ Time Running Out', 'urgent');
      }

      // 1 min remaining
      const preEnd1Key = `end1-${item.id}`;
      if (nowMin >= endMin - 1 && nowMin < endMin && !NOTIFIED.has(preEnd1Key)) {
        NOTIFIED.add(preEnd1Key);
        const msg = `"${item.taskTitle}" has 1 minute remaining`;
        fireAlert(msg, '⚡ Almost Done', 'urgent');
      }

      // Task ended
      const doneKey = `done-${item.id}`;
      if (nowMin >= endMin && nowMin < endMin + 1 && !NOTIFIED.has(doneKey)) {
        NOTIFIED.add(doneKey);
        const msg = `"${item.taskTitle}" time block has ended`;
        fireAlert(msg, '✅ Time Block Complete', 'normal');
        renderTimeline();
      }
    });
}

function fireAlert(body, title, urgency) {
  // In-app toast
  showToast(title, body, urgency === 'urgent' ? 'urgent' : 'info');
  // System notification via main process
  try {
    window.electronAPI.showNotification({ title, body, urgency });
  } catch(e) {}
}

// ── Calendar ──────────────────────────────────────────────────────────────────
async function fetchCalendar() {
  const el = document.getElementById('calendar-events-list');
  el.innerHTML = '<span class="cal-empty">Loading…</span>';

  try {
    const result = await window.electronAPI.fetchCalendarEvents({
      year:  currentDate.getFullYear(),
      month: currentDate.getMonth() + 1,
      day:   currentDate.getDate()
    });

    if (result.error === 'not_authorized') {
      el.innerHTML = '<span class="cal-empty">Calendar access denied — go to System Settings → Privacy & Security → Calendars to allow DayFlow.</span>';
      return;
    }

    if (!result.events || result.events.length === 0) {
      el.innerHTML = '<span class="cal-empty">No calendar events today</span>';
      return;
    }

    el.innerHTML = '';
    result.events.forEach(evt => {
      const chip = document.createElement('div');
      chip.className = 'cal-event-chip';
      chip.innerHTML = `
        <span class="cal-title">${escHtml(evt.title)}</span>
        <span class="cal-time">${escHtml(evt.start)} – ${escHtml(evt.end)}</span>
      `;
      el.appendChild(chip);
    });
  } catch(e) {
    el.innerHTML = '<span class="cal-empty">Could not load calendar events.</span>';
  }
}

function formatCalTime(str) {
  if (!str) return '?';
  try {
    const d = new Date(str);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch { return str; }
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(title, body, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<div class="toast-title">${escHtml(title)}</div><div class="toast-body">${escHtml(body)}</div>`;
  container.appendChild(toast);
  setTimeout(() => toast.style.opacity = '0', 4000);
  setTimeout(() => toast.remove(), 4500);
}

// ── Drag ghost ────────────────────────────────────────────────────────────────
function updateDragGhost(label) {
  const ghost = document.getElementById('drag-ghost');
  ghost.textContent = label;
  ghost.style.display = 'block';
  document.addEventListener('dragover', moveDragGhost);
}

function moveDragGhost(e) {
  const ghost = document.getElementById('drag-ghost');
  ghost.style.left = `${e.clientX + 12}px`;
  ghost.style.top  = `${e.clientY + 12}px`;
}

function hideDragGhost() {
  const ghost = document.getElementById('drag-ghost');
  ghost.style.display = 'none';
  document.removeEventListener('dragover', moveDragGhost);
}

// ── Event Bindings ────────────────────────────────────────────────────────────
function bindEvents() {
  // Theme toggle
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // Add task
  document.getElementById('add-task-btn').addEventListener('click', () => {
    const input = document.getElementById('new-task-input');
    addTask(input.value);
    input.value = '';
  });

  document.getElementById('new-task-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      addTask(e.target.value);
      e.target.value = '';
    }
  });

  // Priority filter
  document.getElementById('priority-filter').addEventListener('change', renderTaskList);

  // Date navigation
  document.getElementById('prev-day').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1);
    renderAll();
    fetchCalendar();
  });

  document.getElementById('next-day').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 1);
    renderAll();
    fetchCalendar();
  });

  document.getElementById('today-btn').addEventListener('click', () => {
    currentDate = new Date();
    currentDate.setHours(0,0,0,0);
    renderAll();
    fetchCalendar();
  });

  // Work hours
  document.getElementById('work-start').addEventListener('change', e => {
    state.settings.workStart = e.target.value;
    applyWorkHours();
    renderTimeline();
    debouncedSave();
  });

  document.getElementById('work-end').addEventListener('change', e => {
    state.settings.workEnd = e.target.value;
    applyWorkHours();
    renderTimeline();
    debouncedSave();
  });

  document.getElementById('work-start').value = state.settings.workStart;
  document.getElementById('work-end').value   = state.settings.workEnd;

  // Sidebar tabs
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Block time modal
  document.getElementById('add-block-btn').addEventListener('click', openBlockModal);
  document.getElementById('block-cancel-btn').addEventListener('click', closeBlockModal);
  document.getElementById('block-save-btn').addEventListener('click', saveBlock);

  document.getElementById('block-color-swatches').addEventListener('click', e => {
    const swatch = e.target.closest('.swatch');
    if (!swatch) return;
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('active'));
    swatch.classList.add('active');
    selectedBlockColor = swatch.dataset.color;
  });

  // Duration modal
  document.getElementById('duration-cancel-btn').addEventListener('click', closeDurationModal);
  document.getElementById('duration-save-btn').addEventListener('click', confirmDuration);

  document.querySelectorAll('.dur-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('duration-minutes').value = btn.dataset.min;
    });
  });

  document.getElementById('duration-minutes').addEventListener('input', () => {
    document.querySelectorAll('.dur-btn').forEach(b => b.classList.remove('active'));
  });

  // Matrix drop
  document.querySelectorAll('.matrix-quadrant').forEach(q => {
    q.addEventListener('dragover', e => {
      e.preventDefault();
      q.classList.add('drag-over');
    });
    q.addEventListener('dragleave', () => q.classList.remove('drag-over'));
    q.addEventListener('drop', e => {
      q.classList.remove('drag-over');
      dropOnQuadrant(e, q.dataset.quadrant);
    });
  });

  // Refresh calendar
  document.getElementById('refresh-calendar-btn').addEventListener('click', fetchCalendar);

  // Plan Task modal
  document.getElementById('plan-cancel-btn').addEventListener('click', closePlanModal);
  document.getElementById('plan-save-btn').addEventListener('click', confirmPlan);

  document.querySelectorAll('.plan-dur-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.plan-dur-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById('plan-minutes').value = btn.dataset.min;
    });
  });

  document.getElementById('plan-minutes').addEventListener('input', () => {
    document.querySelectorAll('.plan-dur-btn').forEach(b => b.classList.remove('active'));
  });

  document.getElementById('plan-modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('plan-modal-overlay')) closePlanModal();
  });

  // Tray menu actions
  if (window.electronAPI.onTrayAction) {
    window.electronAPI.onTrayAction(action => {
      if (action === 'add-task') {
        const input = document.getElementById('new-task-input');
        input?.focus();
      }
      if (action === 'plan-task') {
        openPlanModal();
      }
      if (action === 'show-today') {
        currentDate = new Date();
        currentDate.setHours(0, 0, 0, 0);
        renderAll();
        fetchCalendar();
      }
    });
  }

  // Day theme selector
  document.getElementById('day-theme-select').addEventListener('change', e => {
    const meta = getDayMeta();
    meta.theme = e.target.value;
    applyDayTheme(meta.theme);
    debouncedSave();
  });

  // Day objectives
  document.querySelectorAll('.obj-input').forEach(input => {
    input.addEventListener('input', () => {
      const meta = getDayMeta();
      if (!meta.objectives) meta.objectives = ['', '', ''];
      meta.objectives[parseInt(input.dataset.idx)] = input.value;
      debouncedSave();
    });
  });

  // Scroll timeline to work start
  setTimeout(() => {
    const scroll = document.getElementById('timeline-scroll');
    if (scroll) scroll.scrollTop = 0;
  }, 100);
}

// ── Plan Task Modal ───────────────────────────────────────────────────────────

function openPlanModal() {
  // Populate task select with incomplete tasks
  const sel = document.getElementById('plan-task-select');
  sel.innerHTML = '<option value="">— choose a task —</option>';
  state.tasks
    .filter(t => !t.completed)
    .forEach(t => {
      const opt = document.createElement('option');
      opt.value = t.id;
      opt.textContent = t.title;
      sel.appendChild(opt);
    });

  // Default start time: next rounded 30-min slot
  const now = new Date();
  const roundedMin = Math.ceil((now.getHours() * 60 + now.getMinutes()) / 30) * 30;
  document.getElementById('plan-start').value = minToTime(roundedMin);
  document.getElementById('plan-minutes').value = 30;
  document.querySelectorAll('.plan-dur-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.plan-dur-btn[data-min="30"]')?.classList.add('active');

  document.getElementById('plan-modal-overlay').classList.remove('hidden');
  sel.focus();
}

function closePlanModal() {
  document.getElementById('plan-modal-overlay').classList.add('hidden');
}

function confirmPlan() {
  const taskId = document.getElementById('plan-task-select').value;
  if (!taskId) { showToast('No task selected', 'Please choose a task to plan.', 'urgent'); return; }

  const task = state.tasks.find(t => t.id === taskId);
  if (!task) return;

  const startMin = timeToMin(document.getElementById('plan-start').value);
  const durMin   = parseInt(document.getElementById('plan-minutes').value) || 30;

  state.timelineItems.push({
    id: uid(),
    taskId: task.id,
    taskTitle: task.title,
    date: dateKey(currentDate),
    startMin,
    durationMin: durMin,
    completed: false
  });

  closePlanModal();
  renderTimeline();
  renderTaskList();
  debouncedSave();
  showToast('Planned', `"${task.title}" → ${minToTime(startMin)}`, 'info');
}

// ── Utilities ─────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ── Public surface (for inline handlers) ─────────────────────────────────────
return {
  init,
  onTimelineDragOver,
  onTimelineDragLeave,
  onTimelineDrop,
  dropOnQuadrant,
  toggleTheme
};

})();

window.addEventListener('DOMContentLoaded', () => app.init());
