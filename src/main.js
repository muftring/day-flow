const { app, BrowserWindow, ipcMain, Notification, nativeTheme, Tray, Menu, nativeImage, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// Data persistence path
const dataPath = path.join(app.getPath('userData'), 'dayflow-data.json');

let mainWindow;
let tray;

// ── Window ─────────────────────────────────────────────────────────────────────

function createWindow() {
  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const iconExists = fs.existsSync(iconPath);

  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Day Flow',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: '#0f0f13',
    icon: iconExists ? iconPath : undefined,
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
    if (iconExists && process.platform === 'darwin') {
      app.dock.setIcon(nativeImage.createFromPath(iconPath));
    }
  });

  // Keep title in sync (renderer shouldn't override it)
  mainWindow.on('page-title-updated', e => e.preventDefault());
}

// ── Tray ───────────────────────────────────────────────────────────────────────

function createTray() {
  const trayIconPath = path.join(__dirname, '..', 'assets', 'tray-icon.png');
  let trayImage;

  if (fs.existsSync(trayIconPath)) {
    trayImage = nativeImage.createFromPath(trayIconPath);
    trayImage = trayImage.resize({ width: 22, height: 22 });
    trayImage.setTemplateImage(true);
  } else {
    // Minimal 1×1 fallback so Tray doesn't crash
    trayImage = nativeImage.createEmpty();
  }

  tray = new Tray(trayImage);
  tray.setToolTip('Day Flow');
  tray.setContextMenu(buildTrayMenu());

  // Rebuild menu when clicked so task list stays current
  tray.on('click', () => {
    tray.setContextMenu(buildTrayMenu());
    tray.popUpContextMenu();
  });
}

function buildTrayMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Add Task…',
      accelerator: 'CmdOrCtrl+N',
      click: () => {
        showOrFocus();
        mainWindow.webContents.send('tray-action', 'add-task');
      }
    },
    {
      label: 'Plan Task…',
      accelerator: 'CmdOrCtrl+P',
      click: () => {
        showOrFocus();
        mainWindow.webContents.send('tray-action', 'plan-task');
      }
    },
    {
      label: 'Show Today',
      accelerator: 'CmdOrCtrl+T',
      click: () => {
        showOrFocus();
        mainWindow.webContents.send('tray-action', 'show-today');
      }
    },
    { type: 'separator' },
    {
      label: 'About Day Flow…',
      click: () => showAboutDialog()
    },
    { type: 'separator' },
    {
      label: 'Quit Day Flow',
      accelerator: 'CmdOrCtrl+Q',
      click: () => app.quit()
    }
  ]);
}

function showOrFocus() {
  if (!mainWindow) {
    createWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function showAboutDialog() {
  showOrFocus();

  const iconPath = path.join(__dirname, '..', 'assets', 'icon.png');
  const options = {
    type: 'none',
    title: 'About Day Flow',
    message: 'Day Flow',
    detail: [
      `Version ${app.getVersion()}`,
      '',
      'A daily task and timeline manager.',
      'Plan your day with clarity and focus.',
      '',
      `© ${new Date().getFullYear()} Day Flow`
    ].join('\n'),
    buttons: ['OK'],
    defaultId: 0
  };

  if (fs.existsSync(iconPath)) {
    options.icon = nativeImage.createFromPath(iconPath).resize({ width: 64, height: 64 });
  }

  dialog.showMessageBox(mainWindow, options);
}

// ── App lifecycle ──────────────────────────────────────────────────────────────

app.setName('Day Flow');

app.whenReady().then(() => {
  createWindow();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else showOrFocus();
  });
});

app.on('window-all-closed', () => {
  // On macOS keep running in tray when all windows are closed
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (tray) tray.destroy();
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
