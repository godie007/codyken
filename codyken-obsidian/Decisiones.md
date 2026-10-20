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
