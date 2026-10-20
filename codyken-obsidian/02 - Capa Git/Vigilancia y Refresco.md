---
title: Vigilancia y Refresco
description: Cómo Codyken detecta cambios en el repo (fs.watch) y qué recarga en cada caso
type: modulo
tags:
  - capa-git
  - main
  - renderer
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[02 - Capa Git/Operaciones de Escritura]]"
next: "[[02 - Capa Git/Ajustes Persistentes]]"
related:
  - "[[01 - Arquitectura/Procesos e IPC]]"
---

# 👀 Vigilancia y Refresco

## En el main: `RepoWatchers` (`src/main/watcher.ts`)

- `fs.watch(repo, { recursive: true })` sobre el árbol de trabajo; si el `.git` está fuera (worktrees), un segundo watcher sobre él.
- Ignora `node_modules/` y, dentro de `.git`, `objects/`, `logs/`, `lfs/`, `hooks/` y los `*.lock`.
- Clasifica el evento:
  - archivo del árbol o `.git/index` → **solo status** (`refs: false`);
  - cualquier otra cosa en `.git` (HEAD, refs, packed-refs…) → **todo** (`refs: true`).
- Agrupa ráfagas con un **debounce de 350 ms** y envía `codyken:repo-changed`.
- Si `fs.watch` falla, la app sigue funcionando sin refresco automático.

## En el renderer: `useRepoData` (`src/renderer/src/useRepoData.ts`)

| Disparador | Qué recarga |
|---|---|
| Abrir el repo o cambiar el [[03 - Algoritmos/Filtro de Ramas\|filtro]] | `refreshAll`: refs, estado, status, stashes, log, submódulos y remotos en paralelo |
| Evento con `refs: true` | `refreshAll` |
| Evento con `refs: false` | `refreshStatus`: status + estado |
| La ventana recupera el foco | `refreshAll` |
| Tras cada acción de la app (`run`) | `refreshAll`; las acciones rápidas de staging (`quick`) solo `refreshStatus` |

- Cada recarga lleva un número de secuencia: si llega una respuesta vieja después de una nueva, se descarta.
- `statusVersion` sube con cada recarga; los diffs abiertos lo usan para refrescarse.

## Fetch automático

`RepoView`: primer fetch silencioso a los **4 s** de abrir el repo y luego cada `autoFetchMinutes` (por defecto **10**). Los errores del fetch automático no se muestran.
