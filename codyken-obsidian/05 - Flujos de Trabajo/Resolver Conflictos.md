---
title: Resolver Conflictos
description: Qué hacer cuando un merge, rebase, cherry-pick, revert, pull o stash deja conflictos; editor de tres paneles
type: flujo
tags:
  - flujo
  - conflictos
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Comparar Commits y Ramas]]"
next: "[[05 - Flujos de Trabajo/Pull Requests]]"
related:
  - "[[04 - Interfaz/Diff, Historial y Blame#Conflictos]]"
  - "[[05 - Flujos de Trabajo/Rebase Interactivo]]"
---

# ⚔️ Resolver Conflictos

Cuando una operación se detiene por conflictos:

- la barra de estado muestra **⚠ merge en curso** (o rebase, cherry-pick, revert);
- el panel derecho muestra el aviso con **Abortar** y **Continuar** y la sección **En conflicto**.

## Editor de tres paneles (`MergeEditor.tsx` + `lib/conflict.ts`)

Clic en un archivo de **En conflicto** abre el editor en el centro:

![[conflictos.png]]

- **Arriba, dos columnas alineadas fila a fila**: a la izquierda *HEAD* (tu versión; muestra el nombre de la rama actual) y a la derecha *Entrante* (con la etiqueta del marcador `>>>>>>>`, p. ej. la rama que se mezcla). Cuando un lado tiene menos líneas se rellena con celdas vacías; los tramos iguales de más de 8 líneas se **pliegan** dejando 3 de contexto (*⋯ n líneas iguales en los dos lados*, clic para expandir).
- **Cabecera de cada conflicto** (*Conflicto i de n*): casillas **Usar HEAD** y **Usar entrante**. Puedes marcar las dos: el **orden de los clics** decide el orden en el resultado (1º, 2º). **Ninguno** deja el conflicto vacío.
- **Abajo, Resultado**: el archivo que se guardará, coloreado según de dónde sale cada línea; los conflictos sin decidir se ven con sus marcadores. **Editar a mano** lo convierte en un textarea libre (las casillas ya no lo cambian; *Descartar edición* vuelve atrás).
- Barra: contador *k/n resueltos*, **Siguiente** (salta al próximo pendiente), **Todo HEAD**, **Todo entrante** y **Guardar y resolver** (habilitado cuando todos están decididos o editaste a mano).

**Guardar y resolver** llama a `saveConflictResolution`: escribe el archivo (la ruta se valida para que no salga del repo) y hace `git add`. Si el resultado aún tiene marcadores `<<<<<<<`/`=======`/`>>>>>>>`, pide confirmación.

### Cómo se lee el conflicto

- `getConflictVersions` devuelve el archivo de trabajo y las tres etapas del índice (`:1:` base, `:2:` HEAD, `:3:` entrante) y marca si alguna es **binaria**.
- `parseConflicts` divide el archivo con marcadores (estilo *merge* y *diff3*, con `|||||||` base; respeta CRLF y el salto final) en tramos comunes y conflictos. Devuelve `null` si los marcadores están incompletos o anidados.
- Sin marcadores pero con versiones distintas (p. ej. un lado borró el archivo) se usa `wholeFileConflict`: un único conflicto con las dos versiones enteras.
- Archivo binario o marcadores ilegibles: el editor ofrece solo **Usar versión HEAD / entrante** (`checkout --ours/--theirs` + `add`).

## Pasos

1. Resuelve cada archivo con el editor, o desde la lista con:
   - **Usar versión HEAD** — te quedas con lo tuyo (`checkout --ours` + `add`);
   - **Usar versión entrante** — te quedas con lo que llega (`checkout --theirs` + `add`);
   - edítalo en tu editor y pulsa **Marcar resuelto** (`add`).
2. Cuando no quede ninguno, **Continuar**: en merge hace el commit (`commit --no-edit`); en rebase/cherry-pick/revert, `--continue`.
3. Si prefieres volver atrás: **Abortar** (`--abort`) deja el repo como antes de la operación.

> [!note] Durante una operación a medias
> Deshacer no registra operaciones que terminaron en conflicto: para salir se usa **Abortar**. En un [[05 - Flujos de Trabajo/Rebase Interactivo|rebase interactivo]] detenido, los mensajes nuevos pendientes siguen en una carpeta temporal hasta que termina.
