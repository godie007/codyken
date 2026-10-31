---
title: Etiquetas de Ramas
description: Cómo se agrupan ramas locales, remotas y etiquetas por commit (labelsByCommit) y cómo se arman las carpetas del panel
type: algoritmo
tags:
  - algoritmo
  - ramas
updated: 2026-10-30
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
3. Cada **rama remota** se une a una etiqueta **del mismo commit**, así una rama igual en local y en sus remotos es **una sola píldora** con 💻 ☁. Se busca, en orden: la local que la **sigue** (`upstream === origin/x`, aunque se llame distinto, p. ej. `fix` → `origin/fix-login`), la local con el **mismo nombre** y otra remota con el mismo nombre (`origin/x` + `fork/x`). Si no hay gemela, va sola: con el nombre sin el remoto, ☁ y relleno más suave; si su local está en otro commit, se guarda en `localTwin`.
4. Las **etiquetas** (tags).
5. Orden dentro de cada commit: HEAD → ramas locales → ramas solo remotas → etiquetas. La primera se muestra; el resto queda en `+n`.

Ayudantes para [[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas|arrastrar y soltar]]:

- `labelText(label)`: el texto de la píldora; la remota sale sin prefijo (`deploy/ios-beta`) y el *tooltip* indica el remoto.
- `labelTrack(label)`: los ↑/↓ de la rama local y la remota que sigue; la misma cifra se muestra en sus dos píldoras.
- `labelFullName(label)`: la referencia completa que se arrastra (la local si la hay, si no la remota).
- `remoteBranchName(ref)`: `origin/feature/x` → `feature/x`.
- `remoteTwin(local, refs, remoto?)`: la remota que corresponde a una local (la que sigue o, si no sigue ninguna, la del mismo nombre en ese remoto).

> [!note] Si la local y la remota están en commits distintos
> Aparecen como dos píldoras en filas distintas: es real (una va por delante o por detrás). Ambas y el panel izquierdo lo indican con `↑n` / `↓n`: `main ↓32` arriba es la remota, y la local, con el ✓ si es la actual, está 32 commits más abajo. Tras el pull se unen en una.

## Gemelas en el panel izquierdo

`LeftPanel` calcula `localTwins`:

- Para cada remota, la local que la **sigue** (`upstream`) o que **se llama igual** → muestra 💻 en la fila remota.
- Para cada local **sin upstream** que tiene una remota con su nombre → nube tenue ("existe en el remoto pero no la sigue").
- Local sin upstream y sin gemela → insignia `local` (nunca se subió).
- Local con upstream y sin ↑/↓ → nube ("al día").

### Una sola entrada cuando local y remota son iguales

`syncedRemotes`: las remotas que están **en el mismo commit** que su local (la que las sigue o la del mismo nombre, como en el gráfico). En la sección *Remoto* no se repiten: cada remoto (`RemoteGroup`) lista y cuenta solo las remotas que difieren o que no tienes en local. La rama se ve una vez, en *Local*, con la nube. Al **filtrar** por texto se muestran todas las que coinciden, también las iguales, para que la búsqueda no esconda nada. Su menú ofrece *Eliminar origin/x del remoto…*, porque ya no hay otra fila donde pedirlo.

## `buildTree(items, pathOf)`

Convierte `feature/login` y `feature/pago` en una carpeta `feature` con dos hojas. Ordena carpetas primero y luego alfabéticamente. Se usa en las ramas del panel izquierdo y en la vista de árbol de archivos.
