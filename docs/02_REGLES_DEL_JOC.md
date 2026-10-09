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

Si es falla:

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

- 20 minuts → 4 caselles superables.
- 30 minuts → 5 caselles.
- 45 minuts → 7 caselles.
- 60 minuts → 9 caselles.
- Personalitzada → aproximadament una casella per cada 6 o 7 minuts, mínim 3 i màxim 15.

La durada no és un compte enrere. És una estimació de longitud.

## Generació del recorregut

Proporció orientativa:

- 35% Personal.
- 35% Creuada.
- 30% T&P.
- 10-15% de modificadors +1.

Restriccions:

- No hi ha +1 a la primera casella.
- No hi ha +1 immediatament abans de META.
- No hi ha dos +1 seguits.
- No hi ha més de dues caselles seguides de la mateixa categoria.
- Hi ha almenys una T&P quan la longitud ho permet.
- La ruta es genera una vegada i es desa.
