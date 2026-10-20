---
title: Ramas y Merge
description: Crear, cambiar, renombrar y eliminar ramas; merge y rebase desde menú o arrastrando
type: flujo
tags:
  - flujo
  - ramas
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Sincronizar con el Remoto]]"
next: "[[05 - Flujos de Trabajo/Resolver Conflictos]]"
related:
  - "[[04 - Interfaz/Panel Izquierdo#Menú de una rama]]"
---

# 🌿 Ramas, Merge y Rebase

## Crear

- **Rama** en la barra o ⌘B: desde HEAD. Clic derecho en un commit o rama → *Crear rama aquí…*.
- El diálogo valida el nombre (sin espacios, que no exista, `check-ref-format`) y trae marcado *Cambiar a la nueva rama*.

## Cambiar (checkout)

- Doble clic en una rama del panel o en su píldora del gráfico, el menú ⎇ de la barra o la paleta (⌘P → nombre).
- Una **remota** crea la rama local con seguimiento (o cambia a ella si ya existe).
- Un **commit** o una **etiqueta** deja HEAD desacoplado, previa confirmación.

## Merge y rebase

- Clic derecho en una rama → *Merge de X en {actual}* o *Rebase de {actual} sobre X* (el rebase pide confirmación porque reescribe commits).
- **Arrastrar** la píldora de X sobre la fila de otra rama local Y → elegir *Merge de X en Y* o *Rebase de Y sobre X*; si Y no es la actual, se hace checkout antes.
- Cherry-pick y revert desde el menú de un commit (en merges se usa `-m 1`).

Todo esto se puede [[05 - Flujos de Trabajo/Deshacer una Acción|deshacer]] mientras no hayas hecho nada más.

## Renombrar y eliminar

- *Renombrar…* (locales).
- *Eliminar…*: si la rama tiene commits que no están en otra, avisa y ofrece *Eliminar de todos modos* (`-D`). Se recupera con Deshacer.
- *Eliminar rama remota…*: `git push <remoto> --delete <rama>`; afecta a todo el equipo.

## Ver solo lo que importa

Oculta ramas con el 👁 o usa *Mostrar solo esta rama* ([[03 - Algoritmos/Filtro de Ramas]]).
