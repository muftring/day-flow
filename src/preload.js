const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  loadData: () => ipcRenderer.invoke('load-data'),
  saveData: (data) => ipcRenderer.invoke('save-data', data),
  showNotification: (opts) => ipcRenderer.send('show-notification', opts),
  fetchCalendarEvents: (dateStr) => ipcRenderer.invoke('fetch-calendar-events', dateStr)
});
