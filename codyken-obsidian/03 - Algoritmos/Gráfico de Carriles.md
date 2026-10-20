---
title: Gráfico de Carriles
description: Algoritmo computeGraph que asigna columnas a los commits y dibuja las líneas hacia sus padres
type: algoritmo
tags:
  - algoritmo
  - grafico
updated: 2026-10-20
up: "[[00 - Inicio]]"
next: "[[03 - Algoritmos/Etiquetas de Ramas]]"
related:
  - "[[04 - Interfaz/Gráfico de Commits]]"
  - "[[03 - Algoritmos/Stashes en el Gráfico]]"
  - "[[06 - QA y Tests/Suite de Tests]]"
---

# 🛤️ Gráfico de Carriles

Archivo: `src/renderer/src/lib/graph.ts` → `computeGraph(nodes, primary?)`.

## Entrada

Lista de nodos `{ hash, parents, stash? }` **ya ordenada** (más nuevo primero, `--date-order`). Si hay cambios sin confirmar, el primer nodo es el WIP (`WIP_HASH = '__wip__'`) con HEAD como padre. Los stashes van intercalados ([[03 - Algoritmos/Stashes en el Gráfico]]).

## Idea

Se recorre la lista de arriba abajo con un arreglo `lanes[]`: cada carril guarda **el hash del commit que espera encontrar más abajo**.

Para cada nodo:

1. **Carril propio**: si algún carril lo esperaba, toma el primero; si no, ocupa un hueco libre (o uno nuevo) con un color nuevo.
2. **Entradas**: cada carril que lo esperaba dibuja un trazo desde arriba hasta el nodo (así se ven las ramas que confluyen); esos carriles quedan libres.
3. **Primer padre**: continúa en el mismo carril (trazo vertical hacia abajo).
4. **Otros padres** (merges): si ya hay un carril esperándolo, se dibuja hacia él; si no, se abre uno nuevo.
5. **Pasantes**: los carriles que siguen esperando a otro commit dibujan una línea vertical completa.
6. Se recortan los carriles vacíos del final y se actualiza `maxLanes`.

Cada fila resultante es `{ lane, color, segments[] }`; un segmento va de `(x1, y1)` a `(x2, y2)` con `y` entre 0 (arriba de la fila) y 1 (abajo), su color y si es punteado.

## Carril principal reservado

`primary` (el WIP si existe, si no HEAD) reserva el **carril 0** desde el principio, para que la rama actual sea siempre la columna izquierda aunque haya commits más nuevos en otras ramas (como hace GitKraken).

- Mientras ningún commit de arriba apunte a ese carril es un **carril fantasma**: ocupa el sitio pero no se dibuja.
- Deja de ser fantasma cuando llega el propio `primary` o cuando un merge de arriba lo usa como padre. La decisión de dibujar la línea pasante se toma con el estado **al inicio de la fila** (`rowPhantom`), para que en la fila del merge solo se dibuje desde el punto de unión.
- Si `primary` no está en la lista (filtrado o más allá de la página), no se reserva nada.

## Punteados

El WIP y los stashes marcan su carril como punteado hasta llegar a su padre (`dashedLanes`).

## Dibujo (`GraphView.tsx` → `RowGraph`)

| Constante | Valor |
|---|---|
| Alto de fila `ROW_H` | 34 px |
| Ancho de carril `LANE_W` | 24 px |
| Radio del nodo `NODE_R` | 11 px |
| Carriles visibles `MAX_VISIBLE_LANES` | 8 (los demás se recortan, el gráfico no empuja otras columnas) |

`railPath` dibuja curvas: un trazo que **entra** baja en vertical y gira en horizontal hacia el nodo; uno que **sale** va en horizontal y luego baja. Esquinas con radio de hasta 10 px.

Tipos de nodo: commit normal = círculo con las **iniciales del autor**; merge = punto de radio 5; HEAD = anillo extra; WIP = círculo punteado; stash = cuadrado punteado con dos rayas.

## Colores

`LANE_COLORS` (Monokai): `#66d9ef #a6e22e #f92672 #fd971f #ae81ff #e6db74 #78dce8 #ff6188 #a9dc76 #fc9867`, en ciclo.
