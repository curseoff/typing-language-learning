const { app, BrowserWindow, Menu } = require('electron')
const path = require('node:path')

// userData(記録の保存先)フォルダ名を productName に揃える。
// 必ず app の ready より前・userData 参照より前に設定する。
app.setName('EigoTyping')

function createWindow() {
  const win = new BrowserWindow({
    width: 960,
    height: 800,
    minWidth: 720,
    minHeight: 600,
    backgroundColor: '#0f172a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (app.isPackaged) {
    // 配布版: ビルド済みの静的ファイルを読み込む
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  } else {
    // 開発版: Vite の開発サーバーを読み込む
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools({ mode: 'detach' })
  }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null) // ゲーム入力を邪魔しないようメニューバー無し
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
