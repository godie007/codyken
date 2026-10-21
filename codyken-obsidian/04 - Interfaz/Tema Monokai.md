---
title: Tema Monokai
description: Paleta de colores, variables CSS y colores de sintaxis del tema oscuro de Codyken
type: interfaz
tags:
  - interfaz
  - tema
  - estilos
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[04 - Interfaz/Paleta y Atajos]]"
related:
  - "[[Decisiones#Tema Monokai fijo]]"
---

# 🎨 Tema Monokai

Archivo: `src/renderer/src/styles.css`. Tema **oscuro fijo** (no sigue el modo claro del sistema), definido con variables en `:root`.

## Paleta base

| Variable | Color | Uso |
|---|---|---|
| `--mk-bg` | `#272822` | Fondo del gráfico y del código |
| `--mk-fg` | `#f8f8f2` | Texto |
| `--mk-comment` | `#75715e` | Comentarios, texto tenue |
| `--mk-pink` | `#f92672` | Palabras clave, peligro, globos |
| `--mk-orange` | `#fd971f` | Avisos, ↓ por bajar, parámetros |
| `--mk-yellow` | `#e6db74` | Cadenas, etiquetas (tags) |
| `--mk-green` | `#a6e22e` | Éxito, ↑ por subir, botón de commit, funciones |
| `--mk-cyan` | `#66d9ef` | Acento, tipos, primer carril |
| `--mk-purple` | `#ae81ff` | Números, SHA, renombrados, avatar de remoto |

## Superficies

| Variable | Valor |
|---|---|
| `--bg` (ventana) | `#1e1f1c` |
| `--bg-panel` (paneles) | `#23241f` |
| `--bg-elev` (barra, menús) | `#2a2b25` |
| `--bg-hover` / `--bg-active` | `#33342c` / `#3e3d32` |
| `--select-bg` (selección) | `#49483e` |
| `--border` / `--border-strong` | `#3a3b33` / `#4d4e43` |
| `--text-muted` / `--text-faint` | `#b3ae96` / `#75715e` |

Diff: añadido `rgba(166,226,46,.09)` (tramo `.30`), eliminado `rgba(249,38,114,.10)` (tramo `.34`).

## Sintaxis (highlight.js)

| Token | Color |
|---|---|
| `keyword`, `selector-tag`, `name` | rosa |
| `string`, `regexp`, `addition` | amarillo |
| `number`, `literal`, `symbol` | violeta |
| `title`, `function`, `attr`, `attribute` | verde |
| `built_in`, `type` | cian en cursiva |
| `params`, `variable.language_` | naranja |
| `comment`, `quote`, `meta` | `#75715e` (comentarios en cursiva) |

## Carriles

`#66d9ef #a6e22e #f92672 #fd971f #ae81ff #e6db74 #78dce8 #ff6188 #a9dc76 #fc9867` (en `lib/graph.ts`). La fila seleccionada se tiñe con el color de su carril.

## Logo

![[logo.svg|120]]

Un hongo nuclear al atardecer con su onda de choque: la cúpula de aire comprimido que se expande, el anillo de condensación alrededor del tallo y el frente que corre por el suelo levantando polvo. Lo genera `scripts/logo.py` (`python3 scripts/logo.py`), que escribe `src/renderer/src/assets/logo.svg` y `Adjuntos/logo.svg`; la semilla es fija, así que sale siempre igual.

- **Volumen**: cientos de círculos con degradado radial (humo pardo arriba, fuego naranja abajo) y un filtro que deforma los bordes con ruido (`feTurbulence` + `feDisplacementMap`) y les da relieve iluminado (`feDiffuseLighting`). El tallo usa el mismo truco con ruido estirado en vertical.
- **Luz**: sombra azulada del cielo arriba y a la derecha, la bola de fuego asomando bajo el sombrero (`mix-blend-mode: screen`) y su reflejo en el suelo.
- **Icono de la app**: `npx electron scripts/icon.cjs` dibuja el logo en `resources/icon.png` (1024 px, cuadrado de 824 px centrado con sombra, como la plantilla de iconos de macOS). Al arrancar, `index.ts` lo pone en el Dock con `app.dock.setIcon` (sin esto, la app sin empaquetar muestra el átomo de Electron) y como `icon` de la ventana en Windows y Linux. Si cambias el logo, vuelve a ejecutar los dos scripts.
- **En la app** se pinta como `<img>` (`Logo` en `Icons.tsx`): así sus filtros e ids no chocan con los SVG de la interfaz. La CSP lo permite (`img-src 'self'`).

