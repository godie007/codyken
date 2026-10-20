---
title: Ajustes Persistentes
description: settings.json de Codyken, valores por defecto y qué se guarda por repositorio
type: modulo
tags:
  - capa-git
  - main
  - ajustes
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[02 - Capa Git/Vigilancia y Refresco]]"
related:
  - "[[01 - Arquitectura/Modelo de Datos#Ajustes]]"
---

# 💾 Ajustes Persistentes

Archivo: `~/Library/Application Support/codyken/settings.json` (carpeta `userData` de Electron). Lo escribe `src/main/settings.ts`; el renderer agrupa cambios con un debounce de 300 ms (`App.tsx`).

| Clave | Por defecto | Qué guarda |
|---|---|---|
| `recent` | `[]` | Últimos 15 repos abiertos |
| `tabs` / `activeTab` | `[]` / `0` | Pestañas abiertas; se restauran al iniciar |
| `pullMode` | `merge` | Modo del botón Pull (`merge`, `ff-only`, `rebase`) |
| `columns` | `refs, graph, message, author, date` | Columnas visibles del gráfico (`sha` está oculta) |
| `leftWidth` / `rightWidth` | `250` / `380` | Ancho de paneles (límites 180–480 y 300–640) |
| `leftVisible` / `rightVisible` | `true` | Paneles visibles (⌘J / ⌘K) |
| `diffMode` | `hunk` | Bloques, archivo completo o dividido |
| `wrap` | `false` | Ajuste de líneas largas en el diff |
| `autoFetchMinutes` | `10` | Intervalo del fetch automático (`0` lo apaga) |
| `fileView` | `list` | Archivos en lista o árbol |
| `graphFilters` | `{}` | Ramas ocultas / modo solo **por ruta de repo** ([[03 - Algoritmos/Filtro de Ramas]]) |

> [!tip] Modo captura
> El [[06 - QA y Tests/Modo Captura|modo captura]] usa otra carpeta (`$TMPDIR/codyken-snapshot`), así que no toca estos ajustes.
