---
title: Modo Captura
description: Cómo tomar capturas de la app sin intervención y automatizar clics, menús, confirmaciones y arrastres
type: qa
tags:
  - qa
  - capturas
updated: 2026-10-20
up: "[[00 - Inicio]]"
prev: "[[06 - QA y Tests/Suite de Tests]]"
next: "[[06 - QA y Tests/Verificación Visual]]"
---

# 📸 Modo Captura

Solo en desarrollo (`!app.isPackaged`). Abre un repo, espera, ejecuta un script opcional, guarda un PNG de la ventana y cierra la app.

```bash
npx electron-vite build
CODYKEN_SNAPSHOT=/ruta/foto.png CODYKEN_OPEN=/ruta/repo npx electron .
```

| Variable | Por defecto | Qué hace |
|---|---|---|
| `CODYKEN_SNAPSHOT` | — | Ruta del PNG; activa el modo |
| `CODYKEN_OPEN` | — | Repo que se abre en una única pestaña |
| `CODYKEN_SNAPSHOT_DELAY` | 2500 ms | Espera tras cargar la página |
| `CODYKEN_SNAPSHOT_JS` | — | Script que se ejecuta en la ventana antes de la foto |
| `CODYKEN_SNAPSHOT_SETTLE` | 1200 ms | Espera tras el script |
| `CODYKEN_SNAPSHOT_CONFIRM` | — | Con `1`, los diálogos de confirmación (`confirm`) se aceptan solos |
| `CODYKEN_SNAPSHOT_MENU` | — | Los menús contextuales no se abren: se imprime en la consola `[menu] [...]` con sus opciones (las deshabilitadas entre paréntesis) y se elige la primera habilitada cuya etiqueta **contenga** ese texto (ninguna si no coincide, p. ej. `-`) |

Usa su propia carpeta de ajustes (`$TMPDIR/codyken-snapshot`), así que **no toca tus pestañas ni filtros**. Esa carpeta persiste entre corridas: un filtro de ramas activado en una captura sigue en la siguiente (los scripts de ejemplo empiezan pulsando *Mostrar todas*).

## Ejemplo de script

```js
(async () => {
  const w = (t) => new Promise((r) => setTimeout(r, t))
  const q = (sel, txt) => [...document.querySelectorAll(sel)].find((e) => e.textContent.includes(txt))
  document.querySelector('.lp-filter-banner .link')?.click()   // limpiar filtro
  await w(1200)
  q('.graph-row', 'Ajusta el README').click()                  // seleccionar commit
  await w(900)
  q('.file-row', 'README').click()                             // abrir diff
  await w(900)
  q('.diff-toolbar button', 'Blame').click()                   // abrir blame
})()
```

Para escribir en un campo controlado por React hay que usar el *setter* nativo y disparar `input`:

```js
const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
set.call(input, 'pull'); input.dispatchEvent(new Event('input', { bubbles: true }))
```

Las capturas del README y de esta bóveda (`Adjuntos/capturas/`) se tomaron así, reducidas a 1600 px con `sips -Z 1600`.

## Arrastrar y soltar desde el script

Los eventos de arrastre se simulan con un `DataTransfer` propio; con `CODYKEN_SNAPSHOT_MENU` se elige la opción del menú de soltar y la consola muestra qué ofreció:

```js
const pill = (t) => [...document.querySelectorAll('.graph .pill')].find((e) => e.textContent.trim() === t)
const drag = async (from, to) => {
  const dt = new DataTransfer()
  from.dispatchEvent(new DragEvent('dragstart', { bubbles: true, dataTransfer: dt }))
  to.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }))
  to.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }))
}
await drag(pill('main'), pill('origin/main'))
```

```bash
CODYKEN_SNAPSHOT_MENU='Rebase de main' CODYKEN_SNAPSHOT_CONFIRM=1 CODYKEN_SNAPSHOT=foto.png CODYKEN_OPEN=/ruta/repo \
  CODYKEN_SNAPSHOT_JS="(async()=>{ … })()" npx electron . 2>&1 | grep '\[menu\]'
# [menu] ["Push forzado de main a origin/main…","Rebase de main sobre origin/main","Rebase interactivo de main sobre origin/main…"]
```

Para la foto del destino resaltado basta con `dragstart` + `dragover` (sin `drop`): así se tomó `arrastrar.png`.

> [!warning] Menús nativos
> Los menús contextuales y los diálogos de confirmación son nativos: no aparecen en `capturePage`. Sin las dos variables anteriores, un diálogo abierto bloquea el script; con ellas se contestan solos (solo en desarrollo: `snapshotPath` exige `!app.isPackaged`).
