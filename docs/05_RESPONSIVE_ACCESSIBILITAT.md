# 05 — Responsive i accessibilitat

## Principi

No s'ha de reduir la versió d'ordinador. Cada família de dispositius té una composició pròpia.

## Mòbil

Amplada inferior a 768 px:

- Orientació de joc vertical.
- `100dvh`.
- Respectar `safe-area-inset-*`.
- Tauler compacte a la part superior, aproximadament 35-45%.
- Targeta a la part inferior.
- Controls principals fixos a la zona inferior.
- Sense scroll en un torn normal.
- Text de pregunta aproximadament 22-26 px segons espai.
- En horitzontal, pantalla de rotació.

Text de rotació:

- `Gira el dispositiu`.
- `Aquest joc es gaudeix millor en vertical.`

## iPad i tauleta

Des de 768 px:

- Joc horitzontal.
- Si està vertical, pantalla de rotació.
- Tauler 60-65%.
- Targeta 35-40%.
- Perspectiva subtil.
- Textos i controls tàctils grans.

Text:

- `Gira l'iPad`.
- `Col·loca'l en horitzontal per veure tot el tauler.`

## Ordinador

- Horitzontal.
- Tauler sempre visible.
- Targeta lateral o superposada parcialment.
- Amplada màxima perquè els elements no quedin massa separats.
- Teclat i ratolí.
- Focus visible.

## Breakpoints funcionals

No basar-se només en amplada; considerar altura i orientació.

- Mobile portrait: `<768px` i portrait.
- Tablet landscape: `>=768px` i landscape.
- Desktop: `>=1180px` o dispositiu amb punter fi i altura suficient.

## Controls

- Mínim 48×48 px CSS.
- `Correcte` i `Incorrecte` separats.
- Cap acció important només amb icona.
- No canviar la posició d'un botó mentre es prem.
- Desactivar immediatament després d'enviar una acció.
- Mostrar estat d'espera breu.

## Accessibilitat

- Contrast suficient.
- Etiquetes textuals.
- `aria-live` per torns, resultats i reconnexió.
- Focus restaurat en canviar de fase.
- `prefers-reduced-motion`.
- No desactivar zoom.
- No dependre només del color.
- Suport de teclat en escriptori.
- Safe areas i barres mòbils.

## Resolucions de prova

- 360×800.
- 390×844.
- 430×932.
- 768×1024: ha de demanar rotació.
- 1024×768.
- 1180×820.
- 1366×768.
- 1440×900.
