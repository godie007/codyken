---
title: Verificación Visual
description: Repo de demostración y lista de comprobaciones manuales de la interfaz antes de publicar cambios
type: qa
tags:
  - qa
  - checklist
updated: 2026-10-30
up: "[[00 - Inicio]]"
prev: "[[06 - QA y Tests/Modo Captura]]"
---

# 👁️‍🗨️ Verificación Visual

## Repo de demostración

Las capturas usan un repo con esta forma (créalo con git en cualquier carpeta temporal):

- `main` con merges de `feature/login` y `hotfix/titulo` (este último resuelto tras un conflicto);
- `feature/pagos` sin integrar, autores distintos (Ana Torres, Luis Pérez, Marta Ruiz);
- etiqueta `v1.0.0`;
- un remoto `origin` **bare local** con las ramas subidas y `main` 3 commits por delante;
- un stash *"Experimento con notas"* que solo contiene un archivo nuevo (`-u`);
- cambios sin confirmar: `app.js` modificado y `nuevo.txt` nuevo.

Además conviene probar con un **repo real grande** (cientos de ramas de despliegue y merges frecuentes): ahí fue donde aparecieron la escalera de carriles y las columnas desbordadas ([[Historial de Cambios]]).

## Lista de comprobación

- [ ] El gráfico abre con la rama actual en la primera columna y sin desbordar el panel derecho.
- [ ] Una rama igual en local y en sus remotos es una sola píldora (💻 ☁); las solo remotas salen sin `origin/`, con ☁; una rama desfasada muestra `↑n`/`↓n` en sus dos píldoras.
- [ ] El stash aparece colgado de su base y al seleccionarlo lista sus archivos (también los nuevos).
- [ ] 👁 sobre una rama la oculta junto con su remota; el contador de commits baja; el único aviso, *n ramas ocultas · Mostrar todas* junto a la búsqueda del gráfico, la recupera.
- [ ] Panel izquierdo: ☁ en ramas al día, `local` solo en las que nunca se subieron, 💻 en remotas que tienes en local.
- [ ] Preparar 2 líneas de un diff deja exactamente esas líneas en el índice (`git diff --cached`).
- [ ] Commit → Deshacer → los cambios vuelven a preparados y el mensaje a la caja.
- [ ] Historial sigue renombres; Blame resalta el commit al pasar el ratón.
- [ ] ⌘P filtra acciones; Fetch actualiza los globos de Pull/Push.
- [ ] ⇧⌘O abre los recientes: buscar + Enter abre el repo; ✕ y *Quitar no encontrados* lo quitan de la lista y de `settings.json`; la bienvenida muestra la misma lista.
- [ ] Merge con conflicto → aviso con Abortar/Continuar → resolver en el editor de tres paneles (casillas, *Guardar y resolver*) → Continuar crea el merge.
- [ ] Commit → Deshacer → Rehacer (⇧⌘Z) → el commit vuelve y la caja queda vacía; una acción nueva desactiva Rehacer.
- [ ] Rebase interactivo: mover, combinar y reescribir → el log queda como se eligió; ⌘Z lo deshace.
- [ ] ⌘‑clic en otro commit abre *Comparar* con los commits de cada lado y los archivos distintos; Esc la cierra.
- [ ] Una rama igual en local y en remoto sale **una vez** en el gráfico y en el panel; filtrando por su nombre aparece también la remota.
- [ ] Arrastrar `main` sobre `origin/main` atrasada ofrece *Push*; si divergen, *Push forzado…* y *Rebase*; una remota sobre su local ofrece *Fast-forward* y *Merge*; una local sobre `origin` del panel la publica.
- [ ] Con GitHub y `gh` con sesión, la sección *Pull requests* lista los abiertos; sin `gh`, explica cómo instalarlo.
- [ ] *Nuevo worktree…* crea la carpeta y la abre en otra pestaña; *Eliminar worktree…* la quita.
- [ ] ⌘‑clic y Mayús‑clic seleccionan varias ramas; *Eliminar…* muestra qué se borra y qué no (rama actual, otro worktree, principal del remoto, remota de la actual); las locales vuelven con Deshacer.
- [ ] Los mensajes del gráfico llegan hasta el borde de su columna y se desplazan a los lados con el trackpad, Mayús + rueda o la barra inferior; un commit `fix(x):` con cuerpo se lee con etiquetas, párrafos, viñetas y coautores.
- [ ] Un repo con patrones LFS y sin git-lfs muestra el aviso de instalación.
- [ ] Con nombres de más de 80 caracteres, a 1000 y 1440 px: diff, editor, blame e historial mantienen todos sus botones dentro del panel, y el nombre conserva su principio y su extensión.
