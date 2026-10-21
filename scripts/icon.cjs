// Genera resources/icon.png (icono de la app, 1024 px) a partir del logo SVG.
// Uso (desde la raíz del repo): npx electron scripts/icon.cjs
// Sigue la plantilla de iconos de macOS: el cuadrado redondeado ocupa 824 px centrados,
// con margen transparente y una sombra suave debajo.
const { app, BrowserWindow } = require('electron')
const { mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '..')
const svg = readFileSync(join(root, 'src/renderer/src/assets/logo.svg'), 'utf8')
const SIZE = 1024
const BODY = 824

const html = `<!doctype html><html><body style="margin:0;background:transparent">
<img src="data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}"
  style="position:absolute;left:${(SIZE - BODY) / 2}px;top:${(SIZE - BODY) / 2 - 10}px;width:${BODY}px;height:${BODY}px;
  filter:drop-shadow(0 10px 14px rgba(0,0,0,.35))">
</body></html>`

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: SIZE,
    height: SIZE,
    show: false,
    frame: false,
    transparent: true,
    useContentSize: true,
    webPreferences: { offscreen: true }
  })
  win.webContents.setZoomFactor(1)
  await win.loadURL('data:text/html;base64,' + Buffer.from(html).toString('base64'))
  await new Promise((r) => setTimeout(r, 1000))
  const image = (await win.webContents.capturePage()).resize({ width: SIZE, height: SIZE, quality: 'best' })
  mkdirSync(join(root, 'resources'), { recursive: true })
  writeFileSync(join(root, 'resources/icon.png'), image.toPNG())
  console.log('resources/icon.png', image.getSize())
  app.quit()
})
