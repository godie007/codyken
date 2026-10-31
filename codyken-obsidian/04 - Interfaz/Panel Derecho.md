---
title: Panel Derecho
description: Cambios pendientes, caja de commit, detalle de commit y de stash
type: interfaz
tags:
  - interfaz
  - commit
updated: 2026-10-30
up: "[[00 - Inicio]]"
prev: "[[04 - Interfaz/Panel Izquierdo]]"
next: "[[04 - Interfaz/Diff, Historial y Blame]]"
related:
  - "[[05 - Flujos de Trabajo/Commit por Líneas]]"
---

# 📋 Panel Derecho

Componente: `src/renderer/src/components/CommitPanel.tsx`. Cambia según la selección del gráfico.

## Con la fila WIP seleccionada

- Cabecera "n archivos cambiados en ⎇ rama", selector **lista / árbol** y 🗑 *Descartar todos los cambios*.
- Aviso de **operación en curso** (merge, rebase, cherry-pick, revert) con **Abortar** y **Continuar**.
- **En conflicto**: archivos con conflicto y botón *Marcar resuelto*; clic en uno abre el [[05 - Flujos de Trabajo/Resolver Conflictos|editor de tres paneles]].
- **Preparar todos los cambios** (⇧⌘S), botón ancho verde.
- **Sin preparar** (con *Preparar todo*): cada archivo con 🗑 descartar y *Preparar*; en árbol, cada carpeta con *Preparar carpeta*.
- **Preparados** (con *Quitar todo*, ⇧⌘U): cada archivo con *Quitar*; carpetas con *Quitar carpeta*.
- **Caja de commit**:
  - *Resumen del commit* con contador regresivo de 72 caracteres (naranja desde 51, rojo al pasar de 72);
  - *Descripción (opcional)*;
  - ☐ *Modificar el último commit (amend)*: si el resumen está vacío, carga el mensaje del último commit;
  - botón verde: *Hacer commit de n archivos* · *Modificar el último commit* · *Prepara cambios para hacer commit* (desactivado). ⌘Enter hace commit; ⇧⌘Enter prepara todo y hace commit.

El borrador del mensaje se conserva por repositorio mientras la app esté abierta, y es el mismo que se edita en la fila `// WIP` del gráfico.

## Mensaje de un commit

`lib/commitmessage.ts` interpreta el mensaje sin perder texto y `CommitMessage.tsx` lo muestra:

- **Título:** el tipo de Conventional Commits (`fix`, `feat`…) y su alcance salen como etiquetas de color; si el asunto no sigue esa forma, se muestra tal cual.
- **Cuerpo:** reúne las líneas que git ajustó a ~72 columnas para aprovechar el ancho; un salto tras una línea de menos de 50 caracteres se respeta. Interpreta viñetas, listas numeradas, títulos (`Cambios:`), etiquetas iniciales en negrita (`MOB-04:`), `código` y bloques de código.
- **Coautores y firmas:** el último grupo de líneas tipo `Co-Authored-By:` sale aparte, con avatar y sin el correo, que queda en el *tooltip*.
- **Mensajes largos:** a partir de 700 caracteres el cuerpo se pliega con *Ver todo el mensaje*, para que los archivos sigan a mano.

![[cambios.png]]

## Con un commit seleccionado

SHA (clic para copiar), asunto y cuerpo, autor con avatar y fecha completa, committer si es distinto, padres (clic para ir) y la lista de **Archivos** (lista o árbol). Clic en un archivo abre su diff contra el primer padre.

## Con un stash seleccionado

Botones **Aplicar y eliminar (pop)**, **Aplicar** y **Eliminar**, el mensaje, autor, padres y sus archivos, incluidos los nuevos guardados con `-u` ([[03 - Algoritmos/Stashes en el Gráfico#Archivos del stash]]).

![[stash.png]]

## Menú de un archivo

Ver cambios · Preparar / Descartar cambios… (sin preparar) · Quitar de preparados (preparado) · Usar versión HEAD / Usar versión entrante / Marcar resuelto (conflicto) · **Ver historial del archivo** · **Blame** · Copiar ruta.

## Comparando dos commits o ramas

Con ⌘‑clic en el gráfico o *Comparar con…*, el panel pasa a **Comparar**: los dos extremos (`base → destino`), ⇄ para invertirlos, ✕ / Esc para terminar, los commits de cada lado (desplegables) y los **archivos distintos**, que abren su diff entre los dos puntos. Ver [[05 - Flujos de Trabajo/Comparar Commits y Ramas]].

![[comparar.png]]
