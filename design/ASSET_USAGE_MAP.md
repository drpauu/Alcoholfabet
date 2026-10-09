# Mapa d'ús dels assets

## Fons principals

Utilitza preferentment:

- Desktop/iPad: `assets/production/backgrounds/sitges_scene_desktop_ai.webp`
- Mòbil: `assets/production/backgrounds/sitges_scene_mobile_ai.webp`

Alternativa mòbil:

- `sitges_scene_mobile_ai_alternate.webp`

Els SVG i PNG simples del mateix directori són fallback lleuger, no la primera opció visual.

## Avatars

- `pau_avatar.webp`
- `tecla_avatar.webp`
- `pau_character.webp`
- `tecla_character.webp`
- `pau_tecla_duo.webp`

No utilitzis les fotos originals com a UI.

## Tauler

- Base interactiva: `assets/production/board-v2/board_scene.svg`
- Coordenades: `board_coordinates.json`
- Referència d'acabat: `assets/reference/style/06_board_art_reference_ai.webp`

El tauler ha de continuar sent interactiu. No utilitzis la imatge de referència com un mapa de clics opac.

## Peces i efectes

- Peces: `assets/production/pawns/`
- Icones: `assets/production/icons/`
- Efectes: `assets/production/effects/`
- Sons: `assets/production/sounds/`

## Composició

1. Fons AI en `<picture>`.
2. Vignette i llum via CSS.
3. Tauler SVG.
4. Peces posicionades amb coordenades del tauler.
5. Decoració perifèrica només si no està integrada al fons.
6. Targeta HTML.
7. Efectes temporals en una capa pointer-events:none.
