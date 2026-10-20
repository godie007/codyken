---
title: Etiquetas de Ramas
description: Cómo se agrupan ramas locales, remotas y etiquetas por commit (labelsByCommit) y cómo se arman las carpetas del panel
type: algoritmo
tags:
  - algoritmo
  - ramas
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[03 - Algoritmos/Gráfico de Carriles]]"
next: "[[03 - Algoritmos/Stashes en el Gráfico]]"
related:
  - "[[04 - Interfaz/Panel Izquierdo]]"
  - "[[04 - Interfaz/Gráfico de Commits]]"
---

# 🏷️ Etiquetas de Ramas

Archivo: `src/renderer/src/lib/refs.ts`.

## `labelsByCommit(refs, detachedHead)`

Devuelve `Map<hash, RefLabel[]>` para pintar las píldoras de la columna *Rama / Etiqueta*:

1. Si HEAD está desacoplado, una etiqueta `HEAD` en ese commit.
2. Una etiqueta por cada **rama local**.
3. Cada **rama remota** se une a la local del **mismo nombre en el mismo commit** (`origin/main` + `main` = una sola píldora con 💻 ☁). Si no hay gemela, va sola (píldora punteada, prefijo `origin/` atenuado).
4. Las **etiquetas** (tags).
5. Orden dentro de cada commit: HEAD → ramas locales → ramas solo remotas → etiquetas. La primera se muestra; el resto queda en `+n`.

`labelRef(label)` da la ref que se arrastra al soltar una píldora sobre otra fila (merge / rebase).

> [!note] Si la local y la remota están en commits distintos
> Aparecen como dos píldoras en filas distintas: es real (una va por delante o por detrás). El panel izquierdo lo indica con `↑n` / `↓n`.

## Gemelas en el panel izquierdo

`LeftPanel` calcula `localTwins`:

- Para cada remota, la local que la **sigue** (`upstream`) o que **se llama igual** → muestra 💻 en la fila remota.
- Para cada local **sin upstream** que tiene una remota con su nombre → nube tenue ("existe en el remoto pero no la sigue").
- Local sin upstream y sin gemela → insignia `local` (nunca se subió).
- Local con upstream y sin ↑/↓ → nube normal ("al día").

## `buildTree(items, pathOf)`

Convierte `feature/login` y `feature/pago` en una carpeta `feature` con dos hojas. Ordena carpetas primero y luego alfabéticamente. Se usa en las ramas del panel izquierdo y en la vista de árbol de archivos.
