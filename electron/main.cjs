const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, Menu, dialog, ipcMain, shell } = require('electron');

const isDev = !app.isPackaged;

const getMainWindow = () => BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];

const requestOpenProject = () => {
  const mainWindow = getMainWindow();
  if (!mainWindow) {
    return;
  }
  mainWindow.webContents.send('viewer:open-project');
};

const toWebRelativePath = (rootPath, filePath) => {
  const rootName = path.basename(rootPath);
  const relativePath = path.relative(rootPath, filePath).split(path.sep).join('/');
  return `${rootName}/${relativePath}`;
};

const isHiddenOrSystemEntry = (entryName) => entryName === 'Thumbs.db' || entryName.startsWith('.');

const collectImportFiles = async (currentPath, rootPath = currentPath) => {
  const entries = await fs.readdir(currentPath, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      if (isHiddenOrSystemEntry(entry.name)) {
        return [];
      }
      const entryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        return collectImportFiles(entryPath, rootPath);
      }
      if (!entry.isFile()) {
        return [];
      }
      const webkitRelativePath = toWebRelativePath(rootPath, entryPath);
      const file = {
        name: entry.name,
        path: entryPath,
        webkitRelativePath,
        fileUrl: pathToFileURL(entryPath).href,
      };
      if (entry.name.toLowerCase().endsWith('.json')) {
        return [{ ...file, textContent: await fs.readFile(entryPath, 'utf8') }];
      }
      return [file];
    }),
  );
  return files.flat();
};

const importProjectFromDialog = async () => {
  const mainWindow = getMainWindow();
  if (!mainWindow) {
    return [];
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled || !result.filePaths[0]) {
    return [];
  }
  return collectImportFiles(result.filePaths[0]);
};

ipcMain.handle('viewer:import-project', importProjectFromDialog);

const createApplicationMenu = () => {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Import',
          accelerator: 'CommandOrControl+O',
          click: requestOpenProject,
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Full Screen',
          role: 'togglefullscreen',
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
};

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    backgroundColor: '#05070b',
    title: 'Labeling tool',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    const devServerUrl = process.env.VITE_DEV_SERVER_URL || 'http://127.0.0.1:3000';
    mainWindow.loadURL(devServerUrl);
    return;
  }

  mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
};

app.whenReady().then(() => {
  createApplicationMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
