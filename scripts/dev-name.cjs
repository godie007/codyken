// Puerta de entrada multiplataforma de dev-name.sh, que se ejecuta antes de `npm run dev`.
// El renombrado del Electron.app de desarrollo solo tiene sentido en macOS; en Windows y Linux
// no hay nada que hacer y se sale de inmediato (en Windows `bash` es el lanzador de WSL y falla
// si no hay distribución instalada).
const { spawnSync } = require('node:child_process')
const { join } = require('node:path')

if (process.platform !== 'darwin') process.exit(0)

const result = spawnSync('bash', [join(__dirname, 'dev-name.sh')], { stdio: 'inherit' })
process.exit(result.status ?? 1)
