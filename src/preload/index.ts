import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Hier kommen ab Schritt 3 die Brücken zwischen Fenster und Hintergrundprozess hinein.
const api = {}

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
