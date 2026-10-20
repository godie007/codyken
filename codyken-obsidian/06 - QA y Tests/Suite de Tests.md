---
title: Suite de Tests
description: Tests de vitest de Codyken, qué cubren y cómo ejecutarlos
type: qa
tags:
  - qa
  - tests
updated: 2026-10-20
up: "[[00 - Inicio]]"
next: "[[06 - QA y Tests/Modo Captura]]"
related:
  - "[[Desarrollo]]"
---

# 🧪 Suite de Tests

```bash
npm test          # vitest run — 26 tests
npm run typecheck # tsc de main/preload/lib/tests y del renderer
```

Los tests de git crean repos reales en una carpeta temporal y los borran al terminar.

## `tests/graph.test.ts` — [[03 - Algoritmos/Gráfico de Carriles|gráfico]]

| Test | Verifica |
|---|---|
| historial lineal usa un solo carril | `maxLanes = 1`, sin trazo de salida en la raíz |
| una rama y su merge abren y cierran un segundo carril | carriles de merge, confluencia en la base y línea pasante |
| el nodo WIP dibuja trazos punteados hasta HEAD aunque HEAD no sea la primera fila | punteado del WIP |
| la rama actual va en el carril 0 aunque haya commits más nuevos en otras ramas | carril reservado y carril fantasma sin dibujo arriba |
| sin primary visible no reserva carril | no deja un hueco vacío |

## `tests/diff-patch.test.ts` — [[03 - Algoritmos/Diff y Staging Parcial|diff y parches]]

| Test | Verifica |
|---|---|
| lee hunks y numera líneas | `parseDiff` |
| reconoce archivos binarios y nuevos | flags del archivo |
| empareja líneas en la vista dividida | `toSplitRows` |
| resalta solo el tramo cambiado | `intraline` |
| prepara solo las líneas elegidas | `buildHunkPatch` + `git apply --cached` contra git real |
| quita del índice solo las líneas elegidas | parche inverso sobre el índice |
| descarta un hunk completo del árbol de trabajo | parche inverso sobre el árbol |
| parseStatus separa preparados, sin preparar, nuevos y conflictos | `parseStatus` |
| parseNameStatus entiende renombrados | `parseNameStatus` |

## `tests/git.test.ts` — [[02 - Capa Git/Lectura del Repositorio|lectura]]

| Test | Verifica |
|---|---|
| sin filtro muestra todas las ramas | `getLog` |
| ocultar una rama quita sus commits exclusivos | `--exclude` |
| modo "solo" muestra la rama elegida y HEAD | modo solo |
| rechaza referencias raras | `safeRef` contra `--output=…` |
| sigue el archivo a través de un renombre | `getFileHistory` con `oldPath` |
| blame atribuye cada línea a su commit | `getBlame` |
| extrae el servidor del remoto | `getRemotes` |
| quita el hash de los stashes automáticos y el prefijo de los con nombre | `stashLabel` |

## `tests/recent.test.ts` — [[04 - Interfaz/Repositorios Recientes|repositorios recientes]]

| Test | Verifica |
|---|---|
| al abrir un repo lo sube al principio sin duplicarlo | `pushRecent` |
| recorta al máximo de recientes | `MAX_RECENT` |
| quitar elementos conserva el orden del resto | `withoutRecent` |
| sin búsqueda mantiene el orden; con búsqueda prioriza el nombre y acepta la ruta | `matchRepos` |

## Sin cobertura automática

La interfaz (componentes React) se verifica con el [[06 - QA y Tests/Modo Captura|modo captura]] y la [[06 - QA y Tests/Verificación Visual|lista de verificación visual]].
