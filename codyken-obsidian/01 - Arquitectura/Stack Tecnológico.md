---
title: Stack Tecnológico
description: Tecnologías y versiones de Codyken (Electron, React, TypeScript, Vite, vitest, highlight.js)
type: arquitectura
tags:
  - arquitectura
  - stack
  - dependencias
updated: 2026-10-20
up: "[[01 - Arquitectura/Visión General]]"
prev: "[[01 - Arquitectura/Visión General]]"
next: "[[01 - Arquitectura/Procesos e IPC]]"
related:
  - "[[Desarrollo]]"
---

# 🧰 Stack Tecnológico

Versiones del rango declarado en `package.json` (versión de la app: **0.1.0**).

| Capa | Tecnología | Versión | Uso |
|---|---|---|---|
| Escritorio | Electron | 44.9 | Ventana, IPC, menús nativos, diálogos |
| Build | electron-vite | 6.0 | Compila main, preload y renderer; servidor de desarrollo con recarga |
| Bundler | Vite + `@vitejs/plugin-react` | 8.3 / 6.1 | Renderer |
| UI | React + React DOM | 19.3 | Componentes funcionales y hooks, sin librería de estado |
| Lenguaje | TypeScript | 7.0 | Dos proyectos: `tsconfig.node.json` (main, preload, lib, tests) y `tsconfig.web.json` (renderer) |
| Resaltado | highlight.js (`lib/common`) | 11.12 | Sintaxis en diff y blame, coloreada con el [[04 - Interfaz/Tema Monokai\|tema Monokai]] |
| Tests | vitest | 5.0 | Unitarios y contra git real en carpetas temporales |
| Tipos Node | `@types/node` | 22 | — |

**Runtime de desarrollo:** Node 22 (probado con 22.12) y `git` ≥ 2.40 en el `PATH` (probado con 2.54).

No hay dependencias nativas ni librerías de Git (libgit2, isomorphic-git): todo pasa por la CLI de `git` (ver [[Decisiones]]).

Los iconos son SVG propios (`components/Icons.tsx`) y la tipografía es la del sistema (`-apple-system`, `SF Mono` para código).
