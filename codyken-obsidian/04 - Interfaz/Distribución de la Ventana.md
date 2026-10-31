---
title: Distribución de la Ventana
description: Zonas de la ventana de Codyken, barra de acciones, pestañas y pantalla de bienvenida
type: interfaz
tags:
  - interfaz
updated: 2026-10-30
up: "[[00 - Inicio]]"
next: "[[04 - Interfaz/Repositorios Recientes]]"
related:
  - "[[01 - Arquitectura/Visión General]]"
---

# 🪟 Distribución de la Ventana

![[principal.png]]

| Zona | Componente | Contenido |
|---|---|---|
| Pestañas | `App.tsx` | Un repo por pestaña, `+` para otra; se restauran al abrir la app. ⌘T, ⌘W, ⌘1…⌘9, Ctrl+Tab |
| Barra de acciones | `Toolbar.tsx` | Ver tabla de abajo |
| Panel izquierdo | `LeftPanel.tsx` | [[04 - Interfaz/Panel Izquierdo]] |
| Centro | `GraphView` / `DiffView` / `FileHistory` / `BlameView` | El [[04 - Interfaz/Gráfico de Commits\|gráfico]]; lo reemplaza el [[04 - Interfaz/Diff, Historial y Blame\|diff, historial o blame]] (Esc vuelve) |
| Panel derecho | `CommitPanel.tsx` | [[04 - Interfaz/Panel Derecho]] |
| Barra de estado | `RepoView.tsx` | Ruta, rama → remota con ↑/↓, HEAD desacoplado, operación en curso, último fetch, total de commits cargados |

Los paneles laterales se redimensionan arrastrando el borde y se ocultan con ⌘J / ⌘K.

## Barra de acciones

| Botón | Acción | Notas |
|---|---|---|
| ☰ (izquierda) | Mostrar/ocultar panel izquierdo | ⌘J |
| Nombre del repo ▾ | [[04 - Interfaz/Repositorios Recientes\|Repositorios recientes]]: abrir otro repo o quitarlo de la lista | ⇧⌘O |
| Rama ▾ (debajo del nombre) | Menú para cambiar de rama o crear una | |
| **Deshacer** | [[03 - Algoritmos/Pila de Deshacer\|Deshace la última acción]] | Tooltip "Deshacer: …"; ⌘Z |
| **Fetch** | `fetch --all --prune` | ⌘L |
| **Pull** ▾ | Pull en el modo predeterminado; la flecha abre fetch, los tres modos y el modo predeterminado | Globo con commits por bajar |
| **Push** | Push (crea la remota si falta) | Globo con commits por subir |
| **Rama** | Nueva rama desde HEAD | ⌘B |
| **Stash** | Guardar cambios (pide descripción opcional) | |
| **Pop** | Aplicar y eliminar el último stash | Globo con número de stashes |
| Spinner | Acción en curso ("Pull…") | Mientras corre, las demás acciones esperan |
| Terminal | Abre Terminal en la carpeta del repo | |
| **Acciones ⌘P** | [[04 - Interfaz/Paleta y Atajos\|Paleta de comandos]] | |
| ▯ (derecha) | Mostrar/ocultar panel derecho | ⌘K |

## Bienvenida

Sin repo abierto se muestra `Welcome.tsx`: **Abrir repositorio**, **Clonar** (URL HTTPS o SSH y carpeta destino), **Crear repositorio** (`git init`) y la lista de [[04 - Interfaz/Repositorios Recientes|repositorios recientes]] con búsqueda y botones para quitar.

## Avisos

`ToastProvider` muestra éxito, información y error; los errores incluyen la salida real de git. Las preguntas (nombre de rama, etiqueta, stash) usan `PromptProvider` con validación en vivo; las confirmaciones son diálogos nativos.
