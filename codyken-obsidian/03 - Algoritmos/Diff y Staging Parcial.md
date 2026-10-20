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

`buildHunkPatch(file, hunk, seleccionadas | null, reverse)` genera un parche de **un solo hunk**:

| Caso | Líneas `-` no elegidas | Líneas `+` no elegidas |
|---|---|---|
| Preparar (`reverse = false`, se aplica al índice) | pasan a contexto | desaparecen |
| Quitar / descartar (`reverse = true`, se aplica al revés) | desaparecen | pasan a contexto |

Es la misma semántica que `git add -p`. La línea `\ No newline at end of file` se conserva solo si la anterior quedó.

Luego `applyPatch` ejecuta `git apply --recount --whitespace=nowarn [--cached] [--reverse] -`:

| Acción | `cached` | `reverse` |
|---|---|---|
| Preparar bloque/líneas | sí | no |
| Quitar de preparados | sí | sí |
| Descartar del árbol de trabajo | no | sí |

`supportsPartialStaging(file)` lo permite solo en archivos modificados normales: no en nuevos, borrados, renombrados, binarios ni diffs combinados. En esos casos se usa la acción por archivo.

## Resaltado de sintaxis (`lib/highlight.ts`)

- `languageFor(ruta)`: por extensión (js, ts, py, go, rs, java, swift, sh, json, yaml, md, css, html, sql…) o `Makefile`.
- `highlightCode(texto, lenguaje)`: highlight.js por línea con caché (se vacía al pasar 20 000 entradas). Líneas de más de 2000 caracteres no se resaltan (solo se escapan).
