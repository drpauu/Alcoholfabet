# 02 — Regles del joc

## Objectiu

Ser la primera persona a arribar a la META.

## Preparació

1. Escollir `En persona` o `En línia`.
2. Escollir la durada aproximada.
3. Escollir qui comença: en Pau, la Tecla o a l'atzar.
4. Generar i persistir el recorregut.
5. Posar les dues peces a la SORTIDA.

## Torn normal

1. Es destaca la casella següent de la persona activa.
2. El tipus de casella determina la pila de preguntes.
3. Es mostra una pregunta.
4. La persona respon oralment.
5. L'altra persona valida.
6. Si és correcte, la peça avança fins a la casella.
7. Si és incorrecte o no ho sap, no avança, perd el torn i beu.
8. Després del resultat, es prem `Següent torn`.

## Categories

### Personal

- Torn d'en Pau → pila `PAU`.
- Torn de la Tecla → pila `TECLA`.

### Creuada

- Torn de la Tecla → pila `TECLA_PAU`: la Tecla respon sobre els àmbits d'en Pau.
- Torn d'en Pau → pila `PAU_TECLA`: en Pau respon sobre els àmbits de la Tecla.

Les creuades són introductòries i assequibles.

### T&P

- Els dos poden reclamar la pregunta.
- La primera reclamació confirmada pel servidor és la vàlida.
- La persona guanyadora respon oralment.
- L'altra persona valida.
- Si encerta, avança qui ha respost.
- Si falla, no avança ningú.
- No hi ha segon intent amb la mateixa pregunta.
- Després es continua amb l'alternança normal del torn original.

## Casella +1

`+1` és un modificador d'una casella Personal, Creuada o T&P.

Si s'encerta:

1. La peça arriba a la casella.
2. La casella s'il·lumina.
3. La peça avança una casella addicional sense pregunta.
4. Si la nova casella també té `+1`, no s'encadena.
5. Si el segon moviment arriba a META, la persona guanya.

Si es falla o no se sap la resposta:

- No s'avança.
- Es perd el torn.
- Es beu doble.

## Finalització

- Guanya la primera persona que arriba a META.
- No hi ha empat.
- La finalització i la inserció del resultat han de ser una sola operació transaccional.
- Una partida només pot generar un `match_result`.

## Durada

La pregunta és exactament:

> Quant de temps voleu que duri la partida?

Opcions inicials:

- 20 minuts → 17 caselles superables.
- 30 minuts → 25 caselles.
- 45 minuts → 38 caselles.
- 60 minuts → 50 caselles.
- Personalitzada → de 10 a 60 minuts enters, amb la mateixa fórmula.

Cada torn compartit s'estima en 30 segons. Amb dos jugadors, un 75% d'encerts estimat i un 12% de caselles +1, la longitud és `round(minuts × 0,84)`, amb un límit de 50 caselles. La durada és una estimació de longitud: no hi ha compte enrere ni canvi automàtic de torn. Els errors, les reclamacions T&P i el ritme real poden escurçar o allargar la partida.

Aquest càlcul només s'aplica a partides noves. Les partides ja creades conserven la durada i el recorregut originals. Vegeu [el model de durada](DURATION_MODEL.md) per a la fórmula i els límits del banc de preguntes.

## Generació del recorregut

Proporció orientativa:

- 40% Personal.
- 40% Creuada.
- 20% T&P.
- 10-15% de modificadors +1.

El patró de cinc caselles és Personal, Creuada, T&P, Personal, Creuada. Així cada pila de 26 preguntes té aproximadament el mateix consum amb l'alternança dels dos jugadors. Els modificadors +1 es reparteixen al llarg del recorregut.

Restriccions:

- No hi ha +1 a la primera casella.
- No hi ha +1 immediatament abans de META.
- No hi ha dos +1 seguits.
- No hi ha més de dues caselles seguides de la mateixa categoria.
- Hi ha almenys una T&P quan la longitud ho permet.
- La ruta es genera una vegada i es desa.
