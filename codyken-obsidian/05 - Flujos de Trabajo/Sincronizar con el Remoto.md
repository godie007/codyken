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

Botón **Fetch** (⌘L): `git fetch --all --prune` (con `--unshallow` si el clon era superficial, para traer la historia completa). Trae ramas, etiquetas y commits nuevos de **todos los remotos**.

`git fetch` por sí solo **nunca mueve las ramas locales**: solo actualiza `origin/…`. Por eso, después del fetch, Codyken **adelanta (fast-forward) cada rama local que solo estaba atrasada** respecto a su upstream:

| Rama local | Qué pasa |
|---|---|
| Solo atrasada (`↓n`, sin `↑`) | Se adelanta hasta su remota con `update-ref` (comprobando el valor anterior) |
| La rama actual, solo atrasada | Solo con el botón Fetch, con `merge --ff-only`: git lo rechaza si pisaría cambios sin confirmar y queda en el aviso. El fetch automático no la toca, para no cambiar archivos mientras trabajas |
| Con commits propios y del remoto (`↑n ↓m`) | No se toca; el aviso dice que necesita pull (merge o rebase) |
| Activa en otro worktree | No se toca; el aviso dice en cuál |
| Con commits propios sin bajar nada (`↑n`) | Nada que traer: hay que hacer push |

El aviso resume qué ramas se adelantaron, cuáles divergen y cuáles se saltaron. **Deshacer** (⌘Z) devuelve las ramas locales a donde estaban (las remotas siguen actualizadas); el fetch automático adelanta sin registrar deshacer.

![[fetch.png]]

Después:

- los globos de Pull/Push y los `↑n` / `↓n` del panel izquierdo se actualizan;
- las ramas remotas nuevas aparecen en **Remoto** y en el gráfico (punteadas si no las tienes en local);
- las borradas en el servidor desaparecen y la local que las seguía muestra `✕`.

Además se hace un fetch silencioso a los 4 s de abrir el repo y cada 10 minutos (adelanta las ramas atrasadas salvo la actual).

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
