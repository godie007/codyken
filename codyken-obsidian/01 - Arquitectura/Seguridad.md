---
title: Seguridad
description: Aislamiento del renderer, validación de argumentos de git, credenciales y CSP
type: arquitectura
tags:
  - arquitectura
  - seguridad
updated: 2026-10-20
up: "[[01 - Arquitectura/Visión General]]"
prev: "[[01 - Arquitectura/Modelo de Datos]]"
related:
  - "[[01 - Arquitectura/Procesos e IPC]]"
  - "[[02 - Capa Git/Ejecución de git]]"
---

# 🛡️ Seguridad

## Renderer aislado

- `contextIsolation: true`, `sandbox: true`, sin `nodeIntegration`: el renderer no tiene Node.
- Solo existe un método de comunicación (`invoke`) y el main acepta únicamente los métodos de la lista `handlers` y solo desde la ventana principal ([[01 - Arquitectura/Procesos e IPC]]).
- Solo se opera sobre repos abiertos explícitamente (`knownRepos`).
- CSP en `index.html`: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:` (más `ws://localhost:*` para la recarga en desarrollo).
- Navegación bloqueada; `window.open` se deniega y solo los enlaces `https://` se abren en el navegador del sistema.
- El HTML resaltado del diff y del blame lo produce highlight.js, que **escapa el contenido**; si no hay lenguaje se escapa a mano (`lib/highlight.ts`).

## Ejecución de git

- `spawn('git', args)` **sin shell**: los argumentos van en un arreglo, no hay interpolación de cadenas.
- `assertArg` rechaza valores vacíos, que empiezan por `-` (inyección de opciones) o con `\0`.
- Nombres de rama y etiqueta pasan por `git check-ref-format`.
- Las refs del [[03 - Algoritmos/Filtro de Ramas|filtro del gráfico]] deben empezar por `refs/heads/`, `refs/remotes/` o `refs/tags/` y no contener `..` (`safeRef`).
- `readWorkingFile` impide leer fuera del repositorio y limita a 8 MB; `saveConflictResolution` impide escribir fuera de él.
- `pushBranch` valida los dos nombres de rama con `check-ref-format` y que el remoto exista; los patrones de LFS no pueden empezar por `-`.
- El rebase interactivo pasa su lista con `GIT_SEQUENCE_EDITOR="cp '<lista>'"` sobre una carpeta de `mkdtemp` (se rechaza si la ruta contiene `'`); los mensajes nuevos se leen de archivos, nunca se interpolan en la línea de comandos.
- `gh`, `glab` y `ssh -G` también se lanzan sin shell, con límite de 30 s y sin preguntas interactivas (`integrations.ts`).

## Credenciales

- `GIT_TERMINAL_PROMPT=0` y `GIT_SSH_COMMAND='ssh -o BatchMode=yes'`: si git necesita usuario o clave, **falla con el error real** en vez de quedarse colgado esperando una terminal.
- Codyken no guarda credenciales: usa las del sistema (llavero de macOS, agente SSH, `~/.ssh/config`) y, para pull requests, la sesión de `gh` / `glab`.

## Operaciones peligrosas

Piden confirmación con diálogo nativo: reset (y en *hard* se marca destructivo), descartar cambios, eliminar ramas/etiquetas/stashes, eliminar ramas del servidor, checkout desacoplado, rebase (también al soltar una rama sobre otra), eliminar worktrees y push forzado (siempre `--force-with-lease`, nunca `--force`; también el de [[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas|arrastrar y soltar]]).
