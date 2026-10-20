---
title: Procesos e IPC
description: Cómo se comunican renderer, preload y proceso principal; canal único codyken:api y eventos de cambio
type: arquitectura
tags:
  - arquitectura
  - ipc
  - electron
updated: 2026-10-20
up: "[[01 - Arquitectura/Visión General]]"
prev: "[[01 - Arquitectura/Stack Tecnológico]]"
next: "[[01 - Arquitectura/Modelo de Datos]]"
related:
  - "[[01 - Arquitectura/Seguridad]]"
  - "[[02 - Capa Git/Ejecución de git]]"
---

# 🔌 Procesos e IPC

## 📮 Canal único de llamadas

- **Preload** (`src/preload/index.ts`) expone `window.codyken = { invoke, onRepoChanged, platform }`.
- **Renderer** (`src/renderer/src/api.ts`) envuelve `invoke` en un `Proxy`: `api.getLog(repo, …)` se convierte en `invoke('getLog', [repo, …])`, y la respuesta `{ ok, data | error }` se desenvuelve (si `ok` es `false` lanza `Error(error)`).
- **Main** (`src/main/index.ts`) atiende `ipcMain.handle('codyken:api', …)`:
  - rechaza la llamada si no viene de la ventana principal o si el método **no está en la lista cerrada `handlers`** (`Object.hasOwn`);
  - cada handler recibe primero la ventana (para diálogos y menús) y luego los argumentos;
  - devuelve `{ ok: true, data }` o `{ ok: false, error: mensaje }`.

El contrato completo está tipado en `Api` (`src/shared/types.ts`), así que renderer y main no pueden divergir sin que falle el typecheck.

## 🔒 Repos conocidos

`knownRepos` (un `Set` en el main) guarda las rutas abiertas con `resolveRepo`, `initRepo` o `cloneRepo`. Cualquier otra operación sobre un repo que no esté ahí falla con *"Repositorio no abierto en Codyken"*. Así el renderer no puede pedir operaciones sobre rutas arbitrarias.

## 📣 Eventos del main al renderer

`RepoWatchers` emite `codyken:repo-changed` con `{ repo, refs }` (ver [[02 - Capa Git/Vigilancia y Refresco]]). `onRepoChanged` devuelve la función para desuscribirse.

## 🧭 Servicios nativos expuestos

| Método | Qué hace |
|---|---|
| `pickDirectory` | Diálogo para elegir carpeta |
| `confirm` | Diálogo de confirmación (botón destructivo opcional) |
| `contextMenu` | Construye un `Menu` nativo desde `MenuItemSpec[]` y resuelve con el `id` elegido o `null` |
| `copyText` | Portapapeles |
| `openTerminal` / `openInFinder` | `open -a Terminal <repo>` y `shell.openPath` (abre la carpeta en Finder) |
| `watchRepo` / `unwatchRepo` | Activa o detiene la vigilancia |
| `getSettings` / `updateSettings` | [[02 - Capa Git/Ajustes Persistentes]] |

## 🪟 Ventana y menú

- `titleBarStyle: 'hiddenInset'` en macOS (las pestañas ocupan la barra de título).
- Menú de app: Edición, Ver (zoom, pantalla completa; recarga y DevTools solo en desarrollo) y Ventana. **No** hay ⌘W en el menú: lo maneja el renderer para cerrar pestañas.
- Navegación bloqueada (`will-navigate`); `window.open` se deniega y solo los enlaces `https://` se abren en el navegador del sistema.
