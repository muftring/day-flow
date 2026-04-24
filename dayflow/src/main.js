const { app, BrowserWindow, ipcMain, Notification, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');

// Data persistence path
const dataPath = path.join(app.getPath('userData'), 'dayflow-data.json');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0f0f13',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    show: false
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools in development
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ── Data persistence ──────────────────────────────────────────────────────────

function loadData() {
  try {
    if (fs.existsSync(dataPath)) {
      return JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  return { tasks: [], timelineItems: [], blockedTimes: [] };
}

function saveData(data) {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save data:', e);
  }
}

ipcMain.handle('load-data', () => loadData());
ipcMain.handle('save-data', (_, data) => { saveData(data); return true; });

// ── Notifications ─────────────────────────────────────────────────────────────

ipcMain.on('show-notification', (_, { title, body, urgency }) => {
  if (Notification.isSupported()) {
    const n = new Notification({
      title,
      body,
      silent: false,
      urgency: urgency || 'normal'
    });
    n.show();
    n.on('click', () => mainWindow?.focus());
  }
});

// ── Calendar (macOS EventKit via AppleScript) ─────────────────────────────────

ipcMain.handle('fetch-calendar-events', async (_, dateStr) => {
  if (process.platform !== 'darwin') return [];
  
  const { execFile } = require('child_process');
  const { promisify } = require('util');
  const execFileAsync = promisify(execFile);

  const script = `
    set targetDate to date "${dateStr}"
    set startOfDay to targetDate
    set startOfDay to startOfDay - (time of startOfDay)
    set endOfDay to startOfDay + (24 * 60 * 60 - 1)
    
    set eventList to {}
    tell application "Calendar"
      repeat with cal in calendars
        set calEvents to (every event of cal whose start date >= startOfDay and start date <= endOfDay)
        repeat with evt in calEvents
          set evtStart to start date of evt as string
          set evtEnd to end date of evt as string
          set evtTitle to summary of evt
          set end of eventList to evtTitle & "|||" & evtStart & "|||" & evtEnd
        end repeat
      end repeat
    end tell
    return eventList
  `;

  try {
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 5000 });
    const lines = stdout.trim().split(', ');
    return lines
      .filter(l => l.includes('|||'))
      .map(line => {
        const parts = line.split('|||');
        return { title: parts[0], start: parts[1], end: parts[2] };
      });
  } catch (e) {
    console.warn('Calendar access failed:', e.message);
    return [];
  }
});
