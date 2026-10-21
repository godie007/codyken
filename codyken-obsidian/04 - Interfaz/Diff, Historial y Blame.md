---
title: Diff, Historial y Blame
description: Vista de diff (modos, selección de líneas, conflictos), historial de un archivo y blame
type: interfaz
tags:
  - interfaz
  - diff
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[04 - Interfaz/Panel Derecho]]"
next: "[[04 - Interfaz/Paleta y Atajos]]"
related:
  - "[[03 - Algoritmos/Diff y Staging Parcial]]"
---

# 🔍 Diff, Historial y Blame

## Diff (`DiffView.tsx`)

Barra superior: icono de estado, ruta, origen ("Sin preparar", "Preparado", "Commit abc1234"), acciones del archivo, **Editar**, modo, ajuste de líneas, **Historial** y **Blame** (iconos) y cerrar (Esc).

| Modo | Qué muestra |
|---|---|
| **Bloques** | Solo los hunks con 3 líneas de contexto |
| **Archivo** | El archivo completo con los cambios marcados |
| **Dividido** | Antes y después lado a lado, con líneas emparejadas |

- Resaltado de sintaxis Monokai y del **tramo cambiado** dentro de cada línea modificada.
- **Selección de líneas** (sin preparar o preparado), también en la vista *Dividido* y en archivos nuevos, borrados o renombrados: clic en líneas `+`/`−`, Mayús+clic para un rango, en uno o varios bloques. Cada bloque ofrece *Preparar n líneas* / *Descartar n líneas* (o *Quitar n líneas*); sin selección actúa sobre el bloque entero.
- **+ / − sobre el número de línea**: al pasar el ratón por una línea cambiada aparece **+** (en *Sin preparar*: la prepara) o **−** (en *Preparado*: la quita y vuelve a *Sin preparar*). Si la línea está en la selección, actúa sobre toda la selección. Mientras se aplica, otro clic se ignora para no usar números de línea viejos.
- Con líneas elegidas aparece una **barra de selección** (*n líneas seleccionadas en m bloques*) con las mismas acciones para toda la selección de una vez, *Editar y preparar…* y *Deseleccionar*. **S** prepara la selección (en *Sin preparar*), **U** la quita (en *Preparado*) y **Esc** la limpia sin cerrar el diff. Lo que se quita de lo preparado vuelve a *Sin preparar*.
- Acciones de archivo: *Preparar archivo*, *Descartar archivo*, *Quitar archivo*.
- **Editar** abre el [[04 - Interfaz/Editor de Archivos|editor]]: el archivo desde *Sin preparar*, la versión preparada desde *Preparado*. En los bloques sin preparar, **Editar y preparar…** abre la versión preparada con ese bloque (o las líneas elegidas) para retocarlo antes de prepararlo ([[05 - Flujos de Trabajo/Editar Archivos]]). En los archivos de un commit, el clic derecho ofrece *Editar archivo con la versión de…* ([[05 - Flujos de Trabajo/Editar Archivos#Recuperar la versión de un commit]]).
- Diffs de más de 6000 líneas se cortan con botón **Mostrar todo**; los binarios muestran un aviso; el máximo absoluto es 8 MB.
- El diff abierto sigue al archivo: si lo preparas pasa a la vista "Preparado" y viceversa.

### Conflictos

Un archivo en conflicto no abre el diff sino el **editor de tres paneles** (`MergeEditor.tsx`): HEAD y entrante arriba, alineados, y el resultado abajo, con casillas por conflicto, *Todo HEAD / Todo entrante*, *Editar a mano* y **Guardar y resolver**. Si es binario o los marcadores no se pueden leer, ofrece **Usar versión HEAD** (`checkout --ours`) o **Usar versión entrante** (`--theirs`). Ver [[05 - Flujos de Trabajo/Resolver Conflictos]].

## Historial de un archivo (`FileTools.tsx` → `FileHistory`)

![[historial.png]]

- Hasta 500 commits que tocaron el archivo, **siguiendo renombres** ("renombrado desde …").
- A la derecha, el diff del commit seleccionado (mismos modos).
- Doble clic en un commit lo selecciona en el gráfico. Botón **Blame** para pasar al blame.

## Blame (`FileTools.tsx` → `BlameView`)

![[blame.png]]

- Cada bloque de líneas consecutivas del mismo commit muestra avatar, asunto, autor y fecha; una barra del color del commit recorre el bloque.
- Al pasar el ratón se resaltan todas las líneas de ese commit; clic abre el commit en el gráfico.
- Las líneas **sin confirmar** se marcan aparte.
- Desde el diff de un commit, el blame se hace **en ese commit** (o en su padre si el archivo se borró); desde los cambios pendientes, sobre la versión actual.
- Muestra hasta 8000 líneas.
