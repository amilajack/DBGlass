import { app, Menu, shell, ipcMain } from 'electron';
import WindowManager from './WindowManager';

const openSshTunnel = require('open-ssh-tunnel');
const readFileSync = require('fs').readFileSync;

const windowManager = new WindowManager();

let menu;
let template;
let sshServer = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support'); // eslint-disable-line
  sourceMapSupport.install();
}

if (process.env.NODE_ENV === 'development') {
  require('electron-debug')(); // eslint-disable-line global-require
  const path = require('path'); // eslint-disable-line
  const p = path.join(__dirname, '..', 'app', 'node_modules'); // eslint-disable-line
  require('module').globalPaths.push(p); // eslint-disable-line
}

process.on('uncaughtException', () => {
  console.log('caught from process'); // eslint-disable-line no-console
});


app.on('window-all-closed', () => {
  if (sshServer) {
    sshServer.close();
  }
  if (process.platform !== 'darwin') app.quit();
});


const installExtensions = async () => {
  if (process.env.NODE_ENV === 'development') {
    const installer = require('electron-devtools-installer'); // eslint-disable-line global-require

    const extensions = [
      'REACT_DEVELOPER_TOOLS',
      'REDUX_DEVTOOLS'
    ];
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    for (const name of extensions) { // eslint-disable-line
      try {
        await installer.default(installer[name], forceDownload);
      } catch (e) {} // eslint-disable-line
    }
  }
};

ipcMain.on('ssh-connect', (event, params) => {
  if (sshServer) {
    sshServer.close();
  }
  const opts = {
    host: params.sshServer,
    port: params.sshPort,
    username: params.sshUser,
    dstPort: params.port,
    srcPort: 5433,
    srcAddr: '127.0.0.1',
    dstAddr: params.address,
    readyTimeout: 5000,
    forwardTimeout: 2000,
    localPort: 5433,
    localAddr: '127.0.0.1'
  };

  if (params.sshAuthType === 'key') {
    opts.privateKey = readFileSync(params.privateKey);
    if (params.passphrase) {
      opts.passphrase = params.passphrase;
    }
  } else {
    opts.password = params.sshPassword;
  }
  openSshTunnel(opts).then((server) => {
    sshServer = server;
    event.sender.send('ssh-connect', true);
  }).catch((err) => {
    event.sender.send('ssh-connect', false, `SSH ${err.level} error`);
  });
});


app.on('activate', () => {
  if (windowManager.isEmpty()) {
    windowManager.createWindow();
  }
});


app.on('ready', async () => {
  await installExtensions();

  const mainWindow = windowManager.createWindow();

  if (process.env.NODE_ENV === 'development') {
    mainWindow.openDevTools();
    mainWindow.webContents.on('context-menu', (e, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([{
        label: 'Inspect element',
        click() {
          mainWindow.inspectElement(x, y);
        }
      }]).popup(mainWindow);
    });
  }

  if (process.platform === 'darwin') {
    template = [{
      label: 'DBGlass',
      submenu: [{
        label: 'About DBGlass',
        selector: 'orderFrontStandardAboutPanel:'
      }, {
        type: 'separator'
      }, {
        label: 'Hide DBGlass',
        accelerator: 'Command+H',
        selector: 'hide:'
      }, {
        label: 'Hide Others',
        accelerator: 'Command+Shift+H',
        selector: 'hideOtherApplications:'
      }, {
        label: 'Show All',
        selector: 'unhideAllApplications:'
      }, {
        type: 'separator'
      }, {
        label: 'Quit',
        accelerator: 'Command+Q',
        click() {
          app.quit();
        }
      }]
    }, {
      label: 'Edit',
      submenu: [{
        label: 'Undo',
        accelerator: 'Command+Z',
        selector: 'undo:'
      }, {
        label: 'Redo',
        accelerator: 'Shift+Command+Z',
        selector: 'redo:'
      }, {
        type: 'separator'
      }, {
        label: 'Cut',
        accelerator: 'Command+X',
        selector: 'cut:'
      }, {
        label: 'Copy',
        accelerator: 'Command+C',
        selector: 'copy:'
      }, {
        label: 'Paste',
        accelerator: 'Command+V',
        selector: 'paste:'
      }, {
        label: 'Select All',
        accelerator: 'Command+A',
        selector: 'selectAll:'
      }]
    }, {
      label: 'View',
      submenu: (process.env.NODE_ENV === 'development') ? [{
        label: 'Reload',
        accelerator: 'Command+R',
        click(_item, focusedWindow) {
          focusedWindow.webContents.send('reload');
        }
      }, {
        label: 'Toggle Full Screen',
        accelerator: 'Ctrl+Command+F',
        click(_item, focusedWindow) {
          focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
        }
      }, {
        label: 'Toggle Developer Tools',
        accelerator: 'Alt+Command+I',
        click(_item, focusedWindow) {
          focusedWindow.toggleDevTools();
        }
      }] : [{
        label: 'Toggle Full Screen',
        accelerator: 'Ctrl+Command+F',
        click(_item, focusedWindow) {
          focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
        }
      }]
    }, {
      label: 'Window',
      submenu: [{
        label: 'New Window',
        accelerator: 'Shift+Command+N',
        click() {
          windowManager.createWindow();
        }
      }, {
        label: 'Minimize',
        accelerator: 'Command+M',
        selector: 'performMiniaturize:'
      }, {
        label: 'Close',
        accelerator: 'Command+W',
        selector: 'performClose:'
      }, {
        type: 'separator'
      }, {
        label: 'Bring All to Front',
        selector: 'arrangeInFront:'
      }]
    }, {
      label: 'Help',
      submenu: [{
        label: 'Learn More',
        click() {
          shell.openExternal('http://dbglass.web-pal.com');
        }
      }, {
        label: 'Hire us!',
        click() {
          shell.openExternal('http://web-pal.com');
        }
      }, {
        label: 'Search Issues',
        click() {
          shell.openExternal('https://github.com/web-pal/DBGlass/issues');
        }
      }]
    }];
    menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  } else {
    template = [{
      label: '&View',
      submenu: (process.env.NODE_ENV === 'development') ? [{
        label: '&Reload',
        accelerator: 'Ctrl+R',
        click(_item, focusedWindow) {
          focusedWindow.reload();
        }
      }, {
        label: 'Toggle &Full Screen',
        accelerator: 'F11',
        click(_item, focusedWindow) {
          focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
        }
      }, {
        label: 'Toggle &Developer Tools',
        accelerator: 'Alt+Ctrl+I',
        click(_item, focusedWindow) {
          focusedWindow.toggleDevTools();
        }
      }] : [{
        label: 'Toggle &Full Screen',
        accelerator: 'F11',
        click(_item, focusedWindow) {
          focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
        }
      }]
    }, {
      label: 'Help',
      submenu: [{
        label: 'Learn More',
        click() {
          shell.openExternal('http://dbglass.web-pal.com');
        }
      }, {
        label: 'Hire us!',
        click() {
          shell.openExternal('http://web-pal.com');
        }
      }, {
        label: 'Search Issues',
        click() {
          shell.openExternal('https://github.com/web-pal/DBGlass/issues');
        }
      }]
    }];

    menu = Menu.buildFromTemplate(template);
    mainWindow.setMenu(menu);
  }
});
