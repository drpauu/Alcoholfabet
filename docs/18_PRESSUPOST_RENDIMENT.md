# 18 — Pressupost de rendiment

## Objectius

- First meaningful paint en connexió normal: < 2,5 s.
- Acció local visual: < 100 ms.
- Confirmació de servidor percebuda: idealment < 700 ms.
- Animacions a 60 fps en mòbils raonables.
- Reconnexió visible immediata.

## Assets

- Imatges grans en WebP o AVIF.
- Tauler i icones en SVG.
- Precàrrega del fons principal i avatars.
- Sons carregats després de la primera interacció.
- Lazy load de normes i pantalles no immediates.

## JavaScript

- Evitar paquets pesants.
- Code split de gestió administrativa si s'implementa.
- No mantenir subscripcions duplicades.
- Cancel·lar efectes en desmuntar.
- Reutilitzar components i assets.

## Animacions

- Preferir `transform` i `opacity`.
- No animar `top`, `left`, `width` o `height` contínuament.
- No repintar tot el tauler per moure una peça.

## Xarxa

- Un refetch de vista per canvi confirmat.
- Evitar polling si Realtime funciona.
- Debounce només en controls no crítics.
- No carregar el banc complet de respostes al client.
