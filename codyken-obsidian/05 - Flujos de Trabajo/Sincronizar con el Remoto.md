---
title: Sincronizar con el Remoto
description: Fetch, pull en sus tres modos, push, push rechazado y fetch automático
type: flujo
tags:
  - flujo
  - remoto
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Commit por Líneas]]"
next: "[[05 - Flujos de Trabajo/Ramas y Merge]]"
related:
  - "[[02 - Capa Git/Operaciones de Escritura#Remotos]]"
---

# 🔄 Sincronizar con el Remoto

## Fetch

Botón **Fetch** (⌘L): `git fetch --all --prune`. Trae ramas, etiquetas y commits nuevos de **todos los remotos** sin tocar tus ramas ni tus archivos. Después:

- los globos de Pull/Push y los `↑n` / `↓n` del panel izquierdo se actualizan;
- las ramas remotas nuevas aparecen en **Remoto** y en el gráfico (punteadas si no las tienes en local);
- las borradas en el servidor desaparecen y la local que las seguía muestra `✕`.

Además se hace un fetch silencioso a los 4 s de abrir el repo y cada 10 minutos.

## Pull

| Modo | Comando | Cuándo |
|---|---|---|
| *Pull (fast-forward si es posible)* — predeterminado | `pull --no-rebase` | Avanza si no hay divergencia; si la hay, crea un merge |
| *Pull (solo fast-forward)* | `pull --ff-only` | Falla en vez de crear merges |
| *Pull (rebase)* | `pull --rebase` | Reaplica tus commits encima de los del remoto |

La flecha ▾ junto a Pull permite elegir modo puntual o cambiar el predeterminado. Si hay conflictos, ver [[05 - Flujos de Trabajo/Resolver Conflictos]]. Se puede [[05 - Flujos de Trabajo/Deshacer una Acción|deshacer]] (con árbol limpio).

## Push

- Con remota de seguimiento: `git push`.
- Sin ella (rama nueva): `git push -u origin <rama>` (o el primer remoto si no hay `origin`) y queda configurado el seguimiento.
- Desacoplado o sin remotos: error explicado.

### Push rechazado

Si el remoto tiene commits que tú no tienes, Codyken lo detecta y pregunta *"El remoto tiene commits que tú no tienes"*: lo normal es hacer pull primero; **Forzar push** usa `--force-with-lease`, que solo sobrescribe si nadie cambió la rama remota desde tu último fetch.

## Credenciales

Codyken usa las del sistema (llavero, agente SSH, `~/.ssh/config`) y **nunca pregunta** por usuario o clave: si faltan, muestra el error de git. Para HTTPS con otra cuenta, inicia sesión con `gh auth login` o usa un alias SSH del `~/.ssh/config` en la URL del remoto.
