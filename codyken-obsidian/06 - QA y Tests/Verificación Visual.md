---
title: Verificación Visual
description: Repo de demostración y lista de comprobaciones manuales de la interfaz antes de publicar cambios
type: qa
tags:
  - qa
  - checklist
updated: 2026-10-20
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
- [ ] Las píldoras locales + remotas en el mismo commit salen juntas; las solo remotas, punteadas.
- [ ] El stash aparece colgado de su base y al seleccionarlo lista sus archivos (también los nuevos).
- [ ] 👁 sobre una rama la oculta junto con su remota; el contador de commits baja; *Mostrar todas* la recupera.
- [ ] Panel izquierdo: ☁ en ramas al día, `local` solo en las que nunca se subieron, 💻 en remotas que tienes en local.
- [ ] Preparar 2 líneas de un diff deja exactamente esas líneas en el índice (`git diff --cached`).
- [ ] Commit → Deshacer → los cambios vuelven a preparados y el mensaje a la caja.
- [ ] Historial sigue renombres; Blame resalta el commit al pasar el ratón.
- [ ] ⌘P filtra acciones; Fetch actualiza los globos de Pull/Push.
- [ ] Merge con conflicto → aviso con Abortar/Continuar → resolver → Continuar crea el merge.
