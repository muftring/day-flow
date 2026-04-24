/* ─────────────────────────────────────────────────────────────────────────────
   DayFlow — main renderer application
   ───────────────────────────────────────────────────────────────────────────── */

'use strict';

const app = (() => {

// ── State ─────────────────────────────────────────────────────────────────────
let state = {
  tasks: [],          // { id, title, completed, priority, createdAt }
  timelineItems: [],  // { id, taskId, taskTitle, date, startMin, durationMin, color, completed }
  blockedTimes: [],   // { id, label, date, startMin, durationMin, bg, fg }
  settings: { workStart: '08:00', workEnd: '18:00' }
};

let currentDate = new Date();
currentDate.setHours(0,0,0,0);

let dragPayload = null;  // { type: 'task'|'timeline', data }
let pendingSchedule = null; // task waiting for duration modal

const QUADRANT_COLORS = {
  do:        { bg: '#3d1515', border: '#e05a5a', text: '#f4b8b8' },
  schedule:  { bg: '#3d2e0a', border: '#d4a843', text: '#f5d98a' },
  delegate:  { bg: '#0a2035', border: '#5aaee0', text: '#a8d4f5' },
  eliminate: { bg: '#1a1a2a', border: '#7a7a9a', text: '#c0c0d8' },
  none:      { bg: '#1e1e2e', border: '#3a3a5a', text: '#c0c0d8' }
};

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  await loadData();
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
      settings: state.settings
    });
  } catch(e) { console.warn('Save failed', e); }
}

function debounce(fn, ms) {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
const debouncedSave = debounce(saveData, 600);

// ── Render All ────────────────────────────────────────────────────────────────
function renderAll() {
  renderDateHeader();
  renderTaskList();
  renderMatrix();
  renderTimeline();
  applyWorkHours();
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

  const visible = state.tasks.filter(t =>
    !t.completed &&
    (filter === 'all' || t.priority === filter || (filter === 'none' && !t.priority))
  );

  visible.forEach(task => {
    const li = document.createElement('li');
    li.className = 'task-item' + (task.completed ? ' completed' : '');
    li.draggable = true;
    li.dataset.id = task.id;

    const badge = task.priority ?
      `<span class="task-priority-badge badge-${task.priority}">${shortLabel(task.priority)}</span>` : '';

    li.innerHTML = `
      <button class="task-complete-btn" title="Mark complete">${task.completed ? '✓' : ''}</button>
      <span class="task-title">${escHtml(task.title)}</span>
      ${badge}
      <div class="task-actions">
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

    // Action buttons
    li.querySelectorAll('.task-action-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (btn.dataset.action === 'delete') deleteTask(task.id);
        if (btn.dataset.action === 'priority') showPriorityMenu(task.id, btn);
      });
    });

    ul.appendChild(li);
  });

  // Completed section
  const done = state.tasks.filter(t => t.completed);
  if (done.length && filter === 'all') {
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

// ── Matrix ────────────────────────────────────────────────────────────────────
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

  // Blocked items
  todayBlocked.forEach(block => {
    const top    = minToY(block.startMin);
    const height = Math.max((block.durationMin / 60) * unit, 20);

    const el = document.createElement('div');
    el.className = 'timeline-block';
    el.style.cssText = `top:${top}px; height:${height}px; background:${block.bg||'#2a2a3a'}; color:${block.fg||'#a0a0c0'};`;

    el.innerHTML = `
      <span class="block-label-text">${escHtml(block.label)}</span>
      <button class="block-remove-btn" title="Remove">✕</button>
    `;
    el.querySelector('.block-remove-btn').addEventListener('click', () => {
      removeBlock(block.id);
    });
    container.appendChild(el);
  });

  // Task items
  const nowMin = nowToMinutes();
  todayTItems.forEach(item => {
    const top    = minToY(item.startMin);
    const height = Math.max((item.durationMin / 60) * unit, 28);
    const colors = QUADRANT_COLORS[getTaskPriority(item.taskId)] || QUADRANT_COLORS.none;

    const isActive = nowMin >= item.startMin && nowMin < item.startMin + item.durationMin;
    const isPast   = nowMin >= item.startMin + item.durationMin;

    const el = document.createElement('div');
    el.className = 'timeline-card' + (item.completed ? ' completed' : '') + (isActive ? ' active-now' : '');
    el.style.cssText = `top:${top}px; height:${height}px; background:${colors.bg}; border-color:${colors.border};`;
    el.dataset.id = item.id;

    const endMin = item.startMin + item.durationMin;
    el.innerHTML = `
      <span class="tc-title">${escHtml(item.taskTitle)}</span>
      <span class="tc-time">${minToTime(item.startMin)} – ${minToTime(endMin)}</span>
      <div class="tc-actions">
        <button class="tc-btn" data-action="complete" title="${item.completed?'Unmark':'Mark complete'}">${item.completed?'↺':'✓'}</button>
        <button class="tc-btn" data-action="remove" title="Remove from timeline">✕</button>
      </div>
    `;

    el.querySelectorAll('.tc-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (btn.dataset.action === 'complete') toggleTimelineComplete(item.id);
        if (btn.dataset.action === 'remove')   removeTimelineItem(item.id);
      });
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

// ── Timeline Drag & Drop ──────────────────────────────────────────────────────
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
let selectedBlockColor = '#3d2b1f';

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
    '#3d2b1f': { bg: 'rgba(61,43,31,0.85)', fg: '#c8a060' },
    '#1f2d1f': { bg: 'rgba(31,45,31,0.85)', fg: '#70b878' },
    '#1a1f3d': { bg: 'rgba(26,31,61,0.85)', fg: '#7890d4' },
    '#2d1f3d': { bg: 'rgba(45,31,61,0.85)', fg: '#a870c8' },
    '#2d2018': { bg: 'rgba(45,32,24,0.85)', fg: '#d4904a' }
  };
  const colors = BG_MAP[selectedBlockColor] || BG_MAP['#3d2b1f'];

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

      // 1 min before start
      const preStartKey = `pre-${item.id}`;
      if (nowMin >= startMin - 1 && nowMin < startMin && !NOTIFIED.has(preStartKey)) {
        NOTIFIED.add(preStartKey);
        const msg = `"${item.taskTitle}" starts in 1 minute`;
        fireAlert(msg, '⏰ Starting Soon', 'normal');
      }

      // 5 min remaining
      const preEndKey = `end5-${item.id}`;
      if (nowMin >= endMin - 5 && nowMin < endMin && !NOTIFIED.has(preEndKey)) {
        NOTIFIED.add(preEndKey);
        const msg = `"${item.taskTitle}" has 5 minutes remaining`;
        fireAlert(msg, '⚡ Time Running Out', 'urgent');
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
    const dateStr = currentDate.toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric'
    });
    const events = await window.electronAPI.fetchCalendarEvents(dateStr);

    if (!events || events.length === 0) {
      el.innerHTML = '<span class="cal-empty">No calendar events today</span>';
      return;
    }

    el.innerHTML = '';
    events.forEach(evt => {
      const chip = document.createElement('div');
      chip.className = 'cal-event-chip';
      chip.innerHTML = `
        <span class="cal-title">${escHtml(evt.title)}</span>
        <span class="cal-time">${formatCalTime(evt.start)} – ${formatCalTime(evt.end)}</span>
      `;
      el.appendChild(chip);
    });
  } catch(e) {
    el.innerHTML = '<span class="cal-empty">Calendar access not available. Grant permission in System Settings → Privacy → Calendars.</span>';
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

  // Scroll timeline to work start
  setTimeout(() => {
    const scroll = document.getElementById('timeline-scroll');
    if (scroll) scroll.scrollTop = 0;
  }, 100);
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
  dropOnQuadrant
};

})();

window.addEventListener('DOMContentLoaded', () => app.init());
