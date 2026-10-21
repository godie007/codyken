---
title: Paleta y Atajos
description: Paleta de comandos (⌘P) y todos los atajos de teclado de Codyken
type: interfaz
tags:
  - interfaz
  - atajos
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[04 - Interfaz/Diff, Historial y Blame]]"
next: "[[04 - Interfaz/Tema Monokai]]"
---

# ⌨️ Paleta y Atajos

## Paleta de comandos (⌘P)

![[paleta.png]]

Búsqueda aproximada (`lib/fuzzy.ts`) sobre:

| Grupo | Elementos |
|---|---|
| Repositorio | Fetch, Pull (3 modos), Push, Deshacer: … y Rehacer: … (si hay), Crear pull request de {rama} y Ver pull requests en el navegador (si hay GitHub/GitLab), Abrir en Terminal, Abrir carpeta, Copiar ruta |
| Rama | Nueva rama…, Rebase interactivo desde abc1234… (con un commit de la rama seleccionado), Nuevo worktree… |
| LFS | Seguir un tipo de archivo con Git LFS…, Descargar archivos de Git LFS (si git-lfs está instalado) |
| Stash | Guardar en el stash…, Aplicar el último (pop) |
| Cambios | Preparar todo, Quitar todo, Escribir mensaje de commit, Descartar todos los cambios… |
| Ver | Buscar commits, Paneles izquierdo/derecho, Mostrar todas las ramas (si hay filtro), Comparar abc1234 con {rama actual} (con un commit seleccionado) |
| Checkout | Cada rama local (no la actual) y remota |
| Ir a | Cada rama: selecciona su commit en el gráfico |
| Abrir / Pestañas | Repos recientes, Abrir repositorio…, Repositorios recientes… (desplegable), Nueva pestaña |

↑/↓ para moverse, Enter para ejecutar, Esc para cerrar.

## Atajos

| Acción | Atajo |
|---|---|
| Paleta de comandos | ⌘P |
| Buscar commits | ⌘F |
| Filtrar ramas | ⌥⌘F |
| Nueva rama | ⌘B |
| Fetch | ⌘L |
| Preparar todo / quitar todo | ⇧⌘S / ⇧⌘U |
| Escribir mensaje de commit | ⇧⌘M |
| Commit / preparar todo y commit | ⌘Enter / ⇧⌘Enter |
| Deshacer la última acción | ⌘Z (fuera de campos de texto) |
| Rehacer lo último deshecho | ⇧⌘Z (fuera de campos de texto) |
| Comparar con el commit seleccionado | ⌘‑clic en otro commit |
| Panel izquierdo / derecho | ⌘J / ⌘K |
| Moverse por el gráfico | ↑ ↓ o J K |
| Preparar / quitar el archivo abierto | S / U |
| Con líneas elegidas en el diff: prepararlas / quitarlas · deseleccionar | S / U · Esc |
| Cerrar diff, historial, blame o la comparación | Esc |
| Abrir repo · nueva pestaña · cerrar pestaña | ⌘O · ⌘T · ⌘W |
| [[04 - Interfaz/Repositorios Recientes\|Repositorios recientes]] | ⇧⌘O |
| Ir a la pestaña N · siguiente | ⌘1 … ⌘9 · Ctrl+Tab |
| Zoom | ⌘+ / ⌘− / ⌘0 |

Los atajos de una letra no se activan mientras escribes en un campo de texto ni con un diálogo abierto.

### En el editor de archivos

⌘S guarda (o prepara la versión editada), ⌘G va a una línea, Tab / ⇧Tab sangran, Enter mantiene la sangría y Esc cierra. Mientras escribes solo sigue activa ⌘P; ⌘Z deshace el texto, no la última acción de la app ([[05 - Flujos de Trabajo/Editar Archivos#Atajos del editor]]).
