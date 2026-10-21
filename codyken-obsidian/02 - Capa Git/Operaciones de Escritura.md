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
  - "[[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]]"
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
| `saveConflictResolution(path, contenido)` | escribe el archivo (la ruta no puede salir del repo) + `add -- path` ([[05 - Flujos de Trabajo/Resolver Conflictos]]) |

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
| `merge(ref)` | `merge --no-edit <ref>`. Con referencia completa (`refs/heads/…`, `refs/remotes/…`) añade `-m` con el mensaje que pondría git: *Merge branch 'x' [into y]* / *Merge remote-tracking branch 'origin/x' [into y]* (sin *into* en main/master) |
| `rebase(onto)` | `rebase <ref>` |
| `interactiveRebase(base, pasos, modo)` | `rebase -i --autostash <base\|--root>` con `GIT_SEQUENCE_EDITOR="cp '<lista>'"`; la lista la arma `buildRebaseTodo` ([[05 - Flujos de Trabajo/Rebase Interactivo]]) |
| `fastForward(rama, a)` | rama actual: `merge --ff-only <a>`; otra: `merge-base --is-ancestor refs/heads/<rama> <a>` + `moveBranch` |
| `moveBranch(rama, a)` | `branch -f <rama> <a>` (git se niega si la rama está activa en algún worktree) |
| `cherryPick` / `revert` | con `-m 1` si el commit es un merge; `revert --no-edit` |
| `reset(mode)` | `reset --soft\|--mixed\|--hard <hash>` |
| `createTag(msg)` | con mensaje: `tag -a -F -` (anotada); sin mensaje: ligera |
| `deleteTag` | `tag -d` |

## Remotos

| Función | Comando |
|---|---|
| `fetch` | `fetch --all --prune --quiet` (+ `--unshallow` si es superficial) y luego fast-forward de las ramas locales solo atrasadas: `update-ref <rama> <nuevo> <viejo>` o, para la actual con `updateCurrent`, `merge --ff-only`. Devuelve `FetchResult` (`updated`, `diverged`, `skipped`, `unshallowed`) |
| `pull(mode)` | `pull --no-rebase` (merge, avanza rápido si puede) · `--ff-only` · `--rebase` |
| `push(force)` | Con upstream: `push [--force-with-lease]`. Sin upstream: `push [-f-w-l] -u <origin o el primer remoto> <rama>`. Error claro si está desacoplado o no hay remotos |
| `pushBranch(rama, remoto, ramaRemota, {force, setUpstream})` | `push [--force-with-lease=refs/heads/<ramaRemota>] [-u] <remoto> refs/heads/<rama>:refs/heads/<ramaRemota>`; valida nombres con `check-ref-format` y que el remoto exista. Sube cualquier rama, esté o no activa ([[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]]) |

## Worktrees y LFS

| Función | Comando |
|---|---|
| `addWorktree(ruta, rama, nueva)` | `worktree add [-b <rama>] -- <ruta> [HEAD\|<rama>]`; ruta absoluta, carpeta inexistente y con padre existente |
| `removeWorktree(ruta, force)` | `worktree remove [--force] -- <ruta>`; solo worktrees conocidos y nunca el principal |
| `pruneWorktrees` | `worktree prune` |
| `lfsTrack` / `lfsUntrack(patrón)` | `lfs track\|untrack -- <patrón>` (no puede empezar por `-`) |
| `lfsPull` | `lfs pull` |

Ver [[05 - Flujos de Trabajo/Worktrees y LFS]]. El checkout de un pull request (`gh pr checkout` / `glab mr checkout`) vive en `integrations.ts`: [[05 - Flujos de Trabajo/Pull Requests]].

## Stash y operaciones en curso

| Función | Comando |
|---|---|
| `stashPush(msg)` | `stash push -u [-m msg]` (incluye archivos nuevos) |
| `stashApply(i, pop)` | `stash apply\|pop stash@{i}` |
| `stashDrop(i)` | `stash drop stash@{i}` |
| `abortOperation(op)` | `<op> --abort` |
| `continueOperation(op)` | merge: `commit --no-edit`; resto: `<op> --continue` |
