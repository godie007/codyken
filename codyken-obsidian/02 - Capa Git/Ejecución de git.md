---
title: Ejecución de git
description: Función git() del proceso principal; entorno, códigos de salida, errores y validación de argumentos
type: modulo
tags:
  - capa-git
  - main
updated: 2026-10-20
up: "[[00 - Inicio]]"
next: "[[02 - Capa Git/Lectura del Repositorio]]"
related:
  - "[[01 - Arquitectura/Seguridad]]"
---

# ⚙️ Ejecución de git

Archivo: `src/main/git.ts`. Toda operación termina en:

```ts
git(cwd: string, args: string[], { input?, okCodes? }): Promise<string>
```

- Lanza `spawn('git', ['-c', 'core.quotepath=false', '-c', 'color.ui=false', ...args])` **sin shell**.
  - `core.quotepath=false`: rutas con tildes y eñes llegan tal cual, no como `\303\261`.
  - `color.ui=false`: la salida se puede parsear aunque el usuario tenga colores activados.
- `input` se escribe por `stdin` (mensajes de commit con `-F -`, parches con `git apply -`).
- `okCodes` (por defecto `[0]`) permite tratar como éxito otros códigos: p. ej. `diff --no-index` devuelve 1 cuando hay diferencias.
- Si falla, rechaza con `GitError` cuyo mensaje es el **stderr real** (o stdout, o "git X terminó con código N"). Si `git` no existe: *"No se encontró git. Instala las herramientas de línea de comandos de Xcode."*

## 🌱 Entorno (`buildEnv`)

| Variable | Valor | Por qué |
|---|---|---|
| `PATH` | el heredado + `/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`, `/bin` | Las apps abiertas desde Finder heredan un PATH mínimo |
| `GIT_TERMINAL_PROMPT` | `0` | Sin terminal no hay a quién pedir credenciales: mejor fallar |
| `GIT_OPTIONAL_LOCKS` | `0` | Las lecturas (`status`) no bloquean el índice mientras trabajas en la terminal |
| `GIT_EDITOR` | `true` | Ningún comando abre un editor |
| `GIT_MERGE_AUTOEDIT` | `no` | Merge sin editor de mensaje |
| `GIT_SSH_COMMAND` | `ssh -o BatchMode=yes` (si no hay uno definido) | SSH nunca pide clave interactiva |

## 🧪 Validaciones

| Función | Regla |
|---|---|
| `assertArg(valor, qué)` | No vacío, no empieza por `-`, sin `\0` |
| `assertBranchName` | `assertArg` + `git check-ref-format --branch` |
| `safeRef` | `^refs/(heads\|remotes\|tags)/` y sin `..` (filtro del gráfico) |
| `createTag` | `git check-ref-format refs/tags/<nombre>` |

Los argumentos de rutas de archivo siempre van después de `--`.

## Utilidades internas

- `hasHead(repo)` — si hay al menos un commit (`rev-parse --verify -q HEAD`).
- `currentBranch(repo)` — `symbolic-ref --short -q HEAD`, o `null` si está desacoplado.
- Separadores de campo `\x1f` y de registro `\x1e` en los `--format` para parsear sin ambigüedad.
