---
title: Arrastrar y Soltar Ramas
description: Soltar una rama sobre otra, sobre su remota o sobre un remoto — fast-forward, merge, rebase, push y pull request
type: flujo
tags:
  - flujo
  - ramas
  - arrastrar
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Ramas y Merge]]"
next: "[[05 - Flujos de Trabajo/Rebase Interactivo]]"
related:
  - "[[05 - Flujos de Trabajo/Ramas y Merge]]"
  - "[[03 - Algoritmos/Etiquetas de Ramas]]"
  - "[[03 - Algoritmos/Pila de Deshacer]]"
  - "[[02 - Capa Git/Operaciones de Escritura]]"
---

# 🖱️ Arrastrar y soltar ramas

![[arrastrar.png]]

## Qué se puede arrastrar y dónde soltarlo

- **Origen**: cualquier rama, local o remota — una etiqueta del gráfico (si es combinada local+remota, se arrastra la local) o una fila de *Local* / *Remoto* del panel izquierdo. Las etiquetas (tags) no se arrastran.
- **Destino**:
  - una **etiqueta de rama** del gráfico (local, remota o combinada); soltar en la fila fuera de una etiqueta usa su primera rama, la local si la hay;
  - una **fila de rama** del panel izquierdo (si es local y su remota está en el mismo commit, cuenta como la etiqueta combinada);
  - el **remoto** (`origin`) del panel: publicar la rama allí.
- Mientras la rama está encima, el destino se marca con un borde punteado amarillo (`pill-drop` / `drop-target`).
- El arrastre lleva la **referencia completa** (`refs/heads/…`, `refs/remotes/…`) con el tipo `application/x-codyken-ref` (`REF_MIME`): así no hay ambigüedad con etiquetas del mismo nombre.

## Qué ofrece el menú

Al soltar, `dropRef` calcula `divergence(arrastrada, destino)` —*ahead* = commits que solo tiene la arrastrada, *behind* = los que solo tiene el destino— y `planDrop` (`lib/drop.ts`, función pura con tests) arma un menú nativo solo con lo que tiene sentido:

| Arrastras… | …sobre | Condición | Opciones |
|---|---|---|---|
| X (local o remota) | rama local Y | X no aporta nada (ahead = 0) | aviso *Y ya contiene todos los commits de X* o *están en el mismo commit* |
| X (local o remota) | rama local Y | behind = 0 | **Fast-forward de Y a X** |
| X (local o remota) | rama local Y | ahead > 0 | **Merge de X en Y** |
| X local | rama local Y | behind > 0 | **Rebase de X sobre Y** · **Rebase interactivo de X sobre Y…** |
| X remota | rama local Y | behind > 0 | **Rebase de Y sobre X** (traer lo remoto, como `pull --rebase`) |
| X local | remota R (sola o en una etiqueta combinada) | behind = 0 | **Push de X a R** (y la deja siguiendo a R si X no sigue ninguna) |
| X local | remota R | ahead y behind > 0 | **Push forzado de X a R…** (`--force-with-lease`, con confirmación) |
| X local | remota R **sin local** | ahead y behind > 0 | además **Rebase de X sobre R** · **Rebase interactivo de X sobre R…** |
| X local | remoto `origin` del panel | no existe `origin/X` | **Push de X a origin (crea origin/X)** con `-u` si no sigue ninguna |
| X local | remoto `origin` del panel | ya existe `origin/X` | como soltar sobre `origin/X` |
| X (local o remota) | rama con remota en GitHub/GitLab | ahead > 0, nombres distintos | **Crear pull request de X a Y…** |
| X remota | remota sin local, sin proveedor | — | aviso *suéltala sobre una rama local* |

Los grupos se separan con líneas. Soltar una rama sobre sí misma (o sobre su propia etiqueta combinada) no hace nada.

> [!note] Semántica
> Como en los clientes Git visuales: el **merge** lleva la arrastrada **dentro** del destino y el **rebase** reconstruye la arrastrada **encima** del destino. Una remota no se puede reescribir, así que al soltarla sobre una local el rebase es el de la local. Ver [[Decisiones]].

## Cómo se ejecuta y se deshace (`RepoView` → `runDrop`)

| Acción | Qué hace | Deshacer |
|---|---|---|
| Fast-forward de la rama actual | `merge --ff-only` | `reset --hard` al HEAD anterior |
| Fast-forward de otra rama | `fastForward`: comprueba `merge-base --is-ancestor` y `moveBranch` (`branch -f`, git se niega si la rama está activa en algún worktree) | `moveBranch` a su commit anterior (rehacer: al nuevo) |
| Merge de X en Y | checkout de Y si no es la actual + `merge` con la referencia completa; el mensaje se escribe como el de git (*Merge branch 'x' into y*, *Merge remote-tracking branch 'origin/x'*; sin *into* en main/master) | `reset --hard` de Y a su commit anterior + volver a la rama anterior |
| Rebase de X sobre Y | confirmación, checkout de X si hace falta + `rebase` | `reset --hard` de X a su commit anterior + volver a la rama anterior |
| Rebase interactivo | abre el [[05 - Flujos de Trabajo/Rebase Interactivo\|diálogo]] en modo `onto` | igual que el rebase |
| Push / push forzado | `pushBranch(rama, remoto, ramaRemota, { force, setUpstream })` → `git push [--force-with-lease=refs/heads/<r>] [-u] <remoto> refs/heads/<x>:refs/heads/<r>` | **no se deshace** |
| Pull request | `createPr(rama, upstream, base)`: si la rama no está subida ofrece hacer push primero | — |

Todo lo que mueve ramas locales entra en la [[03 - Algoritmos/Pila de Deshacer|pila de deshacer]] y se rehace con ⇧⌘Z. Si el merge o el rebase se detienen por conflictos, se resuelven como siempre ([[05 - Flujos de Trabajo/Resolver Conflictos]]).
