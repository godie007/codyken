---
title: Historial de Cambios
description: Cambios relevantes de Codyken por fecha
type: referencia
tags:
  - changelog
updated: 2026-10-20
up: "[[00 - Inicio]]"
---

# 📝 Historial de Cambios

## 2026-10-20 — Rehacer, rebase interactivo, comparar, arrastrar y soltar, PRs, worktrees, LFS y conflictos

### Nuevo
- **Rehacer** (⇧⌘Z, botón en la barra y paleta): todo lo que se deshace se puede rehacer; una acción nueva vacía la pila ([[03 - Algoritmos/Pila de Deshacer]]).
- **Rebase interactivo** desde un commit o llevando una rama encima de otra: reordenar, reescribir, combinar (con o sin mensaje) y descartar, con stash automático y deshacer ([[05 - Flujos de Trabajo/Rebase Interactivo]]).
- **Comparar dos commits o ramas** con ⌘‑clic o desde los menús: commits de cada lado y archivos distintos ([[05 - Flujos de Trabajo/Comparar Commits y Ramas]]).
- **Arrastrar y soltar ramas** con las opciones de un cliente Git visual: fast-forward, merge, rebase, rebase interactivo, push (forzado con lease si divergen), publicar en un remoto y crear pull request; también desde y hacia el panel izquierdo ([[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]]).
- **Pull requests / merge requests** de GitHub y GitLab con `gh` / `glab`: listar, abrir, comparar, checkout y crear ([[05 - Flujos de Trabajo/Pull Requests]]).
- **Worktrees** y **Git LFS** en el panel izquierdo ([[05 - Flujos de Trabajo/Worktrees y LFS]]).
- **Editor de conflictos de tres paneles**: HEAD y entrante alineados, resultado editable y *Guardar y resolver* ([[05 - Flujos de Trabajo/Resolver Conflictos]]).
- Modo captura: `CODYKEN_SNAPSHOT_CONFIRM` y `CODYKEN_SNAPSHOT_MENU` para automatizar diálogos y menús ([[06 - QA y Tests/Modo Captura]]).
- Tests: de 26 a **66** (nuevos `features`, `conflict`, `branches`, `drop`; `recent` ya existía) ([[06 - QA y Tests/Suite de Tests]]).

### Cambios y arreglos
- **Fetch adelanta las ramas locales atrasadas**: antes solo actualizaba `origin/…` y las locales quedaban atrás (`↓n`) aunque hicieras fetch. Ahora las que no tienen commits propios se ponen al día; las divergentes se avisan y el cambio se deshace con ⌘Z ([[05 - Flujos de Trabajo/Sincronizar con el Remoto]]).
- **Antes no se podía soltar una rama sobre una remota** (solo sobre filas con rama local); ahora cualquier etiqueta de rama es destino.
- **Una rama igual en local y en remoto se ve una sola vez**: en el gráfico se une también por la rama que sigue (no solo por el nombre) y en el panel *Remoto* las iguales se agrupan en *n iguales a su rama local* ([[03 - Algoritmos/Etiquetas de Ramas]]).
- El rebase al arrastrar ahora sigue la semántica habitual: **rebase de la rama arrastrada encima del destino** (antes era al revés).
- El merge con referencia completa escribe el mensaje como git (*Merge branch 'x' into y*) en vez de *refs/remotes/…*.
- La lista de pull requests se desplaza por dentro con muchos abiertos; los títulos de sección largos ya no se parten en dos líneas.
- La columna Fecha pasa a 118 px para que quepa *hace 9 minutos*; las fechas del rebase interactivo ya no se parten.
- Editor de conflictos: la columna HEAD muestra la rama actual (antes *HEAD · HEAD*) y la barra cabe en una línea.

## 2026-10-20 — Repositorios recientes

- La lista de repos abiertos pasa de 15 a **50** y ahora se abre desde cualquier pestaña: clic en el nombre del repo o **⇧⌘O** ([[04 - Interfaz/Repositorios Recientes]]).
- Búsqueda por nombre o ruta, navegación con teclado y etiquetas *actual*, *en pestaña* y *no encontrado*.
- Quitar elementos con ✕ o clic derecho, **Quitar no encontrados** y **Vaciar** (con confirmación).
- Restaurar pestañas al iniciar ya no devuelve a la lista los repos que quitaste.
- La lista la escribe solo el proceso principal (`removeRecent`); antes, quitar un reciente justo al abrir otro repo podía perder el recién abierto.

## 2026-10-20 — v0.1.0 (commit `7ed9a5f`, publicado en GitHub)

### Base
- Cliente Electron + React + TypeScript con pestañas, barra de acciones, paneles y barra de estado.
- Capa git completa ([[02 - Capa Git/Operaciones de Escritura]]), vigilancia de archivos y ajustes persistentes.
- Staging por archivo, bloque y línea; diff en tres modos; conflictos; paleta de comandos.

### Apariencia "como GitKraken"
- Tema oscuro **Monokai** fijo y resaltado de sintaxis.
- Gráfico con avatares de iniciales, curvas, línea de la etiqueta al nodo, píldoras remotas punteadas, `+n` desplegable, resumen editable en la fila WIP.
- Panel izquierdo con ojo para ocultar ramas, remotos con servidor, carpetas con contador.
- Vista de archivos en lista o árbol y botón *Preparar todos los cambios*.
- Historial y blame de archivo; **Deshacer** con ⌘Z.

### Probado con un repo real grande
- **Orden cronológico** (`--date-order`): eliminó la "escalera" de 15+ carriles que formaban los merges a ramas de despliegue.
- Rama actual siempre en la **primera columna**.
- El gráfico ya no desborda Autor/Fecha sobre el panel derecho (máx. 8 carriles, columnas más compactas).
- Botón **Fetch** visible en la barra.
- Indicadores local ↔ remoto en el panel izquierdo (☁, 💻, `local`).
- **Stashes en el gráfico** con mensaje limpio.

### Encontrado al documentar con capturas
- Un stash con solo archivos nuevos mostraba 0 archivos → ahora lee el commit de no rastreados.
- `local` aparecía en ramas que sí existen en el remoto sin seguimiento → ahora nube tenue.
- Ocultar una rama local no quitaba sus commits si la remota los seguía mostrando → se oculta con sus remotas.
- Tras deshacer un commit, el panel seguía mostrando el commit eliminado → la selección vuelve al WIP.
