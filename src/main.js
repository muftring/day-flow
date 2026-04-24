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

ipcMain.handle('fetch-calendar-events', async (_, { year, month, day }) => {
  if (process.platform !== 'darwin') return { events: [], error: null };

  const { exec } = require('child_process');
  const { promisify } = require('util');
  const execAsync = promisify(exec);

  // Build AppleScript using numeric date components to avoid locale issues
  const script = `
tell application "Calendar"
  set dayStart to current date
  set year of dayStart to ${year}
  set month of dayStart to ${month}
  set day of dayStart to ${day}
  set hours of dayStart to 0
  set minutes of dayStart to 0
  set seconds of dayStart to 0
  set dayEnd to dayStart + (86399)
  set output to ""
  repeat with aCal in calendars
    try
      set evts to (every event of aCal whose start date >= dayStart and start date <= dayEnd)
      repeat with e in evts
        set eTitle to summary of e
        set eStart to start date of e
        set eEnd to end date of e
        set eStartStr to (hours of eStart as string) & ":" & text -2 thru -1 of ("0" & (minutes of eStart as string))
        set eEndStr to (hours of eEnd as string) & ":" & text -2 thru -1 of ("0" & (minutes of eEnd as string))
        set output to output & eTitle & "|||" & eStartStr & "|||" & eEndStr & "\\n"
      end repeat
    end try
  end repeat
  return output
end tell`;

  try {
    const { stdout, stderr } = await execAsync(`osascript << 'APPLESCRIPT'\n${script}\nAPPLESCRIPT`, {
      timeout: 10000
    });

    if (stderr && stderr.includes('not authorized')) {
      return { events: [], error: 'not_authorized' };
    }

    const events = stdout.trim().split('\n')
      .filter(l => l.includes('|||'))
      .map(line => {
        const [title, start, end] = line.split('|||');
        return { title: title?.trim(), start: start?.trim(), end: end?.trim() };
      })
      .filter(e => e.title);

    return { events, error: null };
  } catch (e) {
    console.warn('Calendar access failed:', e.message);
    const errMsg = e.message || '';
    if (errMsg.includes('not authorized') || errMsg.includes('1743')) {
      return { events: [], error: 'not_authorized' };
    }
    return { events: [], error: 'failed' };
  }
});
