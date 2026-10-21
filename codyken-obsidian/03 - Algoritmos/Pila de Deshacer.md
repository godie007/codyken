---
title: Pila de Deshacer
description: Cómo funcionan Deshacer (⌘Z) y Rehacer (⇧⌘Z) — qué acciones registran, cómo se revierten y se repiten y cuándo se invalidan
type: algoritmo
tags:
  - algoritmo
  - deshacer
  - rehacer
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[03 - Algoritmos/Diff y Staging Parcial]]"
related:
  - "[[05 - Flujos de Trabajo/Deshacer una Acción]]"
  - "[[02 - Capa Git/Operaciones de Escritura]]"
  - "[[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]]"
---

# ↩️ Pila de Deshacer (y de Rehacer)

Viven en `RepoView` (memoria de la pestaña, se pierden al cerrarla): `undoStack` y `redoStack`, máximo **20** entradas (`UNDO_LIMIT`).

```ts
interface UndoEntry {
  label: string        // "Commit \"Arregla login\"", "Merge de feature/x"…
  head: string | null  // en deshacer: HEAD que dejó la acción · en rehacer: el que dejó el deshacer
  branch: string | null
  hard: boolean        // el deshacer usa reset --hard
  undo: () => Promise<unknown>
  redo: (() => Promise<unknown>) | null   // null = no se puede rehacer
  redoHard: boolean    // el rehacer usa reset --hard
}

/** Lo que devuelve makeUndo para una operación que mueve HEAD */
interface UndoPlan {
  undo: () => Promise<unknown>
  hard?: boolean
  mode?: ResetMode         // reset que se usará también al rehacer
  redo?: () => Promise<unknown>   // rehacer a medida
  onRedo?: () => void      // se llama después del rehacer genérico
}
```

## Registro

- `runUndoable(label, fn, éxito, makeUndo)`: lee el estado antes, ejecuta, lee el estado después. Si la operación quedó **a medias** (conflicto) o **no movió HEAD ni la rama**, no registra nada. Si `makeUndo` no da `redo`, el rehacer es el **genérico** `redoTo(después, modo)`: volver a la rama que dejó la operación y hacer `reset` (del modo del plan) al commit que dejó.
- `remember(label, undo, redo)`: para acciones que no mueven HEAD (ramas, etiquetas, fast-forward de otra rama); `redo` repite la acción original.
- `pushUndo` añade la entrada y **vacía la pila de rehacer**: una acción nueva invalida lo que se podía rehacer.

| Acción | Cómo se deshace | Cómo se rehace | ¿hard? |
|---|---|---|---|
| Commit / preparar todo y commit | `reset --soft <HEAD anterior>` y se restaura el mensaje en la caja | genérico (`reset --soft` al commit) y se vacía la caja (`onRedo`) | no |
| Amend | `reset --soft <commit original>` | genérico | no |
| Checkout (rama, remota, commit o PR) | checkout de la rama o commit anterior | genérico | no |
| Crear rama | (si hizo checkout, volver) + `branch -D` | crearla otra vez | no |
| Eliminar rama | recrearla en su commit | `branch -D` | no |
| Renombrar rama | renombrar de vuelta | renombrar otra vez | no |
| Crear / eliminar etiqueta | eliminarla / recrearla (ligera) en su commit | repetir | no |
| Merge, rebase, pull, cherry-pick, revert | `reset --hard <HEAD anterior>` | genérico (hard) | **sí** |
| Rebase interactivo (desde un commit) | `reset --hard <HEAD anterior>` | genérico (hard) | **sí** |
| Rebase interactivo / rebase / merge **por arrastre** | `reset --hard` de la rama reescrita a su commit anterior + volver a la rama en la que estabas | genérico: checkout de esa rama y `reset --hard` | **sí** |
| Fast-forward de la rama actual | `reset --hard <HEAD anterior>` | genérico | **sí** |
| Fast-forward de **otra** rama | `moveBranch` (`branch -f`) a su commit anterior | `moveBranch` al commit nuevo | no |
| Reset soft/mixed/hard | `reset` del mismo modo al HEAD anterior | genérico del mismo modo | si fue hard |

Ver los casos de arrastre en [[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]].

## Ejecución (`undoLast` / `redoLast`)

1. `entryValid` lee el estado actual. Si HEAD, la rama o la operación en curso **no coinciden** con lo que guarda la entrada (p. ej. trabajaste en la terminal), **vacía la pila** (al deshacer, las dos) y avisa: *"Ya no se puede"*.
2. Deshacer `hard`: exige no tener cambios rastreados sin confirmar (los archivos nuevos no cuentan) y pide confirmación. Rehacer con `redoHard`: exige el árbol limpio.
3. Ejecuta como cualquier acción (spinner, toast *"Deshecho: …"* / *"Rehecho: …"*, recarga).
4. Al deshacer, la entrada pasa a `redoStack` con el HEAD que dejó el deshacer (si tiene `redo` y no quedó una operación a medias). Al rehacer, vuelve a `undoStack` con el HEAD nuevo.

> [!warning] Lo que no se puede deshacer
> Descartar cambios, `discardAll`, eliminar stashes, **push** (también el de arrastrar y soltar) y eliminar ramas del servidor: git no guarda esos datos o afectan a otros. Por eso piden confirmación.
