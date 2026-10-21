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
| Deshacer / rehacer | La pila vive en memoria de la pestaña (máx. 20). No cubre descartar, eliminar stash, push (tampoco el de arrastrar y soltar) ni borrar ramas del servidor |
| ⌘Z / ⇧⌘Z | Solo se probaron con el botón y con eventos simulados; falta confirmar el teclado físico con el menú Edición nativo |
| Gráfico | Máximo 8 carriles visibles (los demás se recortan). Un stash cuya base no está cargada no se dibuja |
| Staging parcial | No disponible en binarios ni en archivos en conflicto. El cambio de permisos (`chmod +x`) solo se prepara con el archivo entero |
| Diff | Corta a 6000 líneas (con *Mostrar todo*) y rechaza más de 8 MB. Blame muestra hasta 8000 líneas |
| Conflictos | El editor de tres paneles no resuelve archivos binarios ni marcadores anidados (ahí solo se elige un lado entero). No muestra la versión base como columna aparte |
| Rebase interactivo | Solo historia lineal: rechaza rangos con merges (no hay `--rebase-merges`) y más de 500 commits. No tiene acción *edit* (parar en un commit) |
| Arrastrar y soltar | Los menús de soltar son **nativos**: no salen en las capturas y en los scripts se eligen con `CODYKEN_SNAPSHOT_MENU`. El push que ofrece no se puede deshacer |
| GitLab y LFS | `glab` y `git-lfs` no estaban instalados: GitLab (listar, checkout de MR) y LFS (`track`, `untrack`, `pull`) solo están probados con tests de los parsers, no contra instalaciones reales. `gh` sí se probó |
| Pull requests | Se crean en la web del proveedor (Codyken abre la página prellenada); solo se mira el remoto `origin` (o el primero) |
| Credenciales | No pide usuario/clave: dependen del llavero, agente SSH o `gh` |
| Etiquetas | Recrear una etiqueta eliminada (Deshacer) la crea ligera, sin el mensaje de la anotada |
| Editor de archivos | Sin ajuste de líneas largas ni buscar/reemplazar. Solo texto UTF‑8 de hasta 2 MB; sin colores por encima de 200 000 caracteres. Con finales de línea mezclados guarda todo con el mayoritario. Lo no guardado sobrevive a cambiar de pestaña, pero no a cerrar la app |
| Tests de UI | Los componentes no tienen tests automáticos; se verifican con capturas |
