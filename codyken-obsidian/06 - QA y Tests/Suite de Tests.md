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
npm test          # vitest run — 66 tests en 8 archivos
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

## `tests/conflict.test.ts` — [[05 - Flujos de Trabajo/Resolver Conflictos|editor de conflictos]]

| Test | Verifica |
|---|---|
| separa tramos comunes y conflictos con sus etiquetas | `parseConflicts` (estilo merge) |
| entiende el estilo diff3 con la versión base | sección `\|\|\|\|\|\|\|` |
| arma el resultado según las casillas, en el orden en que se marcaron | `toggleSide`, `resultLines`, `joinResult` |
| conserva los finales de línea de Windows | CRLF y salto final |
| rechaza marcadores incompletos o anidados | devuelve `null` |
| sin marcadores ofrece las dos versiones completas | `wholeFileConflict` |
| avisa si el primer commit se combina o falta un mensaje | `rebaseProblem` (`lib/rebase.ts`) |

## `tests/drop.test.ts` — [[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas|arrastrar y soltar]] y [[03 - Algoritmos/Etiquetas de Ramas|etiquetas]]

| Test | Verifica |
|---|---|
| une la local y su remota cuando están en el mismo commit | `labelsByCommit`: una sola etiqueta; dos si difieren |
| une también por la rama que sigue aunque se llame distinto | gemela por `upstream` |
| una local sobre su remota atrasada ofrece push | `planDrop` → push sin forzar |
| si divergen, el push es forzado | push forzado + rebase sobre la remota |
| una remota sobre su local trae los cambios | fast-forward / merge / rebase de la local |
| una local sobre otra rama combinada ofrece merge, rebase, push y PR | grupos y PR que sube la rama primero |
| el merge y el fast-forward en una rama que no es la actual lo indican | `current: false` |
| avisa cuando no hay nada que hacer | aviso deshabilitado; sobre sí misma, menú vacío |
| sobre un remoto del panel publica la rama | *Push de X a origin (crea origin/X)* con `-u`; `dropTargetRef` |
| una remota sobre otra remota solo puede abrir un PR | PR, o aviso sin proveedor |

## `tests/features.test.ts` — git real

| Test | Verifica |
|---|---|
| reordena, reescribe, combina y descarta commits | `interactiveRebase` modo `from` |
| squash junta los mensajes sin comentarios | mensaje combinado limpio |
| valida la lista antes de tocar el repo | `buildRebaseTodo` |
| rechaza commits que no están en la rama actual | `getRebaseCommits` |
| cuenta los commits de cada lado y lista los archivos distintos | `compareRefs` |
| lee las tres versiones y guarda la resolución preparada | `getConflictVersions` + `saveConflictResolution` (rechaza `../`) |
| crea, lista y elimina un worktree con rama nueva | `addWorktree` / `getWorktrees` / `removeWorktree` |
| entiende la salida porcelain | `parseWorktrees` |
| lee los patrones y archivos de git lfs | `parseLfsTrack`, `parseLfsFiles` |
| sin git-lfs detecta los patrones en .gitattributes | `parseLfsAttributes` |
| reconoce el servidor y la ruta del remoto | `parseRemoteUrl`, `providerOf` |
| convierte la respuesta de gh y glab | `parseGithubPrs`, `parseGitlabMrs` |

## `tests/branches.test.ts` — git real con un remoto bare

| Test | Verifica |
|---|---|
| cuenta los commits que tiene cada rama y no la otra | `divergence` |
| hace fast-forward de una rama que no es la actual y la devuelve a su sitio | `fastForward` + `moveBranch` |
| hace fast-forward de la rama actual y rechaza un avance que no es directo | `merge --ff-only` y error claro |
| no mueve con moveBranch la rama en la que estás | `branch -f` se niega |
| sube una rama que no es la actual y la deja siguiendo a la remota | `pushBranch` con `setUpstream` |
| sube una rama local a otra rama remota y exige forzar si divergen | push normal, rechazo y `--force-with-lease` |
| rechaza remotos y nombres de rama no válidos | validación de `pushBranch` |
| lista los commits propios de la rama y los lleva encima de la otra | `getRebaseCommits` / `interactiveRebase` modo `onto` |
| omite los commits que ya están en la base como cherry-pick | `--cherry-pick --right-only` |
| deja el mensaje como lo escribiría git | `merge` con referencia completa |
| adelanta las ramas locales atrasadas y deja las divergentes, la actual y las de otros worktrees | `fetch`: fast-forward de las atrasadas, `diverged`, `skipped` por worktree y la actual solo con `updateCurrent` |

> [!note] Lo que no cubren
> `gh`, `glab` y `git-lfs` no se ejecutan en los tests (solo sus parsers). `gh` se probó a mano; `glab` y `git-lfs` no estaban instalados ([[Limitaciones Conocidas]]).

## Sin cobertura automática

La interfaz (componentes React, menús nativos de soltar incluidos) se verifica con el [[06 - QA y Tests/Modo Captura|modo captura]] y la [[06 - QA y Tests/Verificación Visual|lista de verificación visual]].
