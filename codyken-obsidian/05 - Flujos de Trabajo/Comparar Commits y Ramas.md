---
title: Comparar Commits y Ramas
description: Comparar dos commits o ramas cualesquiera — commits de cada lado y archivos que difieren
type: flujo
tags:
  - flujo
  - comparar
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Rebase Interactivo]]"
next: "[[05 - Flujos de Trabajo/Resolver Conflictos]]"
related:
  - "[[04 - Interfaz/Panel Derecho]]"
  - "[[04 - Interfaz/Gráfico de Commits]]"
---

# 🔀 Comparar commits y ramas

![[comparar.png]]

## Cómo empezar

| Desde | Qué compara |
|---|---|
| Selecciona un commit y **⌘‑clic** (Ctrl‑clic) en otro | el seleccionado (base) con el del ⌘‑clic |
| Clic derecho en un commit → *Comparar con {rama actual}* | ese commit con HEAD |
| Clic derecho en un commit → *Comparar con X (seleccionado)* | el seleccionado antes con este |
| Clic derecho en una rama → *Comparar con {rama actual}* | HEAD con esa rama |
| Menú de un pull request → *Comparar X con Y* | la base del PR con su rama |
| Paleta (⌘P) → *Comparar abc1234 con {rama actual}* | el commit seleccionado con HEAD |

En el gráfico, la **base** queda marcada (franja morada, clase `compare-base`) y el **destino** seleccionado.

## Panel de comparación (`CommitPanel.tsx` → `ComparePanel`)

- Cabecera *Comparar* con los dos extremos (`base → destino`), **⇄** para invertirlos y ✕ (o **Esc**) para terminar y volver al commit destino.
- *n commits en destino que no están en base* y *n commits en base que no están en destino*: desplegables con la lista (hasta 200 por lado); cada commit salta al gráfico.
- Aviso *No tienen historia en común* si no hay `merge-base`.
- **Archivos distintos** (lista o árbol): cada uno abre su diff entre los dos extremos (un `DiffSource` de commit con `parent = base`, `hash = destino` y `label` con los dos nombres).
- El resultado se guarda en caché por par de extremos mientras la pestaña está abierta.

## Capa git (`compareRefs`)

```bash
git rev-parse <base>^{commit} <destino>^{commit}
git rev-list --left-right --count base...destino   # conteos
git diff --name-status -z -M base destino          # archivos (con renombres)
git log -n 200 base..destino / destino..base       # commits de cada lado
git merge-base base destino
```

Ver [[02 - Capa Git/Lectura del Repositorio]].
