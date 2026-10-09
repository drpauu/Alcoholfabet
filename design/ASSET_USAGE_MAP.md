# Mapa d'ús dels assets

## Fons principals

Utilitza preferentment:

- Desktop/iPad: `assets/production/backgrounds/sitges_scene_desktop_ai.webp`
- Mòbil: `assets/production/backgrounds/sitges_scene_mobile_ai.webp`

Alternativa mòbil:

- `sitges_scene_mobile_ai_alternate.webp`

Els SVG i PNG simples del mateix directori són fallback lleuger, no la primera opció visual.

## Avatars

- `assets/production/avatars/pau_character_v2.webp`
- `assets/production/avatars/tecla_character_v2.webp`

Són els dos mestres transparents de la UI actual, refinats a petició de l’usuari. `characterAsset()` els selecciona a l’inici i `PlayerPortrait` retalla exactament la mateixa imatge dins del marc en HUD, sala, selectors i victòria. No generis un retrat independent ni incorporis un cercle o una vora blanca a l’asset. Els PNG corresponents són els mestres de producció i les còpies de `public/` han de ser idèntiques.

Els fitxers anteriors `*_avatar`, `*_character` sense `v2` i `pau_tecla_duo` es conserven com a historial, però no són les fonts de la UI actual. Vegeu `docs/AVATAR_REFINEMENT.md`.

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

## Got del brindis central

`src/components/DrinkCelebration.tsx` dibuixa el got en SVG per poder animar el vidre, la beguda i els reflexos per separat sense perdre nitidesa. L’avís persistent de la targeta conserva `assets/production/effects/drink-filled.svg`. Tots dos utilitzen la paleta d’ambre, crema i pigments del joc; els temps es defineixen al JSON de coreografia.
