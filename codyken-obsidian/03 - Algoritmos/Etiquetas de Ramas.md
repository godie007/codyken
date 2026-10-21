---
title: Etiquetas de Ramas
description: Cómo se agrupan ramas locales, remotas y etiquetas por commit (labelsByCommit) y cómo se arman las carpetas del panel
type: algoritmo
tags:
  - algoritmo
  - ramas
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[03 - Algoritmos/Gráfico de Carriles]]"
next: "[[03 - Algoritmos/Stashes en el Gráfico]]"
related:
  - "[[04 - Interfaz/Panel Izquierdo]]"
  - "[[04 - Interfaz/Gráfico de Commits]]"
---

# 🏷️ Etiquetas de Ramas

Archivo: `src/renderer/src/lib/refs.ts`.

## `labelsByCommit(refs, detachedHead)`

Devuelve `Map<hash, RefLabel[]>` para pintar las píldoras de la columna *Rama / Etiqueta*:

1. Si HEAD está desacoplado, una etiqueta `HEAD` en ese commit.
2. Una etiqueta por cada **rama local**.
3. Cada **rama remota** se une a una local **del mismo commit**, así local y remota iguales son **una sola píldora** con 💻 ☁ (`origin/main` + `main`). Se busca primero la local que la **sigue** (`upstream === origin/x`, aunque se llame distinto, p. ej. `fix` → `origin/fix-login`) y, si no, la local **sin upstream** con el mismo nombre. Si no hay gemela, va sola (píldora punteada, prefijo `origin/` atenuado).
4. Las **etiquetas** (tags).
5. Orden dentro de cada commit: HEAD → ramas locales → ramas solo remotas → etiquetas. La primera se muestra; el resto queda en `+n`.

Ayudantes para [[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas|arrastrar y soltar]]:

- `labelFullName(label)`: la referencia completa que se arrastra (la local si la hay, si no la remota).
- `remoteBranchName(ref)`: `origin/feature/x` → `feature/x`.
- `remoteTwin(local, refs, remoto?)`: la remota que corresponde a una local (la que sigue o, si no sigue ninguna, la del mismo nombre en ese remoto).

> [!note] Si la local y la remota están en commits distintos
> Aparecen como dos píldoras en filas distintas: es real (una va por delante o por detrás). El panel izquierdo lo indica con `↑n` / `↓n`.

## Gemelas en el panel izquierdo

`LeftPanel` calcula `localTwins`:

- Para cada remota, la local que la **sigue** (`upstream`) o que **se llama igual** → muestra 💻 en la fila remota.
- Para cada local **sin upstream** que tiene una remota con su nombre → nube tenue ("existe en el remoto pero no la sigue").
- Local sin upstream y sin gemela → insignia `local` (nunca se subió).
- Local con upstream y sin ↑/↓ → nube normal ("al día").

### Una sola entrada cuando local y remota son iguales

`syncedRemotes`: las remotas que están **en el mismo commit** que su local (la que las sigue o, sin upstream, la del mismo nombre). En la sección *Remoto* no se repiten: cada remoto (`RemoteGroup`) lista solo las remotas que difieren o que no tienes en local, y agrupa las iguales al final en una fila plegable *«dev: igual que la local»* / *«n iguales a su rama local»*. La rama se ve una vez, en *Local*, con la nube de "al día". Al **filtrar** por texto se muestran todas las que coinciden, también las iguales, para que la búsqueda no esconda nada. El contador del remoto sigue contando todas.

## `buildTree(items, pathOf)`

Convierte `feature/login` y `feature/pago` en una carpeta `feature` con dos hojas. Ordena carpetas primero y luego alfabéticamente. Se usa en las ramas del panel izquierdo y en la vista de árbol de archivos.
