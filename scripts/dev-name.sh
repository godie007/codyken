#!/bin/bash
# En desarrollo la app corre dentro del Electron.app de node_modules, y macOS toma de su Info.plist
# el nombre del menú de la app, del Dock y de ⌘Tab: lo cambia a Codyken. Se ejecuta solo antes de
# npm run dev (npm install lo devuelve a "Electron"). La firma de ese Electron no cubre el Info.plist.
set -euo pipefail
cd "$(dirname "$0")/.."

PLIST=node_modules/electron/dist/Electron.app/Contents/Info.plist
[ "$(uname)" = Darwin ] && [ -f "$PLIST" ] || exit 0
[ "$(plutil -extract CFBundleName raw "$PLIST")" = Codyken ] && exit 0
plutil -replace CFBundleName -string Codyken "$PLIST"
plutil -replace CFBundleDisplayName -string Codyken "$PLIST"
echo "Electron.app de desarrollo renombrado a Codyken"
