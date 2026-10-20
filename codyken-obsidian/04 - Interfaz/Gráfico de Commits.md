---
title: Gráfico de Commits
description: Columnas, nodos, etiquetas, fila WIP, búsqueda, menús y arrastrar y soltar del gráfico
type: interfaz
tags:
  - interfaz
  - grafico
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[04 - Interfaz/Repositorios Recientes]]"
next: "[[04 - Interfaz/Panel Izquierdo]]"
related:
  - "[[03 - Algoritmos/Gráfico de Carriles]]"
  - "[[03 - Algoritmos/Etiquetas de Ramas]]"
  - "[[03 - Algoritmos/Stashes en el Gráfico]]"
---

# 🌳 Gráfico de Commits

Componente: `src/renderer/src/components/GraphView.tsx`. Lista **virtualizada** (solo se pintan las filas visibles + 10 de margen) y carga de 2000 commits por página al acercarse al final.

## Columnas

| Columna | Ancho | Contenido |
|---|---|---|
| Rama / Etiqueta | 184 px | Píldora principal + `+n`; línea del color del carril hasta el nodo |
| Gráfico | según carriles (máx. 8) | Carriles y nodos |
| Mensaje del commit | resto (mín. 140 px) | Asunto; en la fila WIP, el campo de resumen |
| Autor | 132 px | Avatar con iniciales + nombre |
| Fecha | 104 px | Relativa ("hace 3 días"); la completa en el tooltip |
| SHA | 74 px | Oculta por defecto |

Clic derecho en el encabezado (o la flecha ▾) para elegir columnas.

## Nodos y líneas

- Commit: círculo del color del carril con las **iniciales del autor**. Merge: punto pequeño. HEAD: anillo extra.
- **WIP** (`// WIP`): círculo punteado arriba con trazo punteado hasta HEAD; muestra contadores ✎ modificados, + nuevos, − eliminados, ⚠ conflictos. Se puede escribir el resumen del commit ahí mismo (es el mismo borrador que el del panel derecho).
- **Stash**: cuadrado punteado colgado de su commit base ([[03 - Algoritmos/Stashes en el Gráfico]]).
- La rama actual va siempre en la **primera columna** ([[03 - Algoritmos/Gráfico de Carriles#Carril principal reservado]]).

## Píldoras de ramas

| Estilo | Significado |
|---|---|
| Relleno sólido con ✓ | Rama actual (HEAD) |
| Borde del color del carril + barra izquierda | Rama local (💻; ☁ si la remota está en el mismo commit) |
| Punteada, prefijo `origin/` atenuado | Solo existe en el remoto |
| Redondeada amarilla con 🏷 | Etiqueta (tag) |
| `+n` | Hay más etiquetas en ese commit: al pasar el ratón se despliegan todas |

- **Doble clic** en una píldora: checkout (una remota crea la local con seguimiento; una etiqueta deja HEAD desacoplado).
- **Clic derecho**: menú de la rama ([[04 - Interfaz/Panel Izquierdo#Menú de una rama]]).
- **Arrastrar** una píldora sobre una fila con rama local → menú *Merge de X en Y* / *Rebase de Y sobre X* (hace checkout del destino si hace falta).

## Filas

- Clic: selecciona (el panel derecho muestra el detalle). Doble clic en un commit: checkout de su rama (o del commit, desacoplado, previa confirmación).
- Al pasar el ratón sobre una rama del panel izquierdo, su commit se resalta.
- ↑/↓ o J/K mueven la selección.

## Menú de un commit

Checkout de este commit · Crear rama aquí… · Crear etiqueta aquí… · Cherry-pick en la rama actual · Revertir este commit · Reset de la rama actual a este commit (Soft / Mixed / Hard) · Copiar SHA · Copiar mensaje.

## Búsqueda

⌘F enfoca la barra de búsqueda: filtra por mensaje, autor, correo o prefijo de SHA, atenúa lo que no coincide y muestra el número de resultados. Enter salta al siguiente (Mayús+Enter al anterior), Esc limpia. Si hay ramas ocultas aparece el chip **Ramas filtradas ✕**.
