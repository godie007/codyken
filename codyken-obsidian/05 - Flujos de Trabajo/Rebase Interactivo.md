---
title: Rebase Interactivo
description: Reordenar, reescribir, combinar y descartar commits; en la misma rama o llevando una rama encima de otra
type: flujo
tags:
  - flujo
  - rebase
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]]"
next: "[[05 - Flujos de Trabajo/Comparar Commits y Ramas]]"
related:
  - "[[02 - Capa Git/Operaciones de Escritura]]"
  - "[[03 - Algoritmos/Pila de Deshacer]]"
  - "[[05 - Flujos de Trabajo/Resolver Conflictos]]"
---

# 🧩 Rebase interactivo

Dos modos (`RebaseMode`):

| Modo | Cómo se abre | Qué commits lista |
|---|---|---|
| `from` — reescribir en el sitio | clic derecho en un commit de la rama actual → *Rebase interactivo desde aquí…*, o paleta → *Rebase interactivo desde abc1234…* | desde ese commit (incluido) hasta HEAD |
| `onto` — llevar una rama encima de otra | [[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas\|arrastrar]] la rama X sobre Y → *Rebase interactivo de X sobre Y…* | los de X que no están en Y (como `git rebase -i Y`) |

La opción solo aparece si el commit es antepasado de HEAD (entre los commits cargados) y no hay otra operación en curso.

## El diálogo (`RebaseDialog.tsx`)

![[rebase.png]]
*Modo `from`: un commit movido y combinado y otro con el mensaje reescrito.*

![[rebase-sobre.png]]
*Modo `onto`: feature/pagos sobre deploy/staging, abierto al soltar una rama sobre otra.*

- Filas del **más antiguo al más nuevo** (el orden en que se aplican). Se reordenan **arrastrando** (⋮⋮) o con ↑ ↓.
- Acción por fila: **Conservar** (`pick`), **Reescribir mensaje** (`reword`, abre un textarea con el mensaje completo), **Combinar con el anterior** (`squash`, junta los mensajes), **Combinar sin su mensaje** (`fixup`) y **Descartar** (`drop`). Las combinadas muestran `↑` hacia el commit de arriba.
- Resumen: *nuevo orden · n reescrito(s) · n combinado(s) · n descartado(s)*; en modo `onto` sin cambios dice *Se aplican tal cual encima de Y*, que también es un rebase válido.
- `lib/rebase.ts` → `rebaseProblem` valida antes de empezar (igual que el proceso principal): el primer commit que se conserva no puede ser `squash`/`fixup` y los reescritos necesitan mensaje.
- Con cambios sin confirmar avisa de que se guardan en un stash automático.

## Qué ejecuta (`git.ts`)

1. `getRebaseCommits(repo, base, mode, tip)`:
   - `from`: comprueba `merge-base --is-ancestor base HEAD`; rango `padre(base)..HEAD` (o `--root` si base es el primer commit).
   - `onto`: rango `--cherry-pick --right-only base...tip` (se omiten los commits que ya están en la base como cherry-pick, igual que la lista que propone git).
   - Rechaza rangos con **merges** (solo historia lineal) y más de **500** commits.
2. `buildRebaseTodo(steps, commits, archivoMensaje)`: valida que los pasos sean **exactamente** los commits del rango (ni más, ni menos, ni repetidos) y escribe la lista. *Reescribir* = `pick <sha>` + `exec git commit --amend --allow-empty --no-verify --cleanup=strip -F '<archivo>'`, así no hace falta un editor interactivo.
3. `interactiveRebase(repo, base, steps, mode)`: escribe la lista y los mensajes en una carpeta de `mkdtemp` y lanza `git rebase -i --autostash <base|--root>` con `GIT_SEQUENCE_EDITOR="cp '<lista>'"`: git llama al «editor» con la ruta de su lista y `cp` la sustituye por la nuestra.
4. Si el rebase **se detiene** (conflicto), la carpeta temporal se conserva —los `exec` pendientes leen de ella— y el error explica *Continuar / Abortar*. Si termina o falla antes de empezar, se borra.

En modo `onto`, si X no es la rama actual, el renderer hace checkout de X antes; el diálogo ya listó los commits con `tip = refs/heads/X`.

## Deshacer

- `from`: `reset --hard` al HEAD anterior.
- `onto`: `reset --hard` de X a su commit anterior y vuelta a la rama en la que estabas.

Los dos se rehacen con ⇧⌘Z ([[03 - Algoritmos/Pila de Deshacer]]). Si ya habías subido la rama, después tendrás que forzar el push.
