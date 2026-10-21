---
title: Desarrollo
description: Instalar, ejecutar, compilar y probar Codyken; estructura del código y convenciones
type: guia
tags:
  - desarrollo
updated: 2026-10-20
up: "[[00 - Inicio]]"
related:
  - "[[01 - Arquitectura/Stack Tecnológico]]"
  - "[[06 - QA y Tests/Suite de Tests]]"
---

# 🛠️ Desarrollo

## Requisitos

Node 22+, npm y `git` en el PATH (en macOS, las herramientas de línea de comandos de Xcode o Homebrew).

## Comandos

```bash
npm install
npm run dev        # app con recarga en caliente del renderer
npm run build      # compila main, preload y renderer a out/
npm start          # abre la versión compilada
npm test           # vitest
npm run typecheck  # dos proyectos de TypeScript
npm run package:mac  # genera dist/Codyken.app
npm run install:mac  # la genera y la mueve a /Applications
```

## App instalada en macOS

`scripts/package-mac.sh` arma `Codyken.app` sin dependencias nuevas (ni electron-builder ni electron-packager), solo con herramientas del sistema:

1. Compila (`typecheck` + `electron-vite build`).
2. Copia con `ditto` el `Electron.app` de `node_modules` (conserva los enlaces de los frameworks), renombra el ejecutable a `Codyken` y quita `default_app.asar`.
3. Pone en `Contents/Resources/app/` lo compilado (`out/`), `resources/` y un `package.json` mínimo. Las dependencias del renderer van dentro del bundle de Vite y el proceso principal solo usa Node y Electron, así que no lleva `node_modules`.
4. Icono: `sips` saca los tamaños de `resources/icon.png` y `iconutil` hace `Codyken.icns`.
5. `Info.plist` con `plutil`: nombre, identificador `com.godie007.codyken`, icono y versión de `package.json`.
6. Firma ad hoc (`codesign --sign -`), obligatoria en Apple Silicon tras tocar el bundle.
7. Con `--install`: comprueba que Codyken esté cerrado, lo **mueve** a `/Applications` (o `~/Applications` sin permiso de escritura) y lo registra en LaunchServices. Se mueve en vez de copiar para que Spotlight no muestre dos.

Detalles:

- Mismo `name` en `package.json` que en desarrollo, así que la app instalada y `npm run dev` comparten `~/Library/Application Support/codyken` (ajustes, pestañas y recientes).
- Abierta desde Finder tiene un PATH mínimo; `buildEnv` en `git.ts` añade `/opt/homebrew/bin` y `/usr/local/bin` para encontrar `gh`, `glab` y `git-lfs`. El agente SSH llega por `launchd`.
- `app.isPackaged` es verdadero porque el ejecutable ya no se llama `Electron`: no hay *Recargar* ni herramientas de desarrollo en el menú y el [[06 - QA y Tests/Modo Captura|modo captura]] está desactivado. Para inspeccionarla: abrirla con `--remote-debugging-port=9333`.
- En macOS 26 el icono se ve con la máscara redondeada del sistema (no lo encierra en el recuadro gris de los iconos antiguos).

### El nombre en desarrollo

En `npm run dev` la app corre dentro del `Electron.app` de `node_modules` y macOS toma de su `Info.plist` el nombre del menú de la app, del Dock y de ⌘Tab. `scripts/dev-name.sh` (hook `predev`) lo cambia a *Codyken*; la firma de ese Electron no cubre el `Info.plist`, así que sigue arrancando. `npm install` lo devuelve a *Electron* y el siguiente `npm run dev` lo arregla. El menú de la app está en español y con el nombre: *Acerca de Codyken*, *Ocultar Codyken*, *Salir de Codyken*.

> [!tip] Cambios en el proceso principal
> La recarga en caliente solo aplica al renderer. Si tocas `src/main/` (p. ej. `git.ts`), cierra la app y vuelve a lanzar `npm run dev`.

## Estructura

```
src/main/index.ts        ventana, menús, IPC, diálogos, modo captura
src/main/git.ts          todas las operaciones de git
src/main/watcher.ts      vigilancia de archivos
src/main/settings.ts     ajustes persistentes y lista de recientes
src/preload/index.ts     puente window.codyken
src/shared/types.ts      tipos y contrato Api
src/shared/recent.ts     reglas de la lista de recientes (main y tests)
src/renderer/src/
  App.tsx                pestañas y atajos globales
  api.ts                 Proxy del API
  useRepoData.ts         carga y refresco de datos de un repo
  components/            RepoView (orquestador), Toolbar, LeftPanel, GraphView,
                         CommitPanel, DiffView, FileTools, CommandPalette, RepoList,
                         Welcome, ui, Icons
  lib/                   graph, refs, diff, patch, highlight, format, fuzzy, repos
  assets/logo.svg        logo (generado por scripts/logo.py)
  styles.css             tema Monokai
scripts/logo.py          genera el logo (python3 scripts/logo.py)
scripts/icon.cjs         genera resources/icon.png desde el logo (npx electron scripts/icon.cjs)
scripts/package-mac.sh   arma e instala Codyken.app (npm run package:mac / install:mac)
scripts/dev-name.sh      pone el nombre Codyken al Electron de desarrollo (predev)
resources/icon.png       icono de la app (Dock en macOS, ventana en Windows y Linux)
tests/                   vitest
codyken-obsidian/        esta bóveda (Adjuntos/capturas: imágenes del README)
```

## Convenciones

- **Todo texto visible en español**, comentarios incluidos.
- Una operación nueva de git: función en `git.ts` → handler en `index.ts` → método en `Api` (`types.ts`) → uso con `api.metodo()` en el renderer. El typecheck obliga a mantener los tres en sincronía.
- Acciones que cambian el repo: con `run()` en `RepoView` (spinner, toast, recarga) y, si mueven HEAD, con `runUndoable()` ([[03 - Algoritmos/Pila de Deshacer]]).
- Acciones destructivas: confirmación con `api.confirm`.
- Validar cada argumento que llega a git (`assertArg`, `safeRef`).
- Antes de publicar: `npm run typecheck && npm test` y [[06 - QA y Tests/Verificación Visual]].

## Repositorio

[github.com/godie007/codyken](https://github.com/godie007/codyken), rama `main`. En el Mac de desarrollo el remoto usa el alias SSH `godie007mac` (`git@godie007mac:godie007/codyken.git`) porque las credenciales HTTPS guardadas son de otra cuenta.
