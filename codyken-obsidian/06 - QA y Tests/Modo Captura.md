---
title: Modo Captura
description: Cómo tomar capturas de la app sin intervención y automatizar clics con CODYKEN_SNAPSHOT_JS
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

> [!warning] Menús nativos
> Los menús contextuales y los diálogos de confirmación son nativos: no aparecen en `capturePage` ni se pueden pulsar desde el script.
