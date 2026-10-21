---
title: Diff y Staging Parcial
description: Parser de diffs, resaltado dentro de la línea, vista dividida y construcción de parches para preparar o descartar líneas
type: algoritmo
tags:
  - algoritmo
  - diff
  - staging
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[03 - Algoritmos/Filtro de Ramas]]"
next: "[[03 - Algoritmos/Pila de Deshacer]]"
related:
  - "[[04 - Interfaz/Diff, Historial y Blame]]"
  - "[[05 - Flujos de Trabajo/Commit por Líneas]]"
---

# ✂️ Diff y Staging Parcial

## Parser (`lib/diff.ts`)

- `parseDiff(texto)` → `DiffFile[]` con cabeceras, flags (`binary`, `combined`, `isNew`, `isDeleted`, `isRename`) y `hunks[]`; cada línea lleva tipo (`' '`, `+`, `-`, `\`) y números de línea viejo/nuevo.
- `pairChangedLines(hunk)` empareja cada `-` con su `+` dentro de un bloque de cambios.
- `intraline(viejo, nuevo)` encuentra el prefijo y sufijo comunes y devuelve el tramo cambiado de cada lado, que se pinta más intenso. Si cambió más del 80 % de la línea no resalta nada (no aportaría).
- `toSplitRows(hunk)` arma las filas izquierda/derecha de la vista dividida.

## Parches (`lib/patch.ts`)

`buildPatch(file, [{ hunk, lines | null }, …], reverse)` genera **un solo parche con todos los bloques elegidos** (y, en cada uno, solo las líneas elegidas; `null` = el bloque entero). `buildHunkPatch(file, hunk, líneas, reverse)` es el caso de un bloque. Si no queda ningún cambio, devuelve `''`.

| Caso | Líneas `-` no elegidas | Líneas `+` no elegidas |
|---|---|---|
| Preparar (`reverse = false`, se aplica al índice) | pasan a contexto | desaparecen |
| Quitar / descartar (`reverse = true`, se aplica al revés) | desaparecen | pasan a contexto |

Es la misma semántica que `git add -p`. La línea `\ No newline at end of file` se conserva solo si la anterior quedó.

Así **el lado sobre el que se aplica queda intacto** (preparar: el lado antiguo; quitar o descartar: el nuevo), su número de línea inicial sigue valiendo y varios hunks pueden ir en el mismo parche sin recalcular posiciones.

### Archivos nuevos, borrados y renombrados

Un parche parcial ya no crea, borra ni renombra el archivo entero, así que la cabecera se adapta (`patchHeader`):

| Caso | Cabecera |
|---|---|
| Archivo nuevo y el lado antiguo del parche queda vacío (preparar líneas de uno sin seguir, o quitar **todas** sus líneas) | se conserva `new file mode` / `--- /dev/null`: crea o saca el archivo entero |
| Archivo borrado y el lado nuevo queda vacío (quitar líneas de un borrado preparado, descartarlas de uno borrado en disco, o el bloque entero) | se conserva `deleted file mode` / `+++ /dev/null` |
| Cualquier otro parcial de un nuevo, borrado o renombrado | cambio de contenido sobre la ruta que existe: `diff --git a/x b/x`, `--- a/x`, `+++ b/x`; un inicio de línea 0 con líneas pasa a 1 |
| Archivo modificado | la cabecera original sin `old mode` / `new mode`: el cambio de permisos solo viaja con el archivo entero |

Ejemplos: quitar 2 líneas de un archivo nuevo preparado lo deja preparado (`A`) sin ellas y con ellas en *Sin preparar* (`AM`); quitar una línea de un renombrado preparado mantiene el renombre y solo devuelve ese contenido.

Luego `applyPatch` ejecuta `git apply --recount --whitespace=nowarn [--cached] [--reverse] -`:

| Acción | `cached` | `reverse` |
|---|---|---|
| Preparar bloque/líneas | sí | no |
| Quitar de preparados | sí | sí |
| Descartar del árbol de trabajo | no | sí |

`supportsPartialStaging(file)` lo permite en cualquier archivo de texto con cambios; solo quedan fuera los binarios y los diffs combinados (conflictos).

## Resaltado de sintaxis (`lib/highlight.ts`)

- `languageFor(ruta)`: por extensión (js, ts, py, go, rs, java, swift, sh, json, yaml, md, css, html, sql…) o `Makefile`.
- `highlightCode(texto, lenguaje)`: highlight.js por línea con caché (se vacía al pasar 20 000 entradas). Líneas de más de 2000 caracteres no se resaltan (solo se escapan).
