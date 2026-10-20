---
title: Pila de Deshacer
description: Cómo funciona Deshacer (⌘Z): qué acciones registra, cómo se revierten y cuándo se invalida
type: algoritmo
tags:
  - algoritmo
  - deshacer
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[03 - Algoritmos/Diff y Staging Parcial]]"
related:
  - "[[05 - Flujos de Trabajo/Deshacer una Acción]]"
  - "[[02 - Capa Git/Operaciones de Escritura]]"
---

# ↩️ Pila de Deshacer

Vive en `RepoView` (memoria de la pestaña, se pierde al cerrarla). Máximo **20** entradas.

```ts
interface UndoEntry {
  label: string        // "Commit \"Arregla login\"", "Merge de feature/x"…
  head: string | null  // HEAD que dejó la acción
  branch: string | null
  hard: boolean        // el deshacer usa reset --hard
  undo: () => Promise<unknown>
}
```

## Registro

- `runUndoable(label, fn, éxito, makeUndo)`: lee el estado antes, ejecuta, lee el estado después. Si la operación quedó **a medias** (conflicto) o **no movió HEAD ni la rama**, no registra nada.
- `remember(label, undo)`: para acciones que no mueven HEAD (ramas y etiquetas); guarda el estado actual.

| Acción | Cómo se deshace | ¿hard? |
|---|---|---|
| Commit / preparar todo y commit | `reset --soft <HEAD anterior>` y se restaura el mensaje en la caja | no |
| Amend | `reset --soft <commit original>` | no |
| Checkout (rama, remota o commit) | checkout de la rama o commit anterior | no |
| Crear rama | (si hizo checkout, volver) + `branch -D` | no |
| Eliminar rama | recrearla en su commit | no |
| Renombrar rama | renombrar de vuelta | no |
| Crear / eliminar etiqueta | eliminarla / recrearla (ligera) en su commit | no |
| Merge, rebase, pull, cherry-pick, revert | `reset --hard <HEAD anterior>` | **sí** |
| Merge/rebase por arrastre | `reset --hard` del destino + volver a la rama anterior | **sí** |
| Reset soft/mixed/hard | `reset` del mismo modo al HEAD anterior | si fue hard |

## Ejecución (`undoLast`)

1. Lee el estado actual. Si HEAD, la rama o la operación en curso **no coinciden** con lo que dejó la acción (p. ej. trabajaste en la terminal), **vacía la pila** y avisa: *"Ya no se puede deshacer"*.
2. Si la entrada es `hard`: exige no tener cambios rastreados sin confirmar (los archivos nuevos no cuentan) y pide confirmación.
3. Ejecuta el deshacer como cualquier acción (spinner, toast, recarga) y saca la entrada.

> [!warning] Lo que no se puede deshacer
> Descartar cambios, `discardAll`, eliminar stashes, push y eliminar ramas del servidor: git no guarda esos datos o afectan a otros. Por eso piden confirmación.

No hay **rehacer** todavía ([[Hoja de Ruta]]).
