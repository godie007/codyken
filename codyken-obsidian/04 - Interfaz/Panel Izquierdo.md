---
title: Panel Izquierdo
description: Secciones Local, Remoto, Pull requests, Etiquetas, Stashes, Worktrees, Git LFS y Submódulos; indicadores, arrastrar y soltar y menú de una rama
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
| ☁ **Remoto** | Un grupo por remoto con su nombre y servidor (`github.com`, `local`…); dentro, sus ramas en carpetas. Las que están **igual que su local** no se repiten ni se cuentan: aparecen solo en *Local* o al filtrar por su nombre |
| 🔃 **Pull requests** / **Merge requests** | Solo si `origin` es de GitHub o GitLab: los abiertos, con ⟳ y **+** (crear) en la cabecera; ver [[#Pull requests]] |
| 🏷 **Etiquetas** | Plegada por defecto; de la más nueva a la más vieja |
| 📦 **Stashes** | Clic: lo selecciona y lleva el gráfico a su fila. Clic derecho: pop, aplicar, eliminar |
| 🌲 **Worktrees** | Las carpetas de trabajo del repo; **+** crea uno; ver [[#Worktrees]] |
| 🗄️ **Git LFS** | Si `git-lfs` está instalado o el repo tiene patrones LFS; **+** sigue un tipo de archivo; ver [[#Git LFS]] |
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
- **Arrastrar** una rama (local o remota) y soltarla sobre otra fila de rama, sobre una etiqueta del gráfico o sobre el **remoto** (`origin`): menú con fast-forward, merge, rebase, rebase interactivo, push o pull request según el caso. La fila de destino se resalta en amarillo. Ver [[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]].

## Menú de una rama

Checkout (en remotas *crea la rama local*; en etiquetas *HEAD desacoplado*) · Merge de X en la actual · Rebase de la actual sobre X · Push / Pull (si es la actual) · Crear rama aquí… · Crear etiqueta aquí… · Abrir en un worktree nuevo… · Comparar con {actual} · Crear pull request… (si hay GitHub/GitLab) · Ocultar/Mostrar en el gráfico · Mostrar solo esta rama en el gráfico · Mostrar todas las ramas (si hay filtro) · Renombrar… · Eliminar… (local) · Eliminar rama remota… · Eliminar etiqueta… · Copiar nombre.

## Pull requests

Cada fila: `#número`, título, `rama → base · autor · fecha` y *borrador* si lo es. Con muchos abiertos la lista se desplaza por dentro (máx. 320 px) para no empujar al resto de secciones. Clic selecciona su rama en el gráfico; doble clic hace checkout; clic derecho: abrir en el navegador, checkout, comparar con la base. Si falta `gh`/`glab` o no hay sesión, explica cómo iniciarla. Ver [[05 - Flujos de Trabajo/Pull Requests]].

## Worktrees

Cada fila: carpeta, rama (o *desacoplado*, *bare*) y etiquetas *principal*, *bloqueado*, *no existe*; ✓ en el de esta pestaña. Doble clic lo abre en otra pestaña; clic derecho: abrir, copiar ruta, eliminar, limpiar los que ya no existen. Con uno solo, explica para qué sirven. Ver [[05 - Flujos de Trabajo/Worktrees y LFS]].

## Git LFS

Patrones seguidos (clic derecho → *Dejar de seguir*), *n archivos en LFS · m sin descargar* con **Descargar**, y un aviso si el repo usa LFS pero `git-lfs` no está instalado. Ver [[05 - Flujos de Trabajo/Worktrees y LFS#Git LFS]].
