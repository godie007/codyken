---
title: Repositorios Recientes
description: Lista de repositorios abiertos alguna vez, desplegable de la barra (⇧⌘O), bienvenida y cómo quitar elementos
type: interfaz
tags:
  - interfaz
  - repositorios
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[04 - Interfaz/Distribución de la Ventana]]"
next: "[[04 - Interfaz/Gráfico de Commits]]"
related:
  - "[[02 - Capa Git/Ajustes Persistentes]]"
  - "[[04 - Interfaz/Paleta y Atajos]]"
---

# 🗂️ Repositorios Recientes

Cada repo que abres, clonas o creas queda en una lista para volver a cargarlo con un clic. La lista guarda hasta **50** repos, del más reciente al más antiguo, y se puede depurar a mano.

![[repos-recientes.png]]

## Dónde aparece

| Lugar | Cómo se abre |
|---|---|
| **Desplegable de la barra** (`RepoSwitcher`) | Clic en el nombre del repo (arriba a la izquierda) o **⇧⌘O**; también *Repositorios recientes…* en la paleta |
| **Bienvenida** (`Welcome`) | En una pestaña nueva (⌘T), debajo de Abrir / Clonar / Crear |
| **Paleta** (⌘P) | Grupo *Abrir*: un elemento por repo reciente |

Los dos primeros usan el mismo componente, `RepoList` (`src/renderer/src/components/RepoList.tsx`).

![[bienvenida.png]]

## Cada fila

- Nombre del repo y su ruta (con `~` en vez de la carpeta de usuario); el tooltip muestra la ruta completa.
- Etiqueta **actual** (el repo de esta pestaña), **en pestaña** (abierto en otra pestaña) o **no encontrado** (la carpeta ya no tiene `.git`: se movió o se borró).
- Clic o Enter: abre el repo. Si ya tiene pestaña, salta a ella; si la pestaña actual está vacía, lo abre ahí; si no, en una nueva.
- Un repo **no encontrado** no se intenta abrir: pregunta si quitarlo de la lista.
- Clic derecho: *Abrir* / *Ir a su pestaña*, *Copiar ruta*, *Quitar de la lista*.

## Quitar elementos

| Acción | Efecto |
|---|---|
| **✕** en la fila (visible al pasar el ratón o con la fila elegida) | Quita ese repo |
| Clic derecho → *Quitar de la lista* | Igual |
| **Quitar no encontrados (n)** | Quita de una vez los repos cuya carpeta ya no existe (solo aparece si hay alguno) |
| **Vaciar** | Borra toda la lista, con confirmación |

> [!note] Solo se toca la lista
> Quitar un repo **no borra nada en disco** ni cierra su pestaña. Si lo vuelves a abrir, regresa al principio de la lista. Al reiniciar la app, las pestañas restauradas **no** vuelven a añadir los repos que quitaste.

## Búsqueda y teclado

- Campo *Buscar por nombre o ruta…*: búsqueda aproximada (`lib/repos.ts` → `matchRepos`), que prioriza el nombre del repo sobre la ruta; sin texto conserva el orden de uso.
- ↑ / ↓ eligen fila, **Enter** abre, **Esc** borra la búsqueda y, si ya está vacía, cierra el desplegable.
- El desplegable se cierra también al hacer clic fuera, al abrir un repo o con ⇧⌘O otra vez.
- Pie del desplegable: **Abrir repositorio…** (⌘O, diálogo de carpeta) y **Clonar o crear…** (abre una pestaña nueva con esas opciones).

## Cómo funciona

| Pieza | Archivo | Qué hace |
|---|---|---|
| `pushRecent` / `withoutRecent` | `src/shared/recent.ts` | Sube un repo al principio sin duplicados (máx. `MAX_RECENT = 50`) / quita rutas conservando el orden |
| `addRecent`, `removeRecent`, `getRecentRepos` | `src/main/settings.ts` | Escriben `recent` en `settings.json`; `getRecentRepos` añade `exists` mirando si existe `<ruta>/.git` |
| `resolveRepo(path, addToRecent)` | `src/main/index.ts` | Al abrir desde la interfaz añade a la lista; al restaurar pestañas (`App.tsx`) pasa `false` |
| `removeRecent(paths)` | API IPC | El renderer pide quitar y recibe la lista nueva, así no compite con el guardado diferido de otros ajustes |

Los tests están en `tests/recent.test.ts` ([[06 - QA y Tests/Suite de Tests#`tests/recent.test.ts`]]).
