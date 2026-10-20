---
title: Resolver Conflictos
description: Qué hacer cuando un merge, rebase, cherry-pick, revert, pull o stash deja conflictos
type: flujo
tags:
  - flujo
  - conflictos
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Ramas y Merge]]"
next: "[[05 - Flujos de Trabajo/Trabajar con Stashes]]"
related:
  - "[[04 - Interfaz/Diff, Historial y Blame#Conflictos]]"
---

# ⚔️ Resolver Conflictos

Cuando una operación se detiene por conflictos:

- la barra de estado muestra **⚠ merge en curso** (o rebase, cherry-pick, revert);
- el panel derecho muestra el aviso con **Abortar** y **Continuar** y la sección **En conflicto**.

## Pasos

1. Clic en un archivo de **En conflicto**: se abre con los marcadores y las zonas coloreadas.
2. Por cada archivo, una de tres:
   - **Usar versión HEAD** — te quedas con lo tuyo (`checkout --ours` + `add`);
   - **Usar versión entrante** — te quedas con lo que llega (`checkout --theirs` + `add`);
   - edítalo en tu editor y pulsa **Marcar resuelto** (`add`).
3. Cuando no quede ninguno, **Continuar**: en merge hace el commit (`commit --no-edit`); en rebase/cherry-pick/revert, `--continue`.
4. Si prefieres volver atrás: **Abortar** (`--abort`) deja el repo como antes de la operación.

> [!note] Durante una operación a medias
> Deshacer no registra operaciones que terminaron en conflicto: para salir se usa **Abortar**.
