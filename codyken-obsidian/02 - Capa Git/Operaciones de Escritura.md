---
title: Operaciones de Escritura
description: Comandos de git que modifican el repositorio y sus banderas exactas
type: modulo
tags:
  - capa-git
  - main
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[02 - Capa Git/Lectura del Repositorio]]"
next: "[[02 - Capa Git/Vigilancia y Refresco]]"
related:
  - "[[03 - Algoritmos/Pila de Deshacer]]"
  - "[[05 - Flujos de Trabajo/Sincronizar con el Remoto]]"
---

# ✍️ Operaciones de Escritura

## Staging y commit

| Función | Comando |
|---|---|
| `stage(paths)` | `add -A -- <paths>` (incluye borrados y nuevos) |
| `stageAll` | `add -A` |
| `unstage(paths)` | `restore --staged -- <paths>`; sin commits: `rm --cached -r -q` |
| `unstageAll` | `reset -q`; sin commits: `rm --cached -r -q .` |
| `discard(files)` | rastreados: `restore --worktree --`; nuevos: `clean -f -q --` |
| `discardAll` | `reset --hard -q` + `clean -f -d -q` |
| `applyPatch(patch, cached, reverse)` | `apply --recount --whitespace=nowarn [--cached] [--reverse] -` (ver [[03 - Algoritmos/Diff y Staging Parcial]]) |
| `resolveConflict(path, lado)` | `checkout --ours\|--theirs -- path` + `add -- path` |
| `commit(msg, amend)` | `commit --cleanup=strip -F - [--amend]` (mensaje por stdin) |

## Ramas, etiquetas e historial

| Función | Comando |
|---|---|
| `checkout` commit | `checkout --detach <hash>` |
| `checkout` local | `checkout <rama> --` |
| `checkout` remota | Si ya existe la local: `checkout <local>`; si no: `checkout -b <local> --track <remota>` |
| `createBranch(name, start, checkout)` | `checkout -b` o `branch` |
| `renameBranch` | `branch -m` |
| `deleteBranch(force)` | `branch -d` / `-D` |
| `deleteRemoteBranch` | `push <remoto> --delete <rama>` |
| `merge` | `merge --no-edit <ref>` |
| `rebase` | `rebase <ref>` |
| `cherryPick` / `revert` | con `-m 1` si el commit es un merge; `revert --no-edit` |
| `reset(mode)` | `reset --soft\|--mixed\|--hard <hash>` |
| `createTag(msg)` | con mensaje: `tag -a -F -` (anotada); sin mensaje: ligera |
| `deleteTag` | `tag -d` |

## Remotos

| Función | Comando |
|---|---|
| `fetch` | `fetch --all --prune --quiet` |
| `pull(mode)` | `pull --no-rebase` (merge, avanza rápido si puede) · `--ff-only` · `--rebase` |
| `push(force)` | Con upstream: `push [--force-with-lease]`. Sin upstream: `push [-f-w-l] -u <origin o el primer remoto> <rama>`. Error claro si está desacoplado o no hay remotos |

## Stash y operaciones en curso

| Función | Comando |
|---|---|
| `stashPush(msg)` | `stash push -u [-m msg]` (incluye archivos nuevos) |
| `stashApply(i, pop)` | `stash apply\|pop stash@{i}` |
| `stashDrop(i)` | `stash drop stash@{i}` |
| `abortOperation(op)` | `<op> --abort` |
| `continueOperation(op)` | merge: `commit --no-edit`; resto: `<op> --continue` |
