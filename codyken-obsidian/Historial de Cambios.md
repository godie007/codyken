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
