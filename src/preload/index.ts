import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type { Api } from '@shared/api'
import type { Auszeichnung, ErfassungsStatus, UpdateStatus } from '@shared/typen'

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
  fokus: {
    starten: (taetigkeit, beginn, kunde) => ipcRenderer.invoke('fokus:starten', taetigkeit, beginn, kunde ?? null),
    beenden: () => ipcRenderer.invoke('fokus:beenden')
  },
  kunden: {
    liste: () => ipcRenderer.invoke('kunden:liste'),
    umbenennen: (alt, neu) => ipcRenderer.invoke('kunden:umbenennen', alt, neu),
    loeschen: (name) => ipcRenderer.invoke('kunden:loeschen', name)
  },
  weg: {
    starten: (taetigkeit, beginn, kunde) => ipcRenderer.invoke('weg:starten', taetigkeit, beginn, kunde ?? null),
    beenden: () => ipcRenderer.invoke('weg:beenden')
  },
  abwesenheit: {
    zuordnen: (id, taetigkeit, notiz) => ipcRenderer.invoke('abwesenheit:zuordnen', id, taetigkeit, notiz),
    pause: (id) => ipcRenderer.invoke('abwesenheit:pause', id),
    privat: (id) => ipcRenderer.invoke('abwesenheit:privat', id),
    spaeter: (id) => ipcRenderer.invoke('abwesenheit:spaeter', id)
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
    autostartSetzen: (an) => ipcRenderer.invoke('system:autostartSetzen', an),
    bildschirmrechtAnfragen: () => ipcRenderer.invoke('system:bildschirmrechtAnfragen'),
    diagnose: () => ipcRenderer.invoke('system:diagnose')
  },
  update: {
    status: () => ipcRenderer.invoke('update:status'),
    pruefen: () => ipcRenderer.invoke('update:pruefen'),
    installieren: () => ipcRenderer.invoke('update:installieren'),
    onStatus: (rueckruf) => {
      const handler = (_e: IpcRendererEvent, status: UpdateStatus): void => rueckruf(status)
      ipcRenderer.on('update:status', handler)
      return () => ipcRenderer.removeListener('update:status', handler)
    }
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
  liga: {
    stand: () => ipcRenderer.invoke('liga:stand')
  },
  urlaub: {
    eigene: () => ipcRenderer.invoke('urlaub:eigene'),
    alle: () => ipcRenderer.invoke('urlaub:alle'),
    anlegen: (von, bis, notiz) => ipcRenderer.invoke('urlaub:anlegen', von, bis, notiz),
    loeschen: (id) => ipcRenderer.invoke('urlaub:loeschen', id)
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
