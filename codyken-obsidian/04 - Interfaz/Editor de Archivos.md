---
title: Editor de Archivos
description: Cómo está hecho el editor (FileEditor.tsx): textarea sobre el resaltado, marcas del margen con Myers, borradores y cambios externos
type: interfaz
tags:
  - interfaz
  - editor
updated: 2026-10-20
up: "[[00 - Inicio]]"
related:
  - "[[05 - Flujos de Trabajo/Editar Archivos]]"
  - "[[02 - Capa Git/Operaciones de Escritura#Editar archivos]]"
  - "[[04 - Interfaz/Diff, Historial y Blame]]"
---

# ✏️ Editor de Archivos

`src/renderer/src/components/FileEditor.tsx`, con la lógica pura en `lib/editing.ts` (sangría, finales de línea, posiciones) y `lib/linediff.ts` (marcas del margen). Uso paso a paso: [[05 - Flujos de Trabajo/Editar Archivos]].

![[editor.png]]

## Dónde se abre

Ocupa el panel central, como el [[05 - Flujos de Trabajo/Resolver Conflictos|editor de conflictos]], y tiene prioridad sobre historial, blame, diff y gráfico. `RepoView` guarda la petición `EditorRequest { path, target, patch?, nonce }`:

- `target`: `'working'` (archivo en disco) o `'index'` (versión preparada).
- `patch`: solo con *Editar y preparar…*; es el parche de las líneas elegidas (`buildHunkPatch`, el mismo de [[03 - Algoritmos/Diff y Staging Parcial|preparar líneas]]).
- `rev` / `revLabel`: solo con *Editar archivo con la versión de…*; el texto inicial es el archivo en ese commit (`proposed`), lo guardado sigue siendo el archivo en disco.

Entradas: botón **Editar** del diff (`unstaged` → archivo, `staged` → preparado), **Editar y preparar…** en cada bloque sin preparar, el menú contextual del archivo (también en la lista de archivos de un commit, stash o comparación: *Editar archivo con la versión de…*) y la paleta.

Con `patch` o `rev` el editor empieza **con cambios sin guardar** (el texto propuesto frente a lo guardado). Tras guardar una versión de un commit, `RepoView` selecciona los cambios de trabajo para que se vea el archivo en *Sin preparar*.

## Texto con colores: un textarea transparente encima

No hay dependencias de editor (CodeMirror, Monaco): un `<pre>` con el resaltado de `highlightCode` línea a línea y, encima, un `<textarea>` con la misma fuente, tamaño, interlineado (20 px), padding y `tab-size`, texto transparente y cursor visible.

- El `<pre>` da el tamaño; el textarea lo cubre (`position: absolute; inset: 0`, `wrap="off"`, `overflow: hidden`), así que nunca tiene scroll propio: el scroll es del contenedor y el margen con los números es `position: sticky` a la izquierda.
- Un espacio al final del `<pre>` hace que la última línea vacía tenga altura.
- El cursor se mantiene visible a mano (`reveal`): vertical por número de línea; horizontal con el ancho medido de un carácter, contando el tabulador como 4.
- Por encima de 200 000 caracteres se dibuja sin colores para que escribir siga fluido.
- Las ediciones de teclado (Tab, ⇧Tab, Enter) se aplican con `document.execCommand('insertText')`, que conserva el deshacer nativo del textarea.

> [!tip] Verificar la alineación
> En el [[06 - QA y Tests/Modo Captura|modo captura]], pintar el textarea con `-webkit-text-fill-color: rgba(255,0,0,.55)`: si está alineado, el rojo cae exactamente sobre el texto resaltado.

## Marcas del margen

`lineMarks(baseline, texto)` en `lib/linediff.ts`:

1. `diffLines` recorta el principio y el final comunes (casi todo en una edición) y aplica **Myers** al resto.
2. Con más de 1000 diferencias deja de buscar el diff mínimo y marca todo el tramo del medio como cambiado (memoria y tiempo acotados).
3. En cada tramo de cambios, las primeras líneas añadidas que reemplazan a borradas son **cambiadas** (naranja), el resto **añadidas** (verde); si solo se borró, un ▸ rojo en el borde de la línea siguiente.

La comparación es con el índice al editar el archivo y con `HEAD` al editar lo preparado, como los diffs *Sin preparar* y *Preparado*. Se calcula con `useDeferredValue`: puede ir un instante por detrás al escribir rápido.

## Guardar sin pisar a nadie

Cada lectura trae `version`: sha1 del archivo o hash del blob del índice. `writeEditable` solo escribe si sigue igual; si no, devuelve `{ ok: false }` y el editor pregunta si reemplazar.

Con cada refresco del estado (vigilancia de archivos, foco de la ventana) el editor vuelve a leer:

| Situación | Qué hace |
|---|---|
| mismo contenido | solo actualiza contra qué compara (por ejemplo, tras preparar) |
| cambió y no tocaste nada | recarga en silencio y conserva el cursor |
| cambió y tienes cambios | aviso: *Recargar y perder mis cambios* o *Mantener los míos* (guardar los impone) |

## Finales de línea y formato

- El textarea normaliza CRLF a LF, así que se edita en LF y al guardar se vuelve al final de línea mayoritario del archivo (`detectEol`).
- La unidad de sangría se deduce del archivo (`detectIndent`: tabulador, 2 o 4 espacios) y se muestra en la barra de estado.

## Cambios sin guardar

- `RepoView` sabe si hay cambios (`onDirty`) y, antes de cerrar el editor, abrir otro archivo, otra vista o seleccionar un commit, pide confirmación (`leaveEditor`).
- Lo escrito se guarda también en un mapa en memoria por repo, versión y ruta: al cambiar de pestaña (el `RepoView` se desmonta) y volver, el editor reabre el mismo archivo y recupera el texto si el archivo no cambió entretanto.
- Con el editor abierto, los atajos de una tecla de la app (`S`, `U`, `J`, `K`) no se aplican y el textarea detiene los demás, salvo ⌘P.
