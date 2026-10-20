---
title: Limitaciones Conocidas
description: Lo que Codyken todavía no hace o hace de forma parcial
type: referencia
tags:
  - limitaciones
updated: 2026-10-20
up: "[[00 - Inicio]]"
related:
  - "[[Hoja de Ruta]]"
---

# ⚠️ Limitaciones Conocidas

| Área | Limitación |
|---|---|
| Plataforma | Desarrollado y probado en macOS; *Abrir en Terminal* usa `open -a Terminal`. Sin empaquetado `.dmg` todavía |
| Deshacer | Sin rehacer. La pila vive en memoria de la pestaña. No cubre descartar, eliminar stash, push ni borrar ramas del servidor |
| ⌘Z | Solo se probó con el botón y con eventos simulados; falta confirmar el teclado físico con el menú Edición nativo |
| Gráfico | Máximo 8 carriles visibles (los demás se recortan). Un stash cuya base no está cargada no se dibuja |
| Staging parcial | No disponible en archivos nuevos, borrados, renombrados ni binarios (se preparan enteros) |
| Diff | Corta a 6000 líneas (con *Mostrar todo*) y rechaza más de 8 MB. Blame muestra hasta 8000 líneas |
| Conflictos | Sin editor de tres paneles: se elige un lado entero o se edita fuera y se marca resuelto |
| Rebase | Sin rebase interactivo |
| Credenciales | No pide usuario/clave: dependen del llavero, agente SSH o `gh` |
| Etiquetas | Recrear una etiqueta eliminada (Deshacer) la crea ligera, sin el mensaje de la anotada |
| Tests de UI | Los componentes no tienen tests automáticos; se verifican con capturas |
