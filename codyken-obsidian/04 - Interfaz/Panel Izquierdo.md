---
title: Panel Izquierdo
description: Secciones Local, Remoto, Etiquetas, Stashes y Submódulos; indicadores y menú de una rama
type: interfaz
tags:
  - interfaz
  - ramas
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[04 - Interfaz/Gráfico de Commits]]"
next: "[[04 - Interfaz/Panel Derecho]]"
related:
  - "[[03 - Algoritmos/Etiquetas de Ramas]]"
  - "[[03 - Algoritmos/Filtro de Ramas]]"
---

# 📂 Panel Izquierdo

Componente: `src/renderer/src/components/LeftPanel.tsx`. Arriba, un filtro de texto (⌥⌘F) que busca en ramas, etiquetas, stashes y submódulos; Esc lo limpia.

## Secciones

| Sección | Contenido |
|---|---|
| 💻 **Local** | Ramas locales en carpetas por prefijo (`feature/`, `deploy/`…); la actual con ✓ en verde |
| ☁ **Remoto** | Un grupo por remoto con su inicial, nombre y servidor (`github.com`, `local`…); dentro, sus ramas en carpetas |
| 🏷 **Etiquetas** | Plegada por defecto; de la más nueva a la más vieja |
| 📦 **Stashes** | Clic: lo selecciona y lleva el gráfico a su fila. Clic derecho: pop, aplicar, eliminar |
| 🧩 **Submódulos** | Solo si hay `.gitmodules`; doble clic lo abre en otra pestaña |

## Indicadores de una rama

| Indicador | Dónde | Significado |
|---|---|---|
| `↑n` verde | Local | n commits sin subir |
| `↓n` naranja | Local | n commits por bajar |
| `✕` | Local | La rama remota que seguía ya no existe |
| ☁ | Local | Al día con su remota |
| ☁ tenue | Local | Existe una remota con su nombre pero esta rama no la sigue |
| `local` | Local | Solo existe en tu equipo (nunca se subió) |
| 💻 | Remoto | También la tienes en local |
| 👁 / 👁 tachado | Al pasar el ratón | Ocultar / mostrar en el gráfico (rama, carpeta o remoto entero) |

Las filas ocultas se ven atenuadas y tachadas, y arriba aparece "n ramas ocultas · **Mostrar todas**".

## Interacción

- Clic: lleva el gráfico al commit de esa rama.
- Doble clic: checkout.
- Pasar el ratón: resalta su commit en el gráfico.

## Menú de una rama

Checkout (en remotas *crea la rama local*; en etiquetas *HEAD desacoplado*) · Merge de X en la actual · Rebase de la actual sobre X · Push / Pull (si es la actual) · Crear rama aquí… · Crear etiqueta aquí… · Ocultar/Mostrar en el gráfico · Mostrar solo esta rama en el gráfico · Mostrar todas las ramas (si hay filtro) · Renombrar… · Eliminar… (local) · Eliminar rama remota… · Eliminar etiqueta… · Copiar nombre.
