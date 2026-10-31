---
title: Ramas y Merge
description: Crear, cambiar, renombrar y eliminar ramas; merge y rebase desde menú o arrastrando, worktrees
type: flujo
tags:
  - flujo
  - ramas
updated: 2026-10-30
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Sincronizar con el Remoto]]"
next: "[[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]]"
related:
  - "[[04 - Interfaz/Panel Izquierdo#Menú de una rama]]"
  - "[[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]]"
---

# 🌿 Ramas, Merge y Rebase

## Crear

- **Rama** en la barra o ⌘B: desde HEAD. Clic derecho en un commit o rama → *Crear rama aquí…*.
- El diálogo valida el nombre (sin espacios, que no exista, `check-ref-format`) y trae marcado *Cambiar a la nueva rama*.

## Cambiar (checkout)

- Doble clic en una rama del panel o en su píldora del gráfico, el menú ⎇ de la barra o la paleta (⌘P → nombre).
- Una **remota** crea la rama local con seguimiento (o cambia a ella si ya existe).
- Un **commit** o una **etiqueta** deja HEAD desacoplado, previa confirmación.

## Merge y rebase

- Clic derecho en una rama → *Merge de X en {actual}* o *Rebase de {actual} sobre X* (el rebase pide confirmación porque reescribe commits).
- **Arrastrar** una rama (del gráfico o del panel) sobre otra rama, sobre su remota o sobre un remoto: fast-forward, merge de la arrastrada en el destino, rebase de la arrastrada encima del destino, rebase interactivo, push o pull request. Si el destino no es la rama actual, se hace checkout antes. Detalle y tabla de casos: [[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]].
- **Rebase interactivo** para reordenar, reescribir, combinar o descartar commits: [[05 - Flujos de Trabajo/Rebase Interactivo]].
- **Comparar** dos ramas o commits: ⌘‑clic o *Comparar con…* ([[05 - Flujos de Trabajo/Comparar Commits y Ramas]]).
- Cherry-pick y revert desde el menú de un commit (en merges se usa `-m 1`).

Todo esto se puede [[05 - Flujos de Trabajo/Deshacer una Acción|deshacer]] (y rehacer con ⇧⌘Z) mientras no hayas hecho nada más.

## Renombrar y eliminar

- *Renombrar…* (locales).
- *Eliminar…*: si la rama tiene commits que no están en otra, avisa y ofrece *Eliminar de todos modos* (`-D`). Se recupera con Deshacer.
- *Eliminar rama remota…*: `git push <remoto> --delete <rama>`; afecta a todo el equipo.

## Eliminar varias ramas

⌘‑clic (Ctrl en Windows y Linux) y Mayús‑clic seleccionan ramas en el [[04 - Interfaz/Panel Izquierdo|panel]]; aparece una barra con *Eliminar…*. También con clic derecho sobre la selección, una carpeta, un remoto o la cabecera *Local*. Esc cancela la selección.

El diálogo lista qué se elimina y qué no: nunca la rama actual, una abierta en otro worktree, la principal del remoto (`origin/HEAD`) ni la remota de la rama actual. Una casilla añade las remotas de las locales elegidas. Las locales con commits sin integrar piden una segunda confirmación; si no se acepta, se conservan junto con su remota. Las locales se recuperan con Deshacer; las remotas, no.

![[eliminar-ramas.png]]

## Trabajar en dos ramas a la vez

*Abrir en un worktree nuevo…* en el menú de una rama la abre en otra carpeta y otra pestaña ([[05 - Flujos de Trabajo/Worktrees y LFS]]).

## Ver solo lo que importa

Oculta ramas con el 👁 o usa *Mostrar solo esta rama* ([[03 - Algoritmos/Filtro de Ramas]]).
