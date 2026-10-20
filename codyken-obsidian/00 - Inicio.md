---
title: Codyken — Inicio
description: Punto de entrada (MOC) a la documentación de Codyken; un enlace por nota vigente
type: moc
updated: 2026-10-20
tags:
  - moc
  - codyken
aliases:
  - Inicio
  - Index
  - Home
  - MOC
---

# 🧭 Codyken — Mapa de la documentación

> [!info] ¿Qué es Codyken?
> Cliente **Git de escritorio** para macOS hecho con **Electron + React + TypeScript**, con tema oscuro **Monokai**. Toma como referencia la distribución y las funciones de GitKraken (solo desde su documentación pública) para usarlo a diario sin extrañarlo. No reimplementa Git: ejecuta el `git` instalado en el equipo.
> Repositorio: [github.com/godie007/codyken](https://github.com/godie007/codyken).

> [!quote] Convención
> **El código es la fuente de verdad.** Si una nota lo contradice, se corrige la nota y se actualiza su `updated:`. Las rutas citadas son relativas a la raíz del repo (`src/main/git.ts`, etc.).

![[principal.png]]

## 🚀 Para empezar

| Si eres… | Empieza por |
|---|---|
| Nuevo en Codyken | [[01 - Arquitectura/Visión General\|Visión General]] · [[04 - Interfaz/Distribución de la Ventana\|Distribución de la ventana]] · [[Glosario]] |
| Desarrollador | [[Desarrollo]] · [[01 - Arquitectura/Stack Tecnológico\|Stack]] · [[01 - Arquitectura/Procesos e IPC\|Procesos e IPC]] · [[02 - Capa Git/Ejecución de git\|Capa Git]] |
| Quien usa la app | [[05 - Flujos de Trabajo/Commit por Líneas\|Commit por líneas]] · [[05 - Flujos de Trabajo/Sincronizar con el Remoto\|Sincronizar]] · [[04 - Interfaz/Paleta y Atajos\|Atajos]] |
| QA | [[06 - QA y Tests/Suite de Tests\|Suite de tests]] · [[06 - QA y Tests/Modo Captura\|Modo captura]] · [[06 - QA y Tests/Verificación Visual\|Verificación visual]] |

## 🏛️ 01 — Arquitectura

- [[01 - Arquitectura/Visión General|Visión General]]
- [[01 - Arquitectura/Stack Tecnológico|Stack Tecnológico]]
- [[01 - Arquitectura/Procesos e IPC|Procesos e IPC]]
- [[01 - Arquitectura/Modelo de Datos|Modelo de Datos]]
- [[01 - Arquitectura/Seguridad|Seguridad]]

## 🔧 02 — Capa Git (proceso principal)

- [[02 - Capa Git/Ejecución de git|Ejecución de git]] — cómo se lanza `git`, entorno y validación de argumentos
- [[02 - Capa Git/Lectura del Repositorio|Lectura del repositorio]] — log, refs, estado, status, stashes, diff, historial, blame
- [[02 - Capa Git/Operaciones de Escritura|Operaciones de escritura]] — staging, commit, ramas, remotos, stash, conflictos
- [[02 - Capa Git/Vigilancia y Refresco|Vigilancia y refresco]] — `fs.watch` y recarga de datos
- [[02 - Capa Git/Ajustes Persistentes|Ajustes persistentes]] — `settings.json`

## 🧮 03 — Algoritmos

- [[03 - Algoritmos/Gráfico de Carriles|Gráfico de carriles]]
- [[03 - Algoritmos/Etiquetas de Ramas|Etiquetas de ramas]]
- [[03 - Algoritmos/Stashes en el Gráfico|Stashes en el gráfico]]
- [[03 - Algoritmos/Filtro de Ramas|Filtro de ramas]]
- [[03 - Algoritmos/Diff y Staging Parcial|Diff y staging parcial]]
- [[03 - Algoritmos/Pila de Deshacer|Pila de deshacer]]

## 🎨 04 — Interfaz

- [[04 - Interfaz/Distribución de la Ventana|Distribución de la ventana]]
- [[04 - Interfaz/Gráfico de Commits|Gráfico de commits]]
- [[04 - Interfaz/Panel Izquierdo|Panel izquierdo]]
- [[04 - Interfaz/Panel Derecho|Panel derecho]]
- [[04 - Interfaz/Diff, Historial y Blame|Diff, historial y blame]]
- [[04 - Interfaz/Paleta y Atajos|Paleta y atajos]]
- [[04 - Interfaz/Tema Monokai|Tema Monokai]]

## 🔁 05 — Flujos de trabajo

- [[05 - Flujos de Trabajo/Commit por Líneas|Commit por líneas]]
- [[05 - Flujos de Trabajo/Sincronizar con el Remoto|Sincronizar con el remoto]]
- [[05 - Flujos de Trabajo/Ramas y Merge|Ramas, merge y rebase]]
- [[05 - Flujos de Trabajo/Resolver Conflictos|Resolver conflictos]]
- [[05 - Flujos de Trabajo/Trabajar con Stashes|Trabajar con stashes]]
- [[05 - Flujos de Trabajo/Deshacer una Acción|Deshacer una acción]]

## 🧪 06 — QA y tests

- [[06 - QA y Tests/Suite de Tests|Suite de tests]]
- [[06 - QA y Tests/Modo Captura|Modo captura]]
- [[06 - QA y Tests/Verificación Visual|Verificación visual]]

## 📚 Transversales

- [[Desarrollo]] — instalar, ejecutar, compilar, estructura del código
- [[Decisiones]] — por qué se hizo así (registro de decisiones)
- [[Limitaciones Conocidas]]
- [[Hoja de Ruta]]
- [[Historial de Cambios]]
- [[Glosario]]
