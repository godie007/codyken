---
title: Historial de Cambios
description: Cambios relevantes de Codyken por fecha
type: referencia
tags:
  - changelog
updated: 2026-10-30
up: "[[00 - Inicio]]"
---

# 📝 Historial de Cambios

## 2026-10-30 — Mensajes de commit legibles

### Nuevo
- Los mensajes del gráfico se desplazan a los lados con el trackpad, Mayús + rueda o una barra bajo la columna.
- El detalle del commit interpreta el mensaje: etiquetas de tipo y alcance, párrafos reunidos, viñetas, código y coautores aparte. Los mensajes largos se pliegan con *Ver todo el mensaje*.

### Cambios y arreglos
- El texto del gráfico se cortaba antes de la división: cada fila reservaba 34 px para el botón de columnas de la cabecera.
- *Mostrar ramas ocultas* salía en el panel izquierdo, la búsqueda, la barra de estado y el menú de cada rama. Queda un solo aviso, junto a la búsqueda del gráfico, además de la paleta.

## 2026-10-30 — Eliminar varias ramas

### Nuevo
- ⌘‑clic (Ctrl en Windows y Linux) y Mayús‑clic seleccionan varias ramas en el panel; aparece una barra con *Eliminar…*. También con clic derecho sobre la selección, una carpeta, un remoto o la cabecera *Local*.
- Un diálogo lista qué se elimina y qué no: nunca la rama actual, una abierta en otro worktree, la principal del remoto (`origin/HEAD`) ni la remota de la rama actual; esas se siguen pudiendo borrar una a una.
- Las locales con commits sin integrar piden una segunda confirmación y, si no se acepta, se conservan junto con su remota. Las locales se recuperan con *Deshacer*; las remotas, no.

### Cambios y arreglos
- Se quita el cuadrito morado con la inicial del remoto de píldoras y panel; vuelve la nube ☁. Sustituye a la insignia descrita en la entrada siguiente.

## 2026-10-30 — Una rama, una píldora

Probado con una copia de INSPIA, donde parecía que solo había ramas remotas. No faltaba ninguna: tiene 2 locales y 13 solo remotas, pero estas salían punteadas con `origin/` y la local `main`, 32 commits atrás, quedaba fuera de la vista.

### Cambios y arreglos
- Gráfico: una rama igual en local y en varios remotos es una sola píldora, con 💻 y la insignia de cada remoto; antes `fork/x` salía aparte si la local seguía a `origin/x`.
- Las ramas solo remotas salen sin `origin/` (cabe más nombre), con la insignia del remoto y sin el aspecto punteado. El nombre completo sigue en el *tooltip*.
- Una rama desfasada muestra `↑n` / `↓n` en sus dos píldoras, así `main ↓32` explica desde arriba dónde está tu rama.
- Panel: una rama sincronizada aparece solo en *Local*, con la insignia del remoto; se quitó la fila *«dev: igual que la local»* y *Remoto* cuenta solo lo que lista. Filtrando por su nombre aparece también la remota.
- El menú de una rama local ofrece *Eliminar origin/x del remoto…*.

## 2026-10-30 — Nombres de archivo largos

Probado con el repo de INSPIA, cuyas fichas tienen nombres de hasta 100 caracteres.

### Cambios y arreglos
- Un nombre largo sacaba del panel los botones de la barra del diff (*Descartar*, *Preparar*, *Editar*, las vistas y *Cerrar*): el nombre no se podía recortar. Ahora ningún control queda fuera.
- Los nombres se recortan por el medio (`BUG-065-subida-de-…a-en-fila.md`), así se ven el número y la extensión. Corrige la entrada anterior: el nombre ya sí puede recortarse. La ruta completa sigue en el *tooltip*.
- Si el nombre tiene más de 24 caracteres y el panel mide 880 px o menos, la barra del diff usa dos filas para que el nombre se pueda leer.
- La carpeta detrás del nombre se muestra solo si cabe y sin barras de más (antes salía `/frontend/coverage`).
- Editor, Blame, Historial y Conflictos: la ruta larga ya se recorta y, si no cabe todo, los botones bajan de fila. Antes el editor se montaba sobre el panel derecho en ventanas pequeñas.
- La lista del historial cede espacio al diff con ventana chica (máximo 40 % del panel).
- Los avisos con rutas largas parten la línea en vez de desbordarse.

## 2026-10-27 — Scroll horizontal en el diff y hora de Colombia

### Nuevo
- Las columnas del gráfico se pueden redimensionar arrastrando su borde (doble clic restablece el ancho); los anchos se guardan en la configuración.

### Cambios y arreglos
- El diff (Bloques y Archivo) cortaba las líneas largas: ahora se desplaza en horizontal y la cabecera de cada bloque, con sus botones, queda fija a la izquierda. Con *Ajustar líneas* se comporta como antes.
- *Dividido* se ve como el *Split* de GitKraken: el archivo completo en dos paneles al 50 % que llenan la vista, bajan juntos y se desplazan en horizontal cada uno por su cuenta, con las filas alineadas. Antes el lado derecho quedaba fuera de la pantalla con líneas largas.
- Las fechas y horas se muestran en hora de Colombia (`America/Bogota`) con formato de 12 horas (*a. m.* / *p. m.*).
- Revisión visual con capturas de todas las vistas:
  - La barra del diff ocupa siempre una fila: *Descartar* / *Preparar* / *Quitar* sin la palabra «archivo», *Editar* queda solo con el icono si el panel es angosto y la etiqueta de origen se recorta antes que los botones.
  - La ruta del diff muestra primero el nombre del archivo y después la carpeta en gris (como la lista de archivos); el nombre nunca se recorta.
  - El consejo de selección de líneas cabe en una línea y se puede cerrar para siempre.
  - La cabecera de cada bloque (`@@ … @@`) no se parte en dos líneas.
  - Las rutas largas (repositorios recientes y barra de estado) se recortan por el principio, para que se vea la carpeta del repo.
  - La barra de estado dice *1 commit* en singular.
  - Paneles del diff angostos (ventanas de 1000–1200 px con los dos paneles laterales): la barra pasa a filas ordenadas —archivo y cerrar arriba; acciones y controles de vista, cada grupo entero, debajo— y la cabecera de bloque pone sus botones bajo el rango. Verificado en 1000, 1200, 1440 y 1920 px y en los tres modos: ningún control queda fuera.
- Modo captura: `CODYKEN_SNAPSHOT_SIZE` cambia el tamaño de la ventana ([[06 - QA y Tests/Modo Captura]]).

## 2026-10-20 — App de macOS instalable

### Nuevo
- **`npm run install:mac`** genera `Codyken.app` (nombre, icono del hongo, versión y firma ad hoc) con el Electron de `node_modules` y herramientas del sistema, sin dependencias nuevas, y la mueve a `/Applications`. `npm run package:mac` solo la genera en `dist/` ([[Desarrollo#App instalada en macOS]]).

### Cambios y arreglos
- El menú de la app, el Dock y ⌘Tab decían **Electron**: ahora dicen **Codyken**, también en `npm run dev` (`scripts/dev-name.sh`).
- Menú de la app en español: *Acerca de Codyken*, *Servicios*, *Ocultar Codyken*, *Ocultar otros*, *Mostrar todo*, *Salir de Codyken*.
- Empaquetada, el Dock usa el `.icns` del bundle; `app.dock.setIcon` solo se aplica en desarrollo.

## 2026-10-20 — Quitar y preparar líneas en cualquier archivo

### Nuevo
- **Selección de líneas en varios bloques a la vez**, con una barra que resume la selección y aplica *Preparar* / *Quitar* / *Descartar* o *Editar y preparar…* a todo de una vez; **S** / **U** la aplican y **Esc** la limpia ([[04 - Interfaz/Diff, Historial y Blame]]).
- **Vista Dividido seleccionable**: también se eligen líneas en ella.
- **+ / − sobre el número de cada línea cambiada**: prepara o quita esa línea con un clic (o la selección entera si la línea es parte de ella).

### Cambios y arreglos
- **Quitar líneas de lo preparado en archivos nuevos, borrados y renombrados** (antes solo en modificados): las líneas quitadas vuelven a *Sin preparar* y el resto sigue preparado. Quitar todas las de un archivo nuevo lo saca del índice; en un renombrado se mantiene el renombre. También se pueden preparar o descartar líneas sueltas de archivos sin seguir y de borrados ([[03 - Algoritmos/Diff y Staging Parcial#Archivos nuevos, borrados y renombrados]]).
- Preparar o quitar un bloque ya no arrastra el cambio de permisos del archivo.
- Tests: **106**.

### Logo nuevo
- **Hongo nuclear con onda de choque** en vez del cuadrado verde y cian: en la barra de pestañas, la bienvenida, el README y como **icono de la app en el Dock** (antes salía el átomo de Electron). Los generan `scripts/logo.py` y `scripts/icon.cjs` ([[04 - Interfaz/Tema Monokai#Logo]]).

## 2026-10-20 — Rehacer, rebase interactivo, comparar, arrastrar y soltar, PRs, worktrees, LFS, conflictos y editor

### Nuevo
- **Rehacer** (⇧⌘Z, botón en la barra y paleta): todo lo que se deshace se puede rehacer; una acción nueva vacía la pila ([[03 - Algoritmos/Pila de Deshacer]]).
- **Rebase interactivo** desde un commit o llevando una rama encima de otra: reordenar, reescribir, combinar (con o sin mensaje) y descartar, con stash automático y deshacer ([[05 - Flujos de Trabajo/Rebase Interactivo]]).
- **Comparar dos commits o ramas** con ⌘‑clic o desde los menús: commits de cada lado y archivos distintos ([[05 - Flujos de Trabajo/Comparar Commits y Ramas]]).
- **Arrastrar y soltar ramas** con las opciones de un cliente Git visual: fast-forward, merge, rebase, rebase interactivo, push (forzado con lease si divergen), publicar en un remoto y crear pull request; también desde y hacia el panel izquierdo ([[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]]).
- **Pull requests / merge requests** de GitHub y GitLab con `gh` / `glab`: listar, abrir, comparar, checkout y crear ([[05 - Flujos de Trabajo/Pull Requests]]).
- **Worktrees** y **Git LFS** en el panel izquierdo ([[05 - Flujos de Trabajo/Worktrees y LFS]]).
- **Editor de conflictos de tres paneles**: HEAD y entrante alineados, resultado editable y *Guardar y resolver* ([[05 - Flujos de Trabajo/Resolver Conflictos]]).
- **Editor de archivos**: editar el archivo o la **versión preparada** (lo que entra en el commit, sin tocar el disco) con resaltado, marcas de cambios en el margen, ⌘S, ⌘G y sangría con Tab; **Editar y preparar…** abre las líneas elegidas sobre lo preparado para retocarlas antes de prepararlas; desde los archivos de un commit, **Editar archivo con la versión de…** abre tu archivo con el contenido de ese commit y al guardar queda en *Sin preparar*. No pisa cambios hechos por fuera ([[05 - Flujos de Trabajo/Editar Archivos]], [[04 - Interfaz/Editor de Archivos]]).
- Modo captura: `CODYKEN_SNAPSHOT_CONFIRM` y `CODYKEN_SNAPSHOT_MENU` para automatizar diálogos y menús, y la consola del renderer en stdout ([[06 - QA y Tests/Modo Captura]]).
- Tests: de 26 a **98** (nuevos `features`, `conflict`, `branches`, `drop`, `editor`, `linediff`, `editing`; `recent` ya existía) ([[06 - QA y Tests/Suite de Tests]]).

### Cambios y arreglos
- En la barra del diff, *Historial* y *Blame* pasan a botones de icono para dejar sitio a *Editar*.
- **La cabecera del gráfico ya no tiene una línea que sube**: el carril reservado para HEAD/WIP dibujaba un tramo de entrada aunque no hubiera nada encima ([[03 - Algoritmos/Gráfico de Carriles]]).
- **Los stashes se ven donde estaban los cambios**: justo encima de su commit base (antes por fecha, a veces muy lejos) y también los de ramas borradas o rebaseadas, cuya base no se cargaba. Doble clic aplica ([[03 - Algoritmos/Stashes en el Gráfico]]).
- **Fetch adelanta las ramas locales atrasadas**: antes solo actualizaba `origin/…` y las locales quedaban atrás (`↓n`) aunque hicieras fetch. Ahora las que no tienen commits propios se ponen al día; las divergentes se avisan y el cambio se deshace con ⌘Z ([[05 - Flujos de Trabajo/Sincronizar con el Remoto]]).
- **Antes no se podía soltar una rama sobre una remota** (solo sobre filas con rama local); ahora cualquier etiqueta de rama es destino.
- **Una rama igual en local y en remoto se ve una sola vez**: en el gráfico se une también por la rama que sigue (no solo por el nombre) y en el panel *Remoto* las iguales se agrupan en *n iguales a su rama local* ([[03 - Algoritmos/Etiquetas de Ramas]]).
- El rebase al arrastrar ahora sigue la semántica habitual: **rebase de la rama arrastrada encima del destino** (antes era al revés).
- El merge con referencia completa escribe el mensaje como git (*Merge branch 'x' into y*) en vez de *refs/remotes/…*.
- La lista de pull requests se desplaza por dentro con muchos abiertos; los títulos de sección largos ya no se parten en dos líneas.
- La columna Fecha pasa a 118 px para que quepa *hace 9 minutos*; las fechas del rebase interactivo ya no se parten.
- Editor de conflictos: la columna HEAD muestra la rama actual (antes *HEAD · HEAD*) y la barra cabe en una línea.

## 2026-10-20 — Repositorios recientes

- La lista de repos abiertos pasa de 15 a **50** y ahora se abre desde cualquier pestaña: clic en el nombre del repo o **⇧⌘O** ([[04 - Interfaz/Repositorios Recientes]]).
- Búsqueda por nombre o ruta, navegación con teclado y etiquetas *actual*, *en pestaña* y *no encontrado*.
- Quitar elementos con ✕ o clic derecho, **Quitar no encontrados** y **Vaciar** (con confirmación).
- Restaurar pestañas al iniciar ya no devuelve a la lista los repos que quitaste.
- La lista la escribe solo el proceso principal (`removeRecent`); antes, quitar un reciente justo al abrir otro repo podía perder el recién abierto.

## 2026-10-20 — v0.1.0 (commit `7ed9a5f`, publicado en GitHub)

### Base
- Cliente Electron + React + TypeScript con pestañas, barra de acciones, paneles y barra de estado.
- Capa git completa ([[02 - Capa Git/Operaciones de Escritura]]), vigilancia de archivos y ajustes persistentes.
- Staging por archivo, bloque y línea; diff en tres modos; conflictos; paleta de comandos.

### Apariencia "como GitKraken"
- Tema oscuro **Monokai** fijo y resaltado de sintaxis.
- Gráfico con avatares de iniciales, curvas, línea de la etiqueta al nodo, píldoras remotas punteadas, `+n` desplegable, resumen editable en la fila WIP.
- Panel izquierdo con ojo para ocultar ramas, remotos con servidor, carpetas con contador.
- Vista de archivos en lista o árbol y botón *Preparar todos los cambios*.
- Historial y blame de archivo; **Deshacer** con ⌘Z.

### Probado con un repo real grande
- **Orden cronológico** (`--date-order`): eliminó la "escalera" de 15+ carriles que formaban los merges a ramas de despliegue.
- Rama actual siempre en la **primera columna**.
- El gráfico ya no desborda Autor/Fecha sobre el panel derecho (máx. 8 carriles, columnas más compactas).
- Botón **Fetch** visible en la barra.
- Indicadores local ↔ remoto en el panel izquierdo (☁, 💻, `local`).
- **Stashes en el gráfico** con mensaje limpio.

### Encontrado al documentar con capturas
- Un stash con solo archivos nuevos mostraba 0 archivos → ahora lee el commit de no rastreados.
- `local` aparecía en ramas que sí existen en el remoto sin seguimiento → ahora nube tenue.
- Ocultar una rama local no quitaba sus commits si la remota los seguía mostrando → se oculta con sus remotas.
- Tras deshacer un commit, el panel seguía mostrando el commit eliminado → la selección vuelve al WIP.
