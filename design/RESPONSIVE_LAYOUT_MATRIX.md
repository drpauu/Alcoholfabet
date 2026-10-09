# Matriu responsive

| Element | Mòbil vertical | iPad horitzontal | Ordinador |
|---|---|---|---|
| Orientació | obligatòria vertical | obligatòria horitzontal | horitzontal |
| Tauler | superior, perspectiva plana | esquerra 62%, perspectiva | centre/esquerra 65-70% |
| Targeta | inferior, amplada total | dreta 38% | lateral/superposada |
| HUD | compacte | complet | complet |
| Decoració | reduïda | rica | rica |
| Text pregunta | 22-26 px | 24-30 px | 26-34 px |
| Botons | fixos a baix | dins targeta | dins targeta |
| Scroll en torn | prohibit | prohibit | prohibit |
| Hover necessari | mai | mai | mai |
| Target mínim | 48 px | 48 px | 44-48 px |
| Perspectiva board | 0-4 deg | 8-12 deg | 8-14 deg |

## Gates d'orientació

- Mòbil horitzontal amb poca alçada: `Gira el dispositiu`.
- iPad vertical: `Gira l'iPad`.
- No dependre de `screen.orientation.lock`.

## Safe areas

Aplicar:

```css
padding-top: max(12px, env(safe-area-inset-top));
padding-bottom: max(12px, env(safe-area-inset-bottom));
min-height: 100dvh;
```
