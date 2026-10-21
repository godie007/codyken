---
title: Trabajar con Stashes
description: Guardar cambios temporalmente, verlos en el gráfico, aplicarlos y eliminarlos
type: flujo
tags:
  - flujo
  - stash
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Worktrees y LFS]]"
next: "[[05 - Flujos de Trabajo/Deshacer una Acción]]"
related:
  - "[[03 - Algoritmos/Stashes en el Gráfico]]"
---

# 📦 Trabajar con Stashes

![[stash.png]]

## Guardar

**Stash** en la barra (o paleta → *Guardar cambios en el stash…*), con descripción opcional. Guarda preparados, sin preparar **y archivos nuevos** (`stash push -u`) y deja el árbol limpio.

## Encontrarlo

- En el **gráfico**: cuadrado punteado colgado del commit donde lo guardaste, con su mensaje en cursiva.
- En el **panel izquierdo** → *Stashes* (clic lleva al nodo del gráfico).
- Los automáticos se llaman "WIP en {rama}: {asunto del commit base}".

## Revisarlo

Clic en el stash: el panel derecho lista sus archivos (incluidos los nuevos) y clic en uno abre su diff.

## Aplicar o eliminar

| Acción | Efecto |
|---|---|
| **Pop** (barra, con el número de stashes) | Aplica el **último** stash y lo elimina |
| **Aplicar y eliminar (pop)** | Igual, para el stash seleccionado |
| **Aplicar** | Aplica y lo conserva |
| **Eliminar** | Lo borra (con confirmación; no se puede deshacer) |

Si al aplicar hay conflictos, git lo conserva aunque fuera *pop*; ver [[05 - Flujos de Trabajo/Resolver Conflictos]].
