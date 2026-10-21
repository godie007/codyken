---
title: Editar Archivos
description: Paso a paso para editar un archivo, editar la versión preparada y retocar unas líneas antes de prepararlas
type: flujo
tags:
  - flujo
  - editor
  - staging
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Commit por Líneas]]"
related:
  - "[[04 - Interfaz/Editor de Archivos]]"
  - "[[03 - Algoritmos/Diff y Staging Parcial]]"
  - "[[02 - Capa Git/Operaciones de Escritura#Editar archivos]]"
---

# ✏️ Editar Archivos

Codyken puede editar dos cosas distintas del mismo archivo:

| Qué editas | Qué cambia | Para qué |
|---|---|---|
| **Archivo** (de trabajo) | el archivo en disco | arreglar algo sin salir de Codyken |
| **Preparado** (el índice) | solo lo que entrará en el commit; el disco no cambia | dejar fuera de un commit un `console.log`, un texto provisional o media línea, sin tocar tu copia de trabajo |

La técnica del editor (margen, recarga, borradores) está en [[04 - Interfaz/Editor de Archivos]].

## Editar el archivo

1. Abre el diff de un archivo de **Sin preparar** o **Preparados** (panel derecho).
2. **Editar** en la barra del diff. También: clic derecho en el archivo → *Editar archivo*, o la paleta (⌘P → *Editar …*).
3. Cambia lo que necesites. El margen marca respecto a lo preparado: **verde** añadido, **naranja** cambiado, **▸ rojo** donde se borraron líneas.
4. **⌘S** o *Guardar*. *Guardar y preparar* guarda y prepara el archivo entero.
5. **Esc** o ✕ cierra; si hay cambios sin guardar, pregunta antes.

![[editor.png]]

## Recuperar la versión de un commit

Para volver un archivo a como estaba en un commit (entero o retocado) sin `git checkout <commit> -- archivo` a ciegas.

1. Selecciona el commit en el gráfico (también vale un stash o una comparación).
2. En su lista de archivos, clic derecho en el archivo → **Editar archivo con la versión de abc1234…**. Si el commit borró el archivo, se toma la versión de justo antes.
3. Se abre **tu archivo** con el contenido de ese commit. El margen compara con lo preparado, así que ves lo que va a cambiar. Si el archivo tenía cambios sin preparar, un aviso dice que se reemplazarán.
4. Ajusta lo que quieras y **Guardar** (⌘S). El archivo queda en **Sin preparar**, como cualquier cambio, y el panel derecho pasa a los cambios de trabajo. *Guardar y preparar* lo deja además preparado.
5. Si te arrepientes, *Descartar* en el archivo, como siempre. Cerrar sin guardar no cambia nada.

![[editar-version.png]]

## Editar la versión preparada

1. Con el editor abierto, cambia a **Preparado** arriba (o, desde un archivo de *Preparados*, pulsa *Editar*; o clic derecho → *Editar la versión preparada*).
2. Edita: lo que ves es exactamente lo que entrará en el commit. El margen ahora compara con el **último commit**.
3. **Preparar esta versión** (⌘S). Vuelves al diff *Preparado* del archivo para ver el resultado; el archivo en disco sigue como estaba, así que lo que no preparaste aparece en *Sin preparar*.

## Retocar unas líneas antes de prepararlas

Es el caso de *preparar unas líneas*, pero pudiendo cambiarlas.

1. En el diff **Sin preparar**, haz clic en las líneas que quieres (Mayús+clic para un rango). Sin selección vale el bloque entero.
2. **Editar y preparar…** en la cabecera del bloque.
3. Se abre la **versión preparada con esas líneas ya puestas** (calculada en una copia del índice: todavía no se preparó nada). El cursor está en la primera línea cambiada.
4. Ajusta el texto, por ejemplo cambia `'La cantidad debe ser positiva'` por `'Cantidad no válida'` solo para este commit.
5. **Preparar esta versión**.

![[editar-preparar.png]]

> [!example] Resultado
> En *Preparados* queda la línea con el texto retocado; en *Sin preparar*, la diferencia entre tu archivo y lo preparado (el texto original y el resto de cambios). Si cierras sin preparar, no cambió nada.

## Atajos del editor

| Acción | Atajo |
|---|---|
| Guardar / preparar esta versión | ⌘S |
| Ir a una línea | ⌘G |
| Sangrar / quitar sangría (también varias líneas) | Tab / ⇧Tab |
| Nueva línea con la misma sangría | Enter |
| Seleccionar la línea entera | clic en su número (⇧clic amplía) |
| Deshacer lo escrito | ⌘Z (el del propio texto; el ⌘Z de la app no se dispara mientras escribes) |
| Volver a lo guardado | ↶ en la barra |
| Cerrar | Esc |

## Qué no se puede editar

Binarios, archivos de más de 2 MB o que no estén en UTF‑8 (guardarlos cambiaría su codificación), enlaces simbólicos, submódulos, archivos en conflicto (para eso está [[05 - Flujos de Trabajo/Resolver Conflictos|el editor de conflictos]]) y, en la versión preparada, archivos de Git LFS (el índice solo guarda el puntero). Ver [[Limitaciones Conocidas]].
