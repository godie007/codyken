---
title: Lectura del Repositorio
description: Comandos de git que alimentan la interfaz (log, refs, estado, status, stashes, diff, historial, blame, remotos)
type: modulo
tags:
  - capa-git
  - main
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[02 - Capa Git/Ejecución de git]]"
next: "[[02 - Capa Git/Operaciones de Escritura]]"
related:
  - "[[01 - Arquitectura/Modelo de Datos]]"
  - "[[03 - Algoritmos/Gráfico de Carriles]]"
---

# 📖 Lectura del Repositorio

| Función | Comando de git | Resultado |
|---|---|---|
| `resolveRepo(path)` | `rev-parse --show-toplevel` | Raíz del repo; error si la carpeta no existe o no es repo. El handler IPC lo añade a recientes salvo con `addToRecent = false` |
| `initRepo(path)` / `cloneRepo(url, dir)` | `init` / `clone -- url dest` | Raíz del repo nuevo (la carpeta destino no debe existir) |
| `getLog(repo, limit, filtro)` | `log --date-order -n N --format=… <revs> --` | `Commit[]` ([[#Log y orden]]) |
| `getRefs` | `for-each-ref refs/heads refs/remotes refs/tags` | `Ref[]` con upstream, ↑/↓, `gone`, HEAD; descarta symrefs (`origin/HEAD`) y en tags usa el commit apuntado |
| `getRemotes` | `remote -v` | `Remote[]` con el servidor extraído de la URL (`local` si es una ruta) |
| `getRepoState` | `rev-parse --absolute-git-dir`, `rev-parse HEAD`, `symbolic-ref` | `RepoState`; la operación en curso se detecta por archivos en `.git` (`rebase-merge`/`rebase-apply`, `MERGE_HEAD`, `CHERRY_PICK_HEAD`, `REVERT_HEAD`) |
| `getStatus` | `status --porcelain=v1 -z --untracked-files=all` | `WorkingStatus` (conflictos: `DD AU UD UA DU AA UU`) |
| `getStashes` | `stash list --format=%gd %H %P %an %ae %at %gs` | `StashEntry[]` con su commit base y el mensaje limpio (`stashLabel`) |
| `getSubmodules` | `config -f .gitmodules --get-regexp path` | Rutas de submódulos |
| `getCommitDetail(hash)` | `show -s --format=…` + `diff --name-status -M <padre> <hash>` | `CommitDetail`; en un stash con `-u` añade los archivos nuevos del tercer padre |
| `getDiff(source, full)` | según `DiffSource` ([[01 - Arquitectura/Modelo de Datos#Diff]]) | Texto del diff; `-U3` o `-U1000000` para archivo completo; máximo 8 MB |
| `readWorkingFile` | lectura directa del disco | Para la vista de conflicto; protegida contra rutas fuera del repo |
| `getFileHistory(path, 500)` | `log --follow -M --name-status` | `FileHistoryEntry[]` siguiendo renombres |
| `getBlame(path, rev)` | `blame --porcelain [rev] --` | `BlameLine[]` |
| `getLastCommitMessage` | `log -1 --format=%B` | Para precargar el amend |

## Log y orden

- **`--date-order`**: cronológico respetando que un hijo va antes que sus padres. Es lo que hace que los merges queden junto a lo que integran (ver [[Decisiones#Orden cronológico en el gráfico]]).
- Revisiones: sin filtro, `--exclude=<oculta>… --exclude=refs/stash --all`; en modo *solo*, `<refs elegidas> HEAD`. El stash nunca entra al log: se intercala aparte ([[03 - Algoritmos/Stashes en el Gráfico]]).
- Si el repo no tiene commits, devuelve `[]` en vez de error.
- Paginación: el renderer pide 2000 y suma 2000 más al acercarse al final (`loadMore`).

## Stashes: limpieza del mensaje

`stashLabel`: `"WIP on dev: 046e6c5 asunto"` → `"WIP en dev: asunto"`; `"On dev: mensaje"` → `"mensaje"`.
