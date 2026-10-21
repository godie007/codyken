---
title: Glosario
description: Términos de Git y de Codyken usados en la interfaz y en esta documentación
type: referencia
tags:
  - glosario
updated: 2026-10-20
up: "[[00 - Inicio]]"
---

# 📖 Glosario

| Término | Significado |
|---|---|
| **WIP** | *Work in progress*: tus cambios sin confirmar; en el gráfico, la fila `// WIP` |
| **HEAD** | El commit (y normalmente la rama) en el que estás |
| **HEAD desacoplado** | Estás en un commit sin rama; lo que confirmes no pertenecerá a ninguna rama hasta crear una |
| **Preparar** (*stage*) | Pasar cambios al índice para incluirlos en el próximo commit |
| **Índice** | Zona intermedia entre el árbol de trabajo y el commit |
| **Hunk / bloque** | Grupo de líneas cambiadas contiguas en un diff |
| **Amend** | Rehacer el último commit con los cambios preparados y/o otro mensaje |
| **Upstream / seguimiento** | La rama remota que sigue una rama local (`main → origin/main`) |
| **↑n / ↓n** | Commits por subir (ahead) / por bajar (behind) respecto al upstream |
| **Fetch** | Traer novedades del remoto sin tocar tus ramas |
| **Pull** | Fetch + integrar en tu rama (merge o rebase) |
| **Fast-forward** | Avanzar la rama sin crear merge porque no hay divergencia |
| **Push** | Subir tus commits al remoto |
| **`--force-with-lease`** | Push forzado que solo sobrescribe si nadie cambió la rama remota desde tu último fetch |
| **Merge** | Unir otra rama creando (si hace falta) un commit con dos padres |
| **Rebase** | Reaplicar tus commits encima de otra rama (reescribe su historia) |
| **Rebase interactivo** | Rebase en el que eliges qué hacer con cada commit: conservar (*pick*), reescribir el mensaje (*reword*), combinar con el anterior (*squash* / *fixup*) o descartar (*drop*), y en qué orden ([[05 - Flujos de Trabajo/Rebase Interactivo]]) |
| **Rehacer** | Volver a aplicar lo último que se deshizo (⇧⌘Z) |
| **Cherry-pick** | Copiar un commit concreto a tu rama |
| **Revert** | Crear un commit que deshace otro |
| **Reset soft / mixed / hard** | Mover la rama a otro commit conservando los cambios preparados / sin preparar / descartándolos |
| **Stash** | Guardado temporal de cambios para limpiar el árbol de trabajo |
| **Pop** | Aplicar un stash y eliminarlo |
| **Blame** | Quién y en qué commit cambió por última vez cada línea |
| **Divergencia** | Cuántos commits tiene cada una de dos ramas que la otra no (*ahead* / *behind*); decide qué ofrece el menú al soltar una rama |
| **Pull request / merge request** | Petición en GitHub / GitLab para integrar una rama en otra tras revisarla |
| **Worktree** | Otra carpeta del mismo repo con otra rama activa, para trabajar en paralelo |
| **Git LFS** | Extensión que guarda archivos grandes fuera del repo y deja en él un puntero |
| **Editor de tres paneles** | Vista de conflicto con HEAD y entrante arriba y el resultado abajo |
| **Carril** | Columna del gráfico por la que corre una línea de historia |
| **Carril fantasma** | El carril 0 reservado para la rama actual antes de que llegue su primer commit ([[03 - Algoritmos/Gráfico de Carriles]]) |
| **Píldora** | Etiqueta de rama o tag en la columna *Rama / Etiqueta* |
| **Remota gemela** | Rama remota que sigue una local (o, si no sigue ninguna, la del mismo nombre); si están en el mismo commit se muestran como una sola rama |
| **Modo solo** | Filtro que muestra únicamente las ramas elegidas y HEAD |
| **Repo bare** | Repositorio sin árbol de trabajo, usado como remoto local en pruebas |
