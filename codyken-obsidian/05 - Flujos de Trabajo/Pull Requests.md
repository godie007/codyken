---
title: Pull Requests
description: Pull requests de GitHub y merge requests de GitLab — listar, abrir, comparar, checkout y crear
type: flujo
tags:
  - flujo
  - pull-requests
  - github
  - gitlab
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[05 - Flujos de Trabajo/Resolver Conflictos]]"
next: "[[05 - Flujos de Trabajo/Worktrees y LFS]]"
related:
  - "[[04 - Interfaz/Panel Izquierdo#Pull requests]]"
  - "[[01 - Arquitectura/Seguridad]]"
---

# 🔃 Pull requests (GitHub) y merge requests (GitLab)

Codyken no guarda tokens: usa las CLI oficiales **`gh`** y **`glab`** con la sesión que ya tengas (`gh auth login` / `glab auth login`). Todo vive en `src/main/integrations.ts`.

## De qué remoto salen

`locateRemote` toma `origin` (o el primer remoto) y:

1. `parseRemoteUrl` extrae servidor y ruta de URLs SSH cortas (`git@host:dueño/repo.git`), `ssh://` y `https://`.
2. Si el servidor es un **alias de SSH** (p. ej. `git@mi-alias:dueño/repo`), `realHost` lo resuelve con `ssh -G <alias>` (línea `hostname`).
3. `providerOf`: `github.com` → GitHub; `gitlab.com` o un host que contenga `gitlab` → GitLab; otro → sin proveedor (la sección no aparece).

`PullRequestInfo` lleva `provider`, `slug` (dueño/repo o grupo/subgrupo/repo), `remote` (nombre del remoto), `webUrl`, `cliMissing`, `error` e `items`.

## Listar (`getPullRequests`)

```bash
gh pr list --repo <slug> --state open --limit 50 --json number,title,author,headRefName,baseRefName,url,isDraft,updatedAt
glab mr list --repo <webUrl> --per-page 50 --output json
```

Las CLI se lanzan **sin shell**, con 30 s de límite y sin preguntas (`GH_PROMPT_DISABLED`, `GLAB_NO_PROMPT`, `NO_COLOR`…). Si la CLI no está instalada o no tiene sesión, el panel lo explica (con el comando de login) y ofrece *Verlos en el navegador*. Se recargan al abrir el repo, tras cada fetch y con ⟳ en la cabecera de la sección.

## Qué se puede hacer con uno

| Desde | Acción |
|---|---|
| Clic | selecciona su rama en el gráfico (si la tienes) |
| Doble clic / menú → *Checkout del pull request* | `gh pr checkout <n>` / `glab mr checkout <n>`; se puede deshacer |
| Menú → *Abrir en el navegador* | su URL (solo `https`, vía `openExternal`) |
| Menú → *Comparar X con Y* | abre la [[05 - Flujos de Trabajo/Comparar Commits y Ramas\|comparación]] base ↔ rama |

## Crear (`createPr`)

Desde **+** en la cabecera de la sección, la paleta (*Crear pull request de {rama}*), el menú de una rama (*Crear pull request…*) o [[05 - Flujos de Trabajo/Arrastrar y Soltar Ramas|soltando una rama sobre otra]]:

1. Si la rama no está subida, ofrece hacer push (de la actual con *Push*; de otra con `pushBranch … -u`).
2. Abre la página del proveedor para que revises y envíes el PR allí:
   - GitHub sin base: `<web>/pull/new/<rama>`; con base: `<web>/compare/<base>...<rama>?expand=1`;
   - GitLab: `<web>/-/merge_requests/new?merge_request[source_branch]=<rama>` y, con base, `&merge_request[target_branch]=<base>`.

> [!warning] Probado a medias
> `gh` se probó de verdad (listar los PRs abiertos de un repo público y resolver un alias de SSH). **`glab` no estaba instalado**: GitLab solo está cubierto por los tests de los parsers (`parseGitlabMrs`, `parseRemoteUrl`, `providerOf`), no contra una instalación real. Ver [[Limitaciones Conocidas]].
