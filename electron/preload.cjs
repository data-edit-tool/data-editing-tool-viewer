const { contextBridge, ipcRenderer } = require('electron');

const getSpeakerImageDiagnostics = () =>
  [...document.querySelectorAll('.speaker-info-left img, .speaker-box > ul > li > img')].map((image) => {
    const src = image.currentSrc || image.src || '';
    return {
      speaker: image.alt,
      complete: image.complete,
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      srcType: src.startsWith('data:image/')
        ? src.split(';')[0]
        : src.startsWith('blob:')
          ? 'blob'
          : src.startsWith('file:')
            ? 'file'
            : src.split(':')[0],
      srcPreview: src.slice(0, 180),
    };
  });

contextBridge.exposeInMainWorld('labelingViewer', {
  platform: process.platform,
  getSpeakerImageDiagnostics,
  importProject: () => ipcRenderer.invoke('viewer:import-project'),
  onOpenProject: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('viewer:open-project', listener);
    return () => ipcRenderer.removeListener('viewer:open-project', listener);
  },
});
