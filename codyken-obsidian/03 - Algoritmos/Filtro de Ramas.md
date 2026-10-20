---
title: Filtro de Ramas
description: Ocultar ramas y modo solo; cómo se guarda, cómo se traduce a git log y por qué se oculta también la remota
type: algoritmo
tags:
  - algoritmo
  - ramas
  - grafico
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[03 - Algoritmos/Stashes en el Gráfico]]"
next: "[[03 - Algoritmos/Diff y Staging Parcial]]"
related:
  - "[[04 - Interfaz/Panel Izquierdo]]"
---

# 👁️ Filtro de Ramas

![[ocultar-ramas.png]]

## Estado

`GraphFilter = { hidden: string[], solo: string[] }` con nombres completos (`refs/heads/feature/pagos`). Se guarda en `settings.graphFilters[<ruta del repo>]`; si queda vacío se borra la entrada.

## Traducción a `git log`

| Modo | Revisiones |
|---|---|
| Sin filtro | `--exclude=refs/stash --all` |
| Ocultar | `--exclude=<cada oculta> … --exclude=refs/stash --all` |
| Solo | `<refs elegidas> HEAD` |

HEAD siempre se dibuja aunque su rama esté oculta, para no perder el punto de trabajo. Las refs se validan con `safeRef` ([[01 - Arquitectura/Seguridad]]).

## Ocultar con su remota

`withUpstream(ref)`: al ocultar una **rama local** se añaden también sus remotas, la del `upstream` y las que se llaman igual en cualquier remoto. Sin esto, `origin/feature/pagos` seguiría trayendo los mismos commits y "ocultar" no tendría efecto visible.

## Alternar

`toggleHidden(refs[])`:

- La rama actual nunca se oculta.
- En modo **ocultar**: si todas las elegidas ya estaban ocultas, se muestran; si no, se ocultan todas.
- En modo **solo**: alterna su pertenencia a la lista *solo*.
- Una ref cuenta como oculta si está en `hidden`, o si hay modo solo y no está en `solo` (salvo HEAD).

## Dónde se ve

Chip naranja **"Ramas filtradas ✕"** en la búsqueda del gráfico, aviso "n ramas ocultas · Mostrar todas" en el panel izquierdo, ojo tachado en cada fila oculta y aviso en la barra de estado. El menú de una rama ofrece *Ocultar / Mostrar en el gráfico*, *Mostrar solo esta rama* y *Mostrar todas las ramas*.
