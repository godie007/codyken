---
title: Decisiones
description: Registro de decisiones de diseño de Codyken y sus motivos
type: decisiones
tags:
  - decisiones
  - arquitectura
updated: 2026-10-20
up: "[[00 - Inicio]]"
---

# 🧭 Decisiones

## Diseño propio inspirado en GitKraken

**Decisión:** replicar la *distribución y las funciones* de GitKraken (que el usuario usa a diario) con código, iconos y estilos propios, estudiando solo su documentación pública.
**Motivo:** GitKraken es software propietario y su licencia prohíbe descompilarlo o hacer ingeniería inversa; un clon exacto copiaría código y recursos protegidos.
**Consecuencia:** no se analiza el binario de GitKraken (tampoco con herramientas como REA). Las funciones nuevas se basan en documentación pública o en capturas que aporte el usuario.

## CLI de git en vez de una librería

**Decisión:** ejecutar `git` del sistema con `spawn`.
**Motivo:** comportamiento idéntico al de la terminal (hooks, config, credenciales, LFS, firmas), sin dependencias nativas, y errores reconocibles.
**Costo:** parsear salidas; se usan formatos con separadores `\x1f`/`\x1e`, `--porcelain` y `-z`.

## Orden cronológico en el gráfico

**Decisión:** `git log --date-order` (antes `--topo-order`).
**Motivo:** en repos con ramas de despliegue que reciben merges frecuentes (`sync dev into deploy/…`), `--topo-order` agrupa todos los merges de una rama y abre un carril por cada uno, formando una "escalera" de 15+ columnas; además dejaba la rama actual lejos de arriba. Con `--date-order` cada merge queda junto al commit que integra y bastan ~5 carriles, como en GitKraken.

## Rama actual en el carril 0

**Decisión:** reservar la primera columna para WIP/HEAD ([[03 - Algoritmos/Gráfico de Carriles#Carril principal reservado]]).
**Motivo:** la rama en la que trabajas es la referencia visual; así no se mueve según qué otras ramas tengan commits más nuevos.

## Stashes como nodos sintéticos

**Decisión:** no incluir `refs/stash` en el log e intercalar un nodo por stash ([[03 - Algoritmos/Stashes en el Gráfico]]).
**Motivo:** los commits internos del stash (índice, no rastreados) ensucian el gráfico y no significan nada para quien lo usa.

## Ocultar la rama local junto con su remota

**Decisión:** el 👁 de una rama local oculta también sus remotas gemelas.
**Motivo:** si no, `origin/x` sigue trayendo los mismos commits y ocultar no tiene efecto visible.

## Tema Monokai fijo

**Decisión:** un único tema oscuro Monokai, sin modo claro.
**Motivo:** pedido explícito del usuario; mantener un solo tema evita estilos a medias.

## Un único canal IPC con lista cerrada

**Decisión:** `codyken:api` + `handlers` con `Object.hasOwn` y `knownRepos`.
**Motivo:** superficie mínima: el renderer no puede invocar nada fuera del contrato `Api` ni operar sobre carpetas que el usuario no abrió.

## Deshacer validado por HEAD

**Decisión:** cada entrada guarda el HEAD/rama que dejó la acción y solo se ejecuta si siguen igual.
**Motivo:** deshacer a ciegas después de cambios hechos en la terminal podría borrar trabajo.

## Semántica de arrastrar y soltar

**Decisión:** al soltar X sobre Y, el **merge** lleva X dentro de Y y el **rebase** reconstruye X encima de Y; una remota sobre una local trae sus cambios (fast-forward, merge o rebase de la local) y una local sobre una remota la sube. El menú se calcula con la divergencia real de las dos ramas (`planDrop`) y solo muestra lo que tiene sentido.
**Motivo:** es la operativa de los clientes Git visuales (soltar mi rama sobre `main` para rebasarla encima, soltar `main` sobre `origin/main` para subirla). Antes el rebase era el inverso (*Rebase de Y sobre X*) y no se podía soltar sobre una rama remota.
**Consecuencia:** todo lo que cambia ramas locales se puede deshacer; si el destino no es la rama actual se hace checkout antes y el deshacer vuelve a la rama en la que estabas. Detalle: [[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas]].

## Push forzado siempre con lease y confirmación

**Decisión:** cuando la rama remota tiene commits que la local no tiene, el menú solo ofrece *Push forzado…*, que pide confirmación destructiva y usa `--force-with-lease=refs/heads/<rama>`; nunca `--force`.
**Motivo:** el lease solo sobrescribe si la remota sigue donde la vio el último fetch, así no se pierde trabajo que alguien subió después. El push no se puede deshacer desde Codyken.

## Una sola entrada para local y remota iguales

**Decisión:** si una rama local y su remota están en el mismo commit, se muestran una sola vez: una etiqueta combinada en el gráfico (uniendo primero por la rama que sigue y luego por el nombre) y, en el panel, solo en *Local*; en *Remoto* solo aparecen al filtrar por su nombre.
**Motivo:** verlas duplicadas hacía pensar que eran dos ramas distintas y llenaba el panel en repos con muchas ramas al día. Las que difieren o solo existen en el remoto siguen visibles, que es la información útil.
**Consecuencia:** al filtrar por texto se muestran todas las coincidencias, también las agrupadas, para que la búsqueda no esconda nada.

## Rebase interactivo sin editor

**Decisión:** el rebase interactivo arma su propia lista y la entrega con `GIT_SEQUENCE_EDITOR="cp '<lista>'"`; *reescribir* es `pick` + `exec git commit --amend -F <archivo>`.
**Motivo:** git sigue haciendo todo el trabajo (conflictos, `--continue`, `--abort`, autostash) sin abrir un editor interactivo, y los mensajes nuevos viajan en archivos, nunca en la línea de comandos. La lista se valida contra los commits reales del rango antes de tocar el repo.

## Pull requests con las CLI oficiales

**Decisión:** listar y hacer checkout de PRs con `gh` / `glab` y crearlos abriendo la página del proveedor.
**Motivo:** Codyken no guarda tokens ni implementa OAuth: reutiliza la sesión que ya existe en la CLI, como hace con las credenciales de git. Crear el PR en la web deja revisar título, descripción y revisores en la herramienta de siempre.

## Fetch que adelanta las ramas atrasadas

**Decisión:** después de `git fetch --all --prune`, toda rama local que solo esté atrasada respecto a su upstream se adelanta (fast-forward); la actual solo con el botón y con `merge --ff-only`. Las divergentes y las activas en otro worktree no se tocan y se avisan.
**Motivo:** con `git fetch` a secas las ramas locales se quedaban atrás aunque el remoto estuviera al día, y parecía que el fetch no funcionaba. Un fast-forward no pierde commits (la rama no tenía nada propio), así que es seguro; aun así se deshace con ⌘Z.
**Consecuencia:** el fetch automático no mueve la rama actual para no cambiar archivos mientras trabajas.

## Editor sin dependencias: textarea sobre el resaltado

**Decisión:** el editor de archivos es un `<textarea>` transparente encima de un `<pre>` resaltado con el `highlight.js` que ya usa el diff, con marcas del margen calculadas con un diff de Myers propio (`lib/linediff.ts`).
**Motivo:** CodeMirror o Monaco añaden cientos de KB y otra forma de temas y atajos que mantener; para retocar líneas antes de un commit basta con escribir, sangrar, deshacer y ver qué cambió. El textarea da gratis la selección, el deshacer nativo, la entrada de acentos y la accesibilidad.
**Consecuencia:** sin ajuste de líneas ni buscar/reemplazar ([[Limitaciones Conocidas]]). Si algún día hacen falta, se cambia el componente sin tocar `readEditable` / `writeEditable`.

## Editar la versión preparada directamente en el índice

**Decisión:** *Preparar esta versión* escribe el blob con `hash-object -w --no-filters` y lo pone en el índice con `update-index --cacheinfo`; la propuesta de *Editar y preparar…* se calcula aplicando el parche sobre una **copia** del índice (`GIT_INDEX_FILE`).
**Motivo:** es lo que hace `git add -e`, sin editor externo ni archivos temporales en el repo, y deja el árbol de trabajo intacto: lo que no preparaste sigue en *Sin preparar*. Con la copia, abrir el editor y cerrarlo sin preparar no cambia nada.
**Consecuencia:** cada lectura trae una huella (sha1 o hash del blob) y escribir exige que no haya cambiado, para no pisar lo que preparaste o editaste por otro lado mientras tanto.
