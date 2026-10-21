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
```

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
