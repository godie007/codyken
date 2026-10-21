---
title: Commit por Líneas
description: Paso a paso para preparar solo parte de los cambios y hacer commit
type: flujo
tags:
  - flujo
  - commit
  - staging
updated: 2026-10-20
up: "[[00 - Inicio]]"
next: "[[05 - Flujos de Trabajo/Sincronizar con el Remoto]]"
related:
  - "[[03 - Algoritmos/Diff y Staging Parcial]]"
  - "[[04 - Interfaz/Panel Derecho]]"
---

# ✅ Commit por Líneas

![[cambios.png]]

1. Selecciona la fila **`// WIP`** del gráfico (aparece cuando hay cambios).
2. En el panel derecho, clic en un archivo de **Sin preparar**: se abre su diff.
3. Elige qué incluir:
   - todo el archivo → **Preparar archivo** (o *Preparar* en la fila, o `S` con el diff abierto);
   - un bloque → **Preparar bloque**;
   - solo algunas líneas → clic en las líneas `+`/`−` (Mayús+clic para un rango) → **Preparar n líneas**;
   - unas líneas, pero cambiadas → **Editar y preparar…**: retócalas en la versión preparada sin tocar tu archivo ([[05 - Flujos de Trabajo/Editar Archivos#Retocar unas líneas antes de prepararlas]]).
4. Revisa **Preparados**; para sacar algo: **Quitar** (o `U`), o selecciona líneas en su diff → *Quitar n líneas*.
5. Escribe el **resumen** (≤ 72 caracteres) y, si hace falta, la descripción. También puedes escribir el resumen en la fila `// WIP` del gráfico.
6. **Hacer commit de n archivos** o ⌘Enter.

> [!tip] Atajos
> - ⇧⌘Enter: prepara todo y hace commit de una vez.
> - ⇧⌘M: salta a escribir el mensaje.
> - Si te equivocaste: **Deshacer** (⌘Z) devuelve los cambios a preparados y el mensaje a la caja ([[05 - Flujos de Trabajo/Deshacer una Acción]]).

## Amend

Marca ☐ *Modificar el último commit (amend)*: si el resumen está vacío se carga el mensaje del último commit; el botón pasa a *Modificar el último commit*. Si el commit ya estaba subido, el siguiente push será rechazado y Codyken ofrecerá forzarlo ([[05 - Flujos de Trabajo/Sincronizar con el Remoto#Push rechazado]]).

## Descartar

- Un archivo: 🗑 en su fila o *Descartar archivo*; nuevos se borran (`git clean`).
- Unas líneas: selecciónalas → *Descartar n líneas*.
- Todo: 🗑 de la cabecera.

Siempre con confirmación: **no se puede deshacer**.
