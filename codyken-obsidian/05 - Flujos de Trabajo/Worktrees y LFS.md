---
title: Worktrees y LFS
description: Trabajar en varias ramas a la vez con git worktree y manejar archivos grandes con Git LFS
type: flujo
tags:
  - flujo
  - worktrees
  - lfs
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Pull Requests]]"
next: "[[05 - Flujos de Trabajo/Trabajar con Stashes]]"
related:
  - "[[04 - Interfaz/Panel Izquierdo#Worktrees]]"
  - "[[02 - Capa Git/Operaciones de Escritura]]"
---

# 🌲 Worktrees y 🗄️ Git LFS

## Worktrees

Un worktree es otra carpeta del mismo repo con otra rama activa: trabajas en paralelo sin stash ni checkout.

- **Ver**: sección *Worktrees* del panel izquierdo (`git worktree list --porcelain` → `parseWorktrees`). Cada uno muestra su carpeta, su rama (o *desacoplado en abc1234*, *bare*) y etiquetas *principal*, *bloqueado* o *no existe*. El de la pestaña actual lleva ✓.
- **Crear** (**+** de la sección, la paleta → *Nuevo worktree…* o el menú de una rama → *Abrir en un worktree nuevo…*):
  1. eliges la carpeta padre;
  2. escribes la rama y marcas *Crear una rama nueva desde HEAD* si no existe;
  3. se crea `<padre>/<repo>-<rama>` (`git worktree add [-b rama] -- <ruta> [HEAD|rama]`) y **se abre en una pestaña** (queda en [[04 - Interfaz/Repositorios Recientes|recientes]]).
- **Abrir**: doble clic o menú → *Abrir en una pestaña*.
- **Eliminar**: menú → *Eliminar worktree…* (borra la carpeta, conserva la rama). Si tiene cambios sin confirmar, pide confirmar de nuevo y usa `--force`. El principal y el de la pestaña actual no se pueden eliminar.
- **Limpiar**: si la carpeta ya no existe, *Limpiar worktrees que ya no existen* (`git worktree prune`).

`addWorktree` exige ruta absoluta, que la carpeta no exista y que la padre sí; `removeWorktree` solo acepta rutas que `git worktree list` conoce.

## Git LFS

La sección *Git LFS* aparece si `git-lfs` está instalado o si el repo tiene patrones LFS en `.gitattributes`.

- **Patrones seguidos**: `git lfs track` (`parseLfsTrack`), con el archivo de origen si no es `.gitattributes`.
- **Archivos**: `git lfs ls-files --long` (`parseLfsFiles`): *n archivos en LFS · m sin descargar* y botón **Descargar** (`git lfs pull`, también en la paleta).
- **Seguir un tipo** (**+** o paleta): `git lfs track -- <patrón>`; luego hay que hacer commit de `.gitattributes`. Clic derecho en un patrón → *Dejar de seguir* (`git lfs untrack`). Los patrones que empiezan por `-` se rechazan.
- **Sin git-lfs instalado**: se leen los patrones de `.gitattributes` (`parseLfsAttributes`, líneas con `filter=lfs`) y el panel avisa de que verás punteros en lugar de archivos, con cómo instalarlo.

> [!warning] Sin probar en vivo
> `git-lfs` **no estaba instalado** en el equipo de desarrollo: las rutas de LFS están cubiertas por los tests de los parsers y por el aviso de *no instalado* (verificado visualmente), pero `track`, `untrack` y `pull` no se ejecutaron contra un git-lfs real. Ver [[Limitaciones Conocidas]].
