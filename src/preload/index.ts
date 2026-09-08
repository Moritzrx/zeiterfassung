import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Api } from '@shared/api'
import type { Auszeichnung, ErfassungsStatus } from '@shared/typen'

// Die Brücke zwischen Fenster und Hintergrundprozess. Nur diese Funktionen
// kann das Fenster aufrufen, alles andere bleibt im Hintergrund.
const api: Api = {
  auth: {
    status: () => ipcRenderer.invoke('auth:status'),
    anmelden: (email, passwort) => ipcRenderer.invoke('auth:anmelden', email, passwort),
    abmelden: () => ipcRenderer.invoke('auth:abmelden')
  },
  erfassung: {
    status: () => ipcRenderer.invoke('erfassung:status'),
    pause: () => ipcRenderer.invoke('erfassung:pause'),
    fortsetzen: () => ipcRenderer.invoke('erfassung:fortsetzen'),
    onStatus: (rueckruf) => {
      const handler = (_e: IpcRendererEvent, status: ErfassungsStatus): void => rueckruf(status)
      ipcRenderer.on('erfassung:status', handler)
      return () => ipcRenderer.removeListener('erfassung:status', handler)
    }
  },
  bloecke: {
    tag: (datum) => ipcRenderer.invoke('bloecke:tag', datum),
    zeitraum: (von, bis) => ipcRenderer.invoke('bloecke:zeitraum', von, bis),
    tagesSummen: (vonDatum, bisDatum) => ipcRenderer.invoke('bloecke:tagesSummen', vonDatum, bisDatum),
    manuellAnlegen: (eintrag) => ipcRenderer.invoke('bloecke:manuellAnlegen', eintrag),
    manuelleListe: (maximal) => ipcRenderer.invoke('bloecke:manuelleListe', maximal),
    ungeklaert: () => ipcRenderer.invoke('bloecke:ungeklaert'),
    ungeklaerteListe: () => ipcRenderer.invoke('bloecke:ungeklaerteListe'),
    aendern: (id, aenderung) => ipcRenderer.invoke('bloecke:aendern', id, aenderung),
    mehrereAendern: (ids, aenderung) => ipcRenderer.invoke('bloecke:mehrereAendern', ids, aenderung),
    onAenderung: (rueckruf) => {
      const handler = (): void => rueckruf()
      ipcRenderer.on('bloecke:aenderung', handler)
      return () => ipcRenderer.removeListener('bloecke:aenderung', handler)
    }
  },
  regeln: {
    liste: () => ipcRenderer.invoke('regeln:liste'),
    anlegen: (neu) => ipcRenderer.invoke('regeln:anlegen', neu),
    aendern: (id, aenderung) => ipcRenderer.invoke('regeln:aendern', id, aenderung),
    loeschen: (id) => ipcRenderer.invoke('regeln:loeschen', id)
  },
  taetigkeiten: {
    liste: () => ipcRenderer.invoke('taetigkeiten:liste'),
    symbole: () => ipcRenderer.invoke('taetigkeiten:symbole'),
    symbolSetzen: (name, symbol) => ipcRenderer.invoke('taetigkeiten:symbolSetzen', name, symbol)
  },
  ziele: {
    eigene: () => ipcRenderer.invoke('ziele:eigene'),
    alle: () => ipcRenderer.invoke('ziele:alle'),
    setzen: (taetigkeit, stunden) => ipcRenderer.invoke('ziele:setzen', taetigkeit, stunden),
    loeschen: (id) => ipcRenderer.invoke('ziele:loeschen', id)
  },
  system: {
    info: () => ipcRenderer.invoke('system:info'),
    autostartSetzen: (an) => ipcRenderer.invoke('system:autostartSetzen', an)
  },
  auszeichnungen: {
    liste: () => ipcRenderer.invoke('auszeichnungen:liste'),
    onNeu: (rueckruf) => {
      const handler = (_e: IpcRendererEvent, neue: Auszeichnung[]): void => rueckruf(neue)
      ipcRenderer.on('auszeichnungen:neu', handler)
      return () => ipcRenderer.removeListener('auszeichnungen:neu', handler)
    }
  },
  rang: {
    gefeiert: (rang) => ipcRenderer.invoke('rang:gefeiert', rang)
  },
  team: {
    stand: () => ipcRenderer.invoke('team:stand'),
    wochen: (vonDatum, bisDatum) => ipcRenderer.invoke('team:wochen', vonDatum, bisDatum)
  },
  profil: {
    eigenes: () => ipcRenderer.invoke('profil:eigenes'),
    aendern: (aenderung) => ipcRenderer.invoke('profil:aendern', aenderung)
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
