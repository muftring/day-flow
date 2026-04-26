# DayFlow

A polished macOS desktop app for managing your daily tasks and timeline, built with Electron.

![DayFlow — Dark, focused productivity]

---

## Features

- **Drag-and-drop** tasks from the task library directly onto the day's timeline
- **Configurable time blocks** — specify duration when scheduling a task
- **Blocked time** — block out breaks, lunch, meetings with custom labels and colors
- **Smart alerts** — system notifications + in-app toasts for:
  - 1 minute before a task starts
  - 5 minutes before a task ends
  - When a task time block concludes
- **Eisenhower Matrix** — organize tasks by urgency/importance across 4 quadrants (Q1–Q4)
- **Calendar integration** — reads your macOS Calendar events for the selected day
- **Mark tasks complete** — from the task list or directly on the timeline
- **Date navigation** — browse any day forward and backward
- **Persistent storage** — all data saved locally to `~/Library/Application Support/dayflow/`

---

## Quick Start

### Prerequisites

- macOS 11+
- Node.js 18+ ([download](https://nodejs.org))

### Install & Run

```bash
# 1. Clone / unzip this project, then:
cd dayflow

# 2. Install dependencies
npm install

# 3. Start the app
npm start
```

### Build a distributable .app

```bash
npm run build
# Output: dist/DayFlow-1.0.0.dmg
```

---

## Calendar Access

DayFlow reads your macOS Calendar on launch. On first run, macOS will ask for permission — click **OK** to grant access.

If you need to grant it later:
> **System Settings → Privacy & Security → Calendars → DayFlow → Enable**

---

## Usage Guide

### Adding Tasks

Type in the **sidebar input** and press Enter (or click **+**). Tasks appear in the task library.

### Prioritizing (Eisenhower Matrix)

- Click the **◈** icon on any task to assign Q1–Q4
- Switch to the **Matrix** tab to see tasks organized visually
- Drag tasks between quadrants to reclassify

| Quadrant | Meaning |
|---|---|
| Q1 — Do First | Urgent + Important |
| Q2 — Schedule | Not Urgent + Important |
| Q3 — Delegate | Urgent + Not Important |
| Q4 — Eliminate | Not Urgent + Not Important |

### Scheduling on the Timeline

1. Drag any task from the sidebar to the timeline
2. A **Schedule Task** dialog opens — set start time and duration
3. Click **Add to Timeline**

### Blocking Time

Click **+ Block Time** in the header → set label, start/end, pick a color → **Block**.

### Alerts

Alerts fire automatically via macOS Notification Center and as in-app toasts:
- **⏰ 1 min before** task start
- **⚡ 5 min before** task ends  
- **✅ When** task time block ends

Make sure **Notifications → DayFlow** is allowed in System Settings.

### Marking Complete

- Click the circle button on any task in the list
- Click **✓** on any timeline card
- Completing a task syncs across the list and timeline

---

## Project Structure

```
dayflow/
├── package.json
└── src/
    ├── main.js          # Electron main process (window, IPC, notifications, calendar)
    ├── preload.js       # Secure context bridge
    └── renderer/
        ├── index.html   # App shell
        ├── styles.css   # All styles (dark, DM Serif / DM Mono aesthetic)
        └── app.js       # All UI logic (tasks, timeline, drag-drop, timers)
```

---

## Data

All data is stored as JSON at:
```
~/Library/Application Support/dayflow/dayflow-data.json
```

You can back this file up or sync it with any tool you like.

---

## License

MIT — build freely.

---

*This app was written using [Claude.ai](https://claude.ai).*
