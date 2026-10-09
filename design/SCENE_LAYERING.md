# Capes de l'escena

```text
GameViewport
├── BackgroundPicture
├── AtmosphericOverlay
├── TabletopDecorLayer
├── BoardPerspectiveShell
│   ├── BoardSVG
│   ├── TargetCellHighlight
│   ├── PauPawn
│   ├── TeclaPawn
│   └── BoardEffects
├── GameHUD
├── QuestionCardLayer
├── ResultFXLayer
├── ConnectionOverlay
└── VictoryOverlay
```

## Z-index recomanat

- 0: fons.
- 5: decoració.
- 10: tauler.
- 20: fitxes.
- 30: HUD.
- 40: targeta.
- 50: feedback i partícules.
- 80: connexió.
- 90: victòria.

## Perspectiva

Aplicar perspectiva al `BoardPerspectiveShell`, no al conjunt de la UI.

Desktop/iPad:

```css
transform: perspective(1200px) rotateX(9deg) rotateZ(-0.5deg);
transform-origin: 50% 68%;
```

Mòbil:

```css
transform: perspective(1000px) rotateX(2deg);
```

Els textos del HUD i la targeta no s'han de deformar.
