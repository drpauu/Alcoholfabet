# 06 — Animacions i sons

Els assets de so inicials són a `assets/production/sounds/`.

## Principis

- Curt.
- Funcional.
- Suau.
- No bloquejar controls.
- No competir amb la conversa.
- Evitar reproduccions dobles per esdeveniments repetits.

## Animacions

### Inici de torn

- Casella següent amb halo suau.
- Dos cops de fusta.
- Targeta entra 18-28 px amb `opacity` i `transform`.
- 180-240 ms.
- Easing: `cubic-bezier(0.22, 1, 0.36, 1)`.

### Mostrar resposta

- Gir o revelació de targeta.
- Canvi de contingut al punt central.
- 220-300 ms.
- So de targeta.

### Correcte

- Targeta puja 4 px.
- Halo verd.
- Check dibuixat.
- 2-4 partícules.
- Dues notes ascendents.
- 250-400 ms.

### Incorrecte

- Desplaçament curt: -4, +4, -2, +2, 0.
- Halo vermell.
- Creu.
- Got discret.
- Cop greu suau.
- 250-400 ms.

### Moviment de peça

- Seguir punts o path del tauler SVG.
- Lleu elevació durant el moviment.
- 350-450 ms per casella.
- Toc de fusta en aterrar.
- Només després que el servidor confirmi el nou estat.

### +1

1. Primer moviment.
2. Pols de la casella.
3. Text `+1!`.
4. Nota brillant.
5. Pausa aproximada de 180 ms.
6. Segon moviment.

Durada total: 700-1.000 ms.

### T&P

- El tap mostra estat de petició.
- No declarar guanyador local.
- Esperar confirmació del servidor.
- Destacar el claimant acceptat.

### Victòria

- Peça arriba a META.
- Zoom out aproximat del 3%.
- Corona.
- Confeti discret.
- Melodia de 2-3 segons.
- Controls finals després de l'efecte.

## Sons

- `turn_start.wav`: dos cops suaus de fusta.
- `card_slide.wav`: targeta lliscant.
- `card_flip.wav`: gir de targeta.
- `correct.wav`: dues notes ascendents.
- `incorrect.wav`: cop greu suau.
- `pawn_step.wav`: toc de peça.
- `plus_one.wav`: nota brillant.
- `drink.wav`: got a la taula.
- `double_drink.wav`: dos tocs.
- `victory.wav`: melodia curta.

## Política d'àudio

- No reproduir abans de la primera interacció.
- Desbloquejar `AudioContext` després d'un tap.
- Control de so persistent localment.
- Volum moderat.
- Cap música contínua.

## Hàptica

Opcional:

- T&P: 20 ms.
- Correcte: 30 ms.
- Incorrecte: 20, 40, 20 ms.
- +1: 20, 30, 20 ms.

## Moviment reduït

Amb `prefers-reduced-motion`:

- substituir recorreguts llargs per fades;
- mantenir feedback i informació;
- evitar sacsejades;
- no eliminar estats.
