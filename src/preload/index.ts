import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Api } from '@shared/api'

// Die Brücke zwischen Fenster und Hintergrundprozess. Nur diese Funktionen
// kann das Fenster aufrufen, alles andere bleibt im Hintergrund.
const api: Api = {
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    anmelden: (email, passwort) => ipcRenderer.invoke('auth:anmelden', email, passwort),
    abmelden: () => ipcRenderer.invoke('auth:abmelden')
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (fehler) {
    console.error(fehler)
  }
} else {
  // @ts-ignore Nur ohne Kontext-Isolierung, kommt in dieser App nicht vor.
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
