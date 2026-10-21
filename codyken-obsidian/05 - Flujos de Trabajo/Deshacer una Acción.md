---
title: Deshacer una Acción
description: Cómo y cuándo usar Deshacer (⌘Z) y Rehacer (⇧⌘Z) y qué hacer si no están disponibles
type: flujo
tags:
  - flujo
  - deshacer
  - rehacer
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Trabajar con Stashes]]"
related:
  - "[[03 - Algoritmos/Pila de Deshacer]]"
---

# ↩️ Deshacer y rehacer una acción

1. Pasa el ratón por **Deshacer** (primer botón de la barra): el tooltip dice qué se deshará, p. ej. *"Deshacer: Merge de feature/login (⌘Z)"*.
2. Pulsa el botón o ⌘Z (con el foco fuera de un campo de texto).
3. Si la acción usaba historia nueva (merge, pull, rebase, rebase interactivo, cherry-pick, revert, fast-forward, reset hard) Codyken pide confirmación y que no tengas cambios sin confirmar.

Se pueden deshacer varias acciones seguidas (hasta 20), de la más reciente a la más antigua.

## Rehacer

Lo deshecho pasa a **Rehacer** (segundo botón, ⇧⌘Z); su tooltip dice qué se repetirá, p. ej. *"Rehacer: Rebase interactivo de main"*. Rehacer un commit lo vuelve a confirmar y vacía la caja del mensaje. Si haces **cualquier acción nueva**, la pila de rehacer se vacía.

![[rehacer.png]]

También están en la paleta (⌘P) como *Deshacer: …* y *Rehacer: …*.

## Si dice "Ya no se puede"

HEAD cambió por fuera (terminal, otro programa) desde la última acción: la pila se vacía para no deshacer ni rehacer algo distinto de lo que esperas. Alternativas manuales:

- `git reflog` muestra adónde apuntó HEAD; `git reset --hard HEAD@{n}` vuelve a ese punto;
- una rama borrada se recupera con `git branch <nombre> <sha>` (el SHA está en el reflog).

## No tiene deshacer

Descartar cambios, eliminar stashes, push (también el de [[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas|arrastrar y soltar]]) y eliminar ramas del servidor. Por eso piden confirmación.
