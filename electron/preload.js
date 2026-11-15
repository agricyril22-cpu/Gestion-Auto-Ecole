// Pont sécurisé entre l'application et le système (état de licence, mot de passe d'installation)
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('AE_DESKTOP', {
  get: () => ipcRenderer.sendSync('ae-store-get'),
  set: data => ipcRenderer.sendSync('ae-store-set', data),
  install: () => ipcRenderer.sendSync('ae-install-cfg')
});
