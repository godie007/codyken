---
title: Deshacer una Acción
description: Cómo y cuándo usar Deshacer (⌘Z) y qué hacer si no está disponible
type: flujo
tags:
  - flujo
  - deshacer
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Trabajar con Stashes]]"
related:
  - "[[03 - Algoritmos/Pila de Deshacer]]"
---

# ↩️ Deshacer una Acción

1. Pasa el ratón por **Deshacer** (primer botón de la barra): el tooltip dice qué se deshará, p. ej. *"Deshacer: Merge de feature/login (⌘Z)"*.
2. Pulsa el botón o ⌘Z (con el foco fuera de un campo de texto).
3. Si la acción usaba historia nueva (merge, pull, rebase, cherry-pick, revert, reset hard) Codyken pide confirmación y que no tengas cambios sin confirmar.

Se pueden deshacer varias acciones seguidas (hasta 20), de la más reciente a la más antigua.

## Si dice "Ya no se puede deshacer"

HEAD cambió por fuera (terminal, otro programa) desde la última acción: la pila se vacía para no deshacer algo distinto de lo que esperas. Alternativas manuales:

- `git reflog` muestra adónde apuntó HEAD; `git reset --hard HEAD@{n}` vuelve a ese punto;
- una rama borrada se recupera con `git branch <nombre> <sha>` (el SHA está en el reflog).

## No tiene deshacer

Descartar cambios, eliminar stashes, push y eliminar ramas del servidor. Por eso piden confirmación.
