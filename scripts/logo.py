#!/usr/bin/env python3
"""Genera el logo de Codyken: hongo nuclear con onda de choque.

Uso (desde la raíz del repo): python3 scripts/logo.py
Escribe el mismo SVG en la app y en la bóveda. La semilla es fija: sale siempre igual.
"""
import math
import random
import sys

random.seed(20261020)
W = 512
CX = 256


def lerp(a, b, t):
    return a + (b - a) * t


def hex2rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def mix(c1, c2, t):
    a, b = hex2rgb(c1), hex2rgb(c2)
    return '#%02x%02x%02x' % tuple(round(lerp(x, y, max(0, min(1, t)))) for x, y in zip(a, b))


def f(v):
    return f'{v:.1f}'.rstrip('0').rstrip('.')


defs = []
body = []

# ── Paletas por altura ──────────────────────────────────────────────────────
# Cada banda: (luz, base, sombra). Arriba humo pardo grisáceo; abajo el fuego.
CAP_TOP = ('#d9c3a8', '#8c7464', '#2e2420')
CAP_MID = ('#f4c58a', '#b46a3c', '#3f2318')
CAP_LOW = ('#fff1c2', '#ff9a2e', '#8a2c0c')
STEM_TOP = ('#ffd79a', '#e0782c', '#5e2410')
STEM_LOW = ('#c99872', '#6e4a35', '#21160f')
DUST = ('#e2b47c', '#8a6446', '#2a1c14')
DUST_FAR = ('#9c8270', '#544036', '#1d1512')


def band(p1, p2, t):
    return tuple(mix(a, b, t) for a, b in zip(p1, p2))


gradients = {}


def billow_gradient(palette):
    key = palette
    if key in gradients:
        return gradients[key]
    gid = f'b{len(gradients)}'
    hi, base, lo = palette
    # Luz desde arriba a la izquierda (cielo) y algo de rebote desde abajo en las bandas de fuego
    defs.append(
        f'<radialGradient id="{gid}" cx="0.45" cy="0.42" r="0.6" fx="0.36" fy="0.3">'
        f'<stop offset="0" stop-color="{mix(hi, base, 0.15)}"/>'
        f'<stop offset="0.4" stop-color="{base}"/>'
        f'<stop offset="0.8" stop-color="{mix(base, lo, 0.55)}"/>'
        f'<stop offset="1" stop-color="{mix(base, lo, 0.8)}" stop-opacity="0.55"/>'
        f'</radialGradient>'
    )
    gradients[key] = gid
    return gid


def palette_steps(p1, p2, steps):
    return [band(p1, p2, i / (steps - 1)) for i in range(steps)]


def pick(palettes, t):
    return palettes[max(0, min(len(palettes) - 1, round(t * (len(palettes) - 1))))]


# ── Cielo, suelo y destello ────────────────────────────────────────────────
defs.append('''
<clipPath id="frame"><rect width="512" height="512" rx="112"/></clipPath>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#0b1020"/>
  <stop offset="0.38" stop-color="#232338"/>
  <stop offset="0.62" stop-color="#5a3c45"/>
  <stop offset="0.76" stop-color="#b25a30"/>
  <stop offset="0.8" stop-color="#e08a3c"/>
  <stop offset="1" stop-color="#3a2014"/>
</linearGradient>
<radialGradient id="flash" cx="256" cy="300" r="300" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#ffcf7a" stop-opacity="0.75"/>
  <stop offset="0.35" stop-color="#ff8a2a" stop-opacity="0.35"/>
  <stop offset="1" stop-color="#ff6a1a" stop-opacity="0"/>
</radialGradient>
<linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#4a2a18"/>
  <stop offset="0.25" stop-color="#26160e"/>
  <stop offset="1" stop-color="#080505"/>
</linearGradient>
<radialGradient id="groundGlow" cx="256" cy="402" r="230" gradientTransform="translate(0 322) scale(1 0.2)" gradientUnits="userSpaceOnUse">
  <stop offset="0" stop-color="#ffb04a" stop-opacity="0.9"/>
  <stop offset="0.4" stop-color="#d0601e" stop-opacity="0.45"/>
  <stop offset="1" stop-color="#7a2a0a" stop-opacity="0"/>
</radialGradient>
<radialGradient id="core" cx="0.5" cy="0.5" r="0.5">
  <stop offset="0" stop-color="#ffffff"/>
  <stop offset="0.25" stop-color="#fff4c4"/>
  <stop offset="0.55" stop-color="#ffb43c"/>
  <stop offset="1" stop-color="#ff6a12" stop-opacity="0"/>
</radialGradient>
<linearGradient id="capShade" x1="0" y1="0.2" x2="1" y2="0.5">
  <stop offset="0" stop-color="#1a1020" stop-opacity="0.15"/>
  <stop offset="0.35" stop-color="#1a1020" stop-opacity="0"/>
  <stop offset="0.6" stop-color="#1a1020" stop-opacity="0.12"/>
  <stop offset="1" stop-color="#1a1020" stop-opacity="0.7"/>
</linearGradient>
<linearGradient id="capTopShade" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#2a2440" stop-opacity="0.5"/>
  <stop offset="0.45" stop-color="#2a2440" stop-opacity="0"/>
</linearGradient>
<linearGradient id="stemShade" x1="0" y1="0" x2="1" y2="0">
  <stop offset="0" stop-color="#000" stop-opacity="0.55"/>
  <stop offset="0.35" stop-color="#000" stop-opacity="0"/>
  <stop offset="0.7" stop-color="#000" stop-opacity="0.15"/>
  <stop offset="1" stop-color="#000" stop-opacity="0.65"/>
</linearGradient>
<linearGradient id="stemHeat" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#ffcf6a" stop-opacity="0.85"/>
  <stop offset="0.35" stop-color="#ff7a22" stop-opacity="0.35"/>
  <stop offset="1" stop-color="#ff7a22" stop-opacity="0"/>
</linearGradient>
<radialGradient id="vignette" cx="0.5" cy="0.45" r="0.75">
  <stop offset="0.6" stop-color="#000" stop-opacity="0"/>
  <stop offset="1" stop-color="#000" stop-opacity="0.55"/>
</radialGradient>
<linearGradient id="shockStroke" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#fff6e6" stop-opacity="0.9"/>
  <stop offset="0.7" stop-color="#ffd9a8" stop-opacity="0.35"/>
  <stop offset="1" stop-color="#ffb070" stop-opacity="0"/>
</linearGradient>

<!-- Humo: bordes deformados con ruido y relieve iluminado -->
<filter id="billow" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.028" numOctaves="5" seed="11" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="20" xChannelSelector="R" yChannelSelector="G" result="shape"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.085" numOctaves="5" seed="4" result="grain"/>
  <feDiffuseLighting in="grain" surfaceScale="2.2" diffuseConstant="1.05" lighting-color="#ffffff" result="relief">
    <feDistantLight azimuth="225" elevation="50"/>
  </feDiffuseLighting>
  <feComposite in="shape" in2="relief" operator="arithmetic" k1="0.95" k2="0.24" k3="0" k4="0" result="lit"/>
  <feComposite in="lit" in2="shape" operator="in"/>
</filter>
<filter id="dust" x="-10%" y="-40%" width="120%" height="180%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.03 0.09" numOctaves="4" seed="23" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="18" xChannelSelector="R" yChannelSelector="G" result="shape"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.08" numOctaves="4" seed="9" result="grain"/>
  <feDiffuseLighting in="grain" surfaceScale="1.5" diffuseConstant="1" lighting-color="#ffffff" result="relief">
    <feDistantLight azimuth="250" elevation="45"/>
  </feDiffuseLighting>
  <feComposite in="shape" in2="relief" operator="arithmetic" k1="0.7" k2="0.4" k3="0" k4="0" result="lit"/>
  <feComposite in="lit" in2="shape" operator="in" result="done"/>
  <feGaussianBlur in="done" stdDeviation="0.6"/>
</filter>
<filter id="column" x="-30%" y="-5%" width="160%" height="110%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.09 0.018" numOctaves="4" seed="17" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="9" xChannelSelector="R" yChannelSelector="G" result="shape"/>
  <feTurbulence type="fractalNoise" baseFrequency="0.12 0.03" numOctaves="4" seed="3" result="grain"/>
  <feDiffuseLighting in="grain" surfaceScale="1.8" diffuseConstant="1" lighting-color="#ffffff" result="relief">
    <feDistantLight azimuth="200" elevation="50"/>
  </feDiffuseLighting>
  <feComposite in="shape" in2="relief" operator="arithmetic" k1="0.75" k2="0.38" k3="0" k4="0" result="lit"/>
  <feComposite in="lit" in2="shape" operator="in"/>
</filter>
<filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="9"/>
</filter>
<filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
  <feGaussianBlur stdDeviation="3"/>
</filter>
<filter id="vapor" x="-20%" y="-200%" width="140%" height="500%" color-interpolation-filters="sRGB">
  <feTurbulence type="fractalNoise" baseFrequency="0.05 0.2" numOctaves="3" seed="31" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="10" xChannelSelector="R" yChannelSelector="G" result="shape"/>
  <feGaussianBlur in="shape" stdDeviation="2.2"/>
</filter>
<filter id="shock" x="-10%" y="-30%" width="120%" height="160%">
  <feTurbulence type="fractalNoise" baseFrequency="0.02" numOctaves="2" seed="5" result="warp"/>
  <feDisplacementMap in="SourceGraphic" in2="warp" scale="5" xChannelSelector="R" yChannelSelector="G" result="shape"/>
  <feGaussianBlur in="shape" stdDeviation="1.4"/>
</filter>
''')

body.append('<rect width="512" height="512" fill="url(#sky)"/>')
body.append('<rect width="512" height="512" fill="url(#flash)"/>')

# Nubes lejanas iluminadas por el destello (franjas finas)
for i in range(7):
    y = 250 + i * 14 + random.uniform(-4, 4)
    x = random.uniform(-40, 380)
    w = random.uniform(120, 260)
    op = 0.10 + 0.05 * i / 7
    body.append(f'<ellipse cx="{f(x + w / 2)}" cy="{f(y)}" rx="{f(w / 2)}" ry="{f(random.uniform(2, 4))}" fill="#ffb27a" opacity="{f(op)}" filter="url(#softGlow)"/>')

HORIZON = 396
body.append(f'<rect y="{HORIZON}" width="512" height="{512 - HORIZON}" fill="url(#ground)"/>')
body.append(f'<rect y="{HORIZON - 4}" width="512" height="{512 - HORIZON + 4}" fill="url(#groundGlow)"/>')
# Línea de horizonte con montañas bajas a contraluz
pts = [(0, HORIZON)]
x = 0
while x < 512:
    x += random.uniform(14, 34)
    pts.append((x, HORIZON - random.uniform(1, 9) * (1 if abs(x - CX) > 150 else 0.3)))
pts += [(512, HORIZON), (512, HORIZON + 6), (0, HORIZON + 6)]
body.append('<path d="M' + ' L'.join(f'{f(a)} {f(b)}' for a, b in pts) + 'Z" fill="#1a0f0a" opacity="0.9"/>')

# ── Onda de choque: cúpula que se expande ───────────────────────────────────
SHOCK_RX, SHOCK_RY = 236, 178
defs.append(f'''<radialGradient id="shockHaze" cx="{CX}" cy="{HORIZON}" r="{SHOCK_RX}" gradientTransform="translate(0 {HORIZON * (1 - SHOCK_RY / SHOCK_RX):.1f}) scale(1 {SHOCK_RY / SHOCK_RX:.4f})" gradientUnits="userSpaceOnUse">
  <stop offset="0.7" stop-color="#ffd6a8" stop-opacity="0"/>
  <stop offset="0.97" stop-color="#ffd6a8" stop-opacity="0.13"/>
  <stop offset="1" stop-color="#ffd6a8" stop-opacity="0"/>
</radialGradient>''')
body.append(f'<path d="M{CX - SHOCK_RX} {HORIZON} A{SHOCK_RX} {SHOCK_RY} 0 0 1 {CX + SHOCK_RX} {HORIZON}Z" fill="url(#shockHaze)"/>')
body.append(
    f'<path d="M{CX - SHOCK_RX} {HORIZON} A{SHOCK_RX} {SHOCK_RY} 0 0 1 {CX + SHOCK_RX} {HORIZON}" '
    f'fill="none" stroke="#ffe7c8" stroke-opacity="0.07" stroke-width="26" filter="url(#shock)"/>'
)
body.append(
    f'<path d="M{CX - SHOCK_RX} {HORIZON} A{SHOCK_RX} {SHOCK_RY} 0 0 1 {CX + SHOCK_RX} {HORIZON}" '
    f'fill="none" stroke="url(#shockStroke)" stroke-width="2.2" filter="url(#shock)"/>'
)
body.append(
    f'<path d="M{CX - SHOCK_RX + 14} {HORIZON} A{SHOCK_RX - 14} {SHOCK_RY - 12} 0 0 1 {CX + SHOCK_RX - 14} {HORIZON}" '
    f'fill="none" stroke="#fff3e0" stroke-opacity="0.18" stroke-width="1" filter="url(#shock)"/>'
)

# ── Polvo lejano levantado por el frente de choque (detrás del tallo) ───────
dust_far = palette_steps(DUST_FAR, DUST, 4)
items = []
for i in range(70):
    x = random.uniform(30, 482)
    d = abs(x - CX) / 226
    y = HORIZON - random.uniform(2, 16) * (1.2 - d * 0.6)
    r = random.uniform(8, 18) * (1.15 - d * 0.5)
    items.append((y, x, r, pick(dust_far, 1 - d)))
items.sort()
body.append('<g filter="url(#dust)">')
for y, x, r, pal in items:
    body.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="url(#{billow_gradient(pal)})"/>')
body.append('</g>')

# ── Anillo de condensación: mitad trasera ───────────────────────────────────
RING_Y, RING_RX, RING_RY = 302, 98, 14
for i in range(46):
    a = random.uniform(math.pi, 2 * math.pi)
    x = CX + math.cos(a) * RING_RX * random.uniform(0.9, 1.08)
    y = RING_Y + math.sin(a) * RING_RY * random.uniform(0.7, 1.2)
    w = random.uniform(10, 22)
    op = random.uniform(0.15, 0.35) * (0.55 + 0.45 * abs(math.sin(a)))
    body.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(w)}" ry="{f(w * 0.28)}" fill="#f1e4e6" opacity="{f(op)}" filter="url(#vapor)"/>')

# ── Tallo ───────────────────────────────────────────────────────────────────
STEM_TOP_Y, STEM_BASE_Y = 206, HORIZON + 4


def stem_half(y):
    t = (y - STEM_TOP_Y) / (STEM_BASE_Y - STEM_TOP_Y)
    # Se abre arriba (lo absorbe el sombrero) y abajo (sale del polvo), estrecho en el medio
    return 24 + 26 * (1 - t) ** 4 + 40 * t ** 3.2


left = [(CX - stem_half(y) + random.uniform(-1.5, 1.5), y) for y in range(STEM_TOP_Y, STEM_BASE_Y + 1, 5)]
right = [(CX + stem_half(y) + random.uniform(-1.5, 1.5), y) for y in range(STEM_BASE_Y, STEM_TOP_Y - 1, -5)]
stem_path = 'M' + ' L'.join(f'{f(a)} {f(b)}' for a, b in left + right) + 'Z'
defs.append(f'''<clipPath id="stemClip"><path d="{stem_path}"/></clipPath>
<linearGradient id="stemBody" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="#f08a34"/>
  <stop offset="0.22" stop-color="#b85a28"/>
  <stop offset="0.55" stop-color="#7a4c34"/>
  <stop offset="1" stop-color="#4a3428"/>
</linearGradient>''')

body.append('<g filter="url(#column)">')
body.append(f'<path d="{stem_path}" fill="url(#stemBody)"/>')
# Remolinos grandes y suaves subiendo por el tallo
stem_pals = palette_steps(STEM_TOP, STEM_LOW, 6)
y = STEM_TOP_Y + 4
while y < STEM_BASE_Y - 10:
    hw = stem_half(y)
    t = (y - STEM_TOP_Y) / (STEM_BASE_Y - STEM_TOP_Y)
    for side in (-1, 1):
        r = hw * random.uniform(0.45, 0.6)
        x = CX + side * (hw - r * 0.85)
        body.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(r)}" ry="{f(r * 1.3)}" fill="url(#{billow_gradient(pick(stem_pals, t))})" opacity="0.8"/>')
    y += random.uniform(16, 22)
body.append('</g>')
body.append(f'<g clip-path="url(#stemClip)"><rect x="{CX - 100}" y="{STEM_TOP_Y}" width="200" height="{STEM_BASE_Y - STEM_TOP_Y}" fill="url(#stemShade)"/>'
            f'<rect x="{CX - 100}" y="{STEM_TOP_Y}" width="200" height="{STEM_BASE_Y - STEM_TOP_Y}" fill="url(#stemHeat)" style="mix-blend-mode:screen"/></g>')

# ── Anillo de condensación: mitad delantera ─────────────────────────────────
for i in range(46):
    a = random.uniform(0, math.pi)
    x = CX + math.cos(a) * RING_RX * random.uniform(0.9, 1.08)
    y = RING_Y + math.sin(a) * RING_RY * random.uniform(0.7, 1.2)
    w = random.uniform(10, 22)
    op = random.uniform(0.22, 0.48) * (0.55 + 0.45 * abs(math.sin(a)))
    body.append(f'<ellipse cx="{f(x)}" cy="{f(y)}" rx="{f(w)}" ry="{f(w * 0.28)}" fill="#f1e4e6" opacity="{f(op)}" filter="url(#vapor)"/>')

# ── Sombrero ────────────────────────────────────────────────────────────────
CAP_CY, CAP_RX, CAP_RY = 168, 146, 86
CAP_BOTTOM = 226


def cap_top(x):
    u = (x - CX) / CAP_RX
    if abs(u) >= 1:
        return None
    return CAP_CY - CAP_RY * math.sqrt(1 - u * u) * (1 - 0.12 * u * u)


def cap_bottom(x):
    u = (x - CX) / CAP_RX
    # El borde inferior se enrolla hacia arriba en los extremos (toroide)
    return CAP_BOTTOM - 30 * u ** 2 - 10 * u ** 6


cap_pals = palette_steps(CAP_TOP, CAP_MID, 4) + palette_steps(CAP_MID, CAP_LOW, 4)[1:]

# Resplandor de la bola de fuego bajo el sombrero
body.append(f'<ellipse cx="{CX}" cy="{CAP_BOTTOM - 8}" rx="120" ry="40" fill="#ff8a2a" opacity="0.55" filter="url(#glow)"/>')

body.append('<g filter="url(#billow)">')
outline = [(x, cap_top(x)) for x in range(CX - CAP_RX + 2, CX + CAP_RX - 1, 4)] + [
    (x, cap_bottom(x)) for x in range(CX + CAP_RX - 2, CX - CAP_RX + 1, -4)
]
body.append('<path d="M' + ' L'.join(f'{f(a)} {f(b)}' for a, b in outline) + f'Z" fill="{CAP_MID[1]}"/>')

items = []
# Relleno interior: filas de bolas, más grandes arriba
y = CAP_CY - CAP_RY + 6
while y < CAP_BOTTOM + 4:
    xs = [x for x in range(CX - CAP_RX, CX + CAP_RX) if cap_top(x) is not None and cap_top(x) <= y <= cap_bottom(x) + 4]
    if xs:
        x0, x1 = min(xs), max(xs)
        x = x0 + random.uniform(0, 10)
        t = (y - (CAP_CY - CAP_RY)) / (CAP_BOTTOM - (CAP_CY - CAP_RY))
        while x < x1:
            r = random.uniform(15, 27) * (1.25 - 0.55 * t)
            items.append((y + random.uniform(-4, 4), x, r, t))
            x += r * random.uniform(1.05, 1.5)
    y += random.uniform(11, 16)
# Borde superior: la silueta de coliflor
for x in range(CX - CAP_RX + 12, CX + CAP_RX - 10, 13):
    top = cap_top(x)
    if top is None:
        continue
    r = random.uniform(14, 24)
    items.append((top + r * 0.55, x + random.uniform(-3, 3), r, 0.05))
# Labio inferior enrollado y encendido
for x in range(CX - CAP_RX + 18, CX + CAP_RX - 16, 11):
    r = random.uniform(10, 17)
    items.append((cap_bottom(x) - r * 0.3, x + random.uniform(-3, 3), r, 1.0))
items.sort()
for y, x, r, t in items:
    body.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="url(#{billow_gradient(pick(cap_pals, t ** 1.15))})"/>')
body.append('</g>')

# Sombra lateral y del cielo sobre el sombrero
defs.append('<clipPath id="capClip"><path d="M' + ' L'.join(f'{f(a)} {f(b)}' for a, b in outline) + 'Z"/>'
            + ''.join(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}"/>' for y, x, r, t in items) + '</clipPath>')
body.append(f'<g clip-path="url(#capClip)" filter="url(#billow)">'
            f'<rect x="{CX - CAP_RX - 20}" y="{CAP_CY - CAP_RY - 20}" width="{2 * CAP_RX + 40}" height="{CAP_BOTTOM - CAP_CY + CAP_RY + 40}" fill="url(#capShade)"/>'
            f'<rect x="{CX - CAP_RX - 20}" y="{CAP_CY - CAP_RY - 20}" width="{2 * CAP_RX + 40}" height="{CAP_BOTTOM - CAP_CY + CAP_RY + 40}" fill="url(#capTopShade)"/></g>')

# Núcleo incandescente que asoma bajo el sombrero, donde entra el tallo
body.append(f'<ellipse cx="{CX}" cy="{CAP_BOTTOM - 10}" rx="96" ry="26" fill="url(#core)" opacity="0.75" filter="url(#glow)" style="mix-blend-mode:screen"/>')
body.append(f'<ellipse cx="{CX}" cy="{CAP_BOTTOM - 4}" rx="40" ry="11" fill="url(#core)" filter="url(#softGlow)" style="mix-blend-mode:screen"/>')

# ── Nube de polvo de la base y frente de choque a ras de suelo ──────────────
dust_pals = palette_steps(DUST, DUST_FAR, 5)
items = []
for i in range(150):
    x = random.gauss(CX, 80)
    if not 16 < x < 496:
        continue
    d = min(1, abs(x - CX) / 230)
    height = 34 * math.exp(-(d * 3.2) ** 2) + 10 * (1 - d)
    y = HORIZON + 6 - random.uniform(0, height)
    r = random.uniform(10, 20) * (1.3 - d * 0.65)
    items.append((y, x, r, pick(dust_pals, d * 0.8 + (y < HORIZON - 20) * 0.1)))
items.sort()
body.append('<g filter="url(#dust)">')
for y, x, r, pal in items:
    body.append(f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r)}" fill="url(#{billow_gradient(pal)})"/>')
body.append('</g>')
# El frente de choque corriendo por el suelo: un anillo brillante muy aplanado
body.append(f'<ellipse cx="{CX}" cy="{HORIZON + 8}" rx="{SHOCK_RX - 2}" ry="14" fill="none" stroke="#ffdcae" stroke-opacity="0.55" stroke-width="2" filter="url(#shock)"/>')
body.append(f'<ellipse cx="{CX}" cy="{HORIZON + 8}" rx="{SHOCK_RX - 2}" ry="14" fill="none" stroke="#ff9a4a" stroke-opacity="0.25" stroke-width="7" filter="url(#glow)"/>')
# Luz del fuego reflejada en el suelo
body.append(f'<ellipse cx="{CX}" cy="{HORIZON + 22}" rx="150" ry="16" fill="#ff8a2a" opacity="0.28" filter="url(#glow)"/>')

body.append('<rect width="512" height="512" fill="url(#vignette)"/>')

svg = (
    '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">\n'
    '<title>Codyken</title>\n'
    '<defs>' + '\n'.join(defs) + '</defs>\n'
    '<g clip-path="url(#frame)">\n' + '\n'.join(body) + '\n</g>\n'
    '<rect x="0.75" y="0.75" width="510.5" height="510.5" rx="111.25" fill="none" stroke="#ffffff" stroke-opacity="0.09" stroke-width="1.5"/>\n'
    '</svg>\n'
)
for out in sys.argv[1:] or ['src/renderer/src/assets/logo.svg', 'codyken-obsidian/Adjuntos/logo.svg']:
    open(out, 'w').write(svg)
print(len(svg), 'bytes', len(gradients), 'gradientes')
