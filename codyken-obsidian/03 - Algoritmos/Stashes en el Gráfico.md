---
title: Stashes en el Gráfico
description: Cómo se intercalan los stashes como nodos del gráfico y cómo se muestran sus archivos
type: algoritmo
tags:
  - algoritmo
  - stash
  - grafico
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[03 - Algoritmos/Etiquetas de Ramas]]"
next: "[[03 - Algoritmos/Filtro de Ramas]]"
related:
  - "[[05 - Flujos de Trabajo/Trabajar con Stashes]]"
  - "[[03 - Algoritmos/Gráfico de Carriles]]"
---

# 📦 Stashes en el Gráfico

Un stash en git es un commit con 2 o 3 padres: el **commit base** (HEAD cuando se guardó), el estado del **índice** y, con `-u`, un commit raíz con los **archivos nuevos**. El log nunca los incluye (`--exclude=refs/stash`): mostrar esos commits internos ensuciaría el gráfico.

## Intercalado (`RepoView` → `graphCommits`)

Para cada `StashEntry` cuyo `base` está en los commits cargados:

1. Posición: **justo encima de su commit base**, como si fuera un commit hijo de él (`withStashes` en `lib/graph.ts`). Antes se ubicaba por fecha y podía quedar decenas de filas por encima de su base, lejos de donde estaban los cambios.
2. Se inserta un `Commit` sintético `{ hash, parents: [base], author, email, date, subject: message, stash: index }`; si varios caen en el mismo sitio, el más nuevo primero.

`computeGraph` lo trata como el WIP: carril propio y **trazo punteado** hasta la base. `RowGraph` lo dibuja como cuadrado punteado; el mensaje va en cursiva con el icono de stash.

**Bases huérfanas.** Si la rama donde se guardó el stash se borró o se rebaseó, su base ya no es alcanzable desde ninguna rama ni etiqueta y `--all` no la traería. `getLog` busca esas bases (`for-each-ref --contains` vacío) y las añade al log, así el stash también aparece con la historia que lo sostiene. Las bases que siguen en alguna rama no se añaden, para no saltarse el filtro de ramas ocultas.

Si la base no está cargada (más allá de la página o en una rama oculta), el stash no se dibuja; sigue en el [[04 - Interfaz/Panel Izquierdo|panel izquierdo]].

## Selección y acciones

- Clic → `selection = { kind: 'stash', index, hash }`; el panel derecho muestra el detalle y **Aplicar y eliminar (pop)**, **Aplicar**, **Eliminar**.
- Clic derecho → el menú del stash (no el de commit). Doble clic no hace nada (para no aplicar por accidente).
- Elegirlo en el panel izquierdo desplaza el gráfico hasta su fila.

## Archivos del stash

`getCommitDetail` compara el stash con su primer padre. Si tiene **3 padres** y el tercero no tiene padres (firma del commit de no rastreados), añade sus archivos con estado `?` y `commit = <tercer padre>`. Al abrirlos, el diff se pide contra ese commit (`parent: null`), porque los archivos nuevos no están en el diff normal del stash.
