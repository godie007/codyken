---
title: Modelo de Datos
description: Tipos compartidos entre main y renderer (Commit, Ref, StashEntry, WorkingStatus, DiffSource, Settings…)
type: arquitectura
tags:
  - arquitectura
  - tipos
updated: 2026-10-20
up: "[[01 - Arquitectura/Visión General]]"
prev: "[[01 - Arquitectura/Procesos e IPC]]"
next: "[[01 - Arquitectura/Seguridad]]"
related:
  - "[[02 - Capa Git/Lectura del Repositorio]]"
---

# 🗃️ Modelo de Datos

Todo vive en `src/shared/types.ts`. Las fechas viajan en **milisegundos**.

## Historial

| Tipo | Campos | Notas |
|---|---|---|
| `Commit` | `hash`, `parents[]`, `author`, `email`, `date`, `subject`, `stash?` | `stash` solo existe en las filas de stash que se intercalan en el gráfico ([[03 - Algoritmos/Stashes en el Gráfico]]) |
| `CommitDetail` | lo de `Commit` + `committer`, `committerEmail`, `committerDate`, `message`, `files[]` | Panel derecho |
| `FileHistoryEntry` | `Commit` + `path`, `oldPath?`, `status` | Sigue renombres |
| `BlameLine` | `hash`, `author`, `email`, `date`, `summary`, `line`, `text` | Hash de ceros = línea sin confirmar |

## Referencias y remotos

| Tipo | Campos |
|---|---|
| `Ref` | `type` (`local` / `remote` / `tag`), `name`, `fullName` (`refs/heads/x`), `hash` (en tags, el commit apuntado), y en locales `upstream`, `ahead`, `behind`, `gone`, `isHead`; en remotas `remote` |
| `Remote` | `name`, `url`, `host` (`github.com`, o `local` si el remoto es una ruta) |
| `StashEntry` | `index`, `hash`, `base` (commit sobre el que se guardó), `author`, `email`, `date`, `message` (ya limpio) |
| `GraphFilter` | `hidden[]`, `solo[]` — nombres completos de refs ([[03 - Algoritmos/Filtro de Ramas]]) |

## Árbol de trabajo

| Tipo | Campos |
|---|---|
| `FileStatus` | `'M' \| 'A' \| 'D' \| 'R' \| 'C' \| 'U' \| '?'` |
| `FileChange` | `path`, `oldPath?`, `status`, `commit?` (archivo nuevo de un stash: vive en su commit interno de no rastreados) |
| `WorkingStatus` | `staged[]`, `unstaged[]`, `conflicted[]` |
| `RepoState` | `root`, `head`, `branch` (`null` si está desacoplado), `detached`, `operation` (`merge` / `rebase` / `cherry-pick` / `revert` / `null`) |

## Diff

`DiffSource` dice qué diff mostrar:

| `kind` | Campos | De dónde sale |
|---|---|---|
| `unstaged` | `path`, `status` | Árbol de trabajo vs índice (o `/dev/null` si es nuevo) |
| `staged` | `path`, `oldPath?`, `status` | Índice vs HEAD |
| `conflict` | `path` | El archivo con marcadores, leído del disco |
| `commit` | `hash`, `parent` (`null` = raíz), `path`, `oldPath?`, `status`, `label?` | Commit vs su primer padre; en una comparación, `parent` = base y `label` nombra los dos extremos |

## Comparar, rebase y conflictos

| Tipo | Campos |
|---|---|
| `Comparison` | `base`, `target` (SHA completos), `mergeBase`, `files[]`, `ahead[]` / `behind[]` (hasta 200 commits), `aheadCount`, `behindCount` |
| `Divergence` | `ahead`, `behind`: commits que solo tiene cada una de dos refs |
| `RebaseMode` | `from` (desde un commit de la rama actual) · `onto` (llevar una rama encima de otra) |
| `RebaseCommit` | `hash`, `author`, `email`, `date`, `subject`, `message` |
| `RebaseStep` | `hash`, `action` (`pick` / `reword` / `squash` / `fixup` / `drop`), `message?` (en `reword`) |
| `ConflictVersions` | `working` (con marcadores), `base`, `ours`, `theirs` (etapas `:1:`/`:2:`/`:3:`, `null` si faltan), `binary` |

## Integraciones

| Tipo | Campos |
|---|---|
| `Worktree` | `path`, `head`, `branch`, `detached`, `bare`, `isMain`, `locked`, `prunable` |
| `LfsInfo` | `installed`, `version`, `patterns[]` (`pattern`, `source`), `files[]` (`oid`, `path`, `downloaded`) |
| `PullRequestInfo` | `provider` (`github` / `gitlab` / `null`), `slug`, `remote`, `webUrl`, `cliMissing`, `error`, `items[]` |
| `PullRequest` | `number`, `title`, `author`, `head`, `base`, `url`, `draft`, `updatedAt` |

## Ajustes

`Settings`: `recent[]`, `tabs[]`, `activeTab`, `pullMode`, `columns[]`, `leftWidth`, `rightWidth`, `leftVisible`, `rightVisible`, `diffMode` (`hunk` / `full` / `split`), `wrap`, `autoFetchMinutes`, `fileView` (`list` / `tree`) y `graphFilters` (por ruta de repo). Valores por defecto en [[02 - Capa Git/Ajustes Persistentes]].
