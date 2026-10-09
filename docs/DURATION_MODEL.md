# Model de durada de les partides noves

Una pregunta compartida ocupa **30 segons estimats**, independentment de si la partida és presencial o en línia. Aquest valor determina la longitud inicial; no introdueix un temporitzador, no valida una resposta ni passa el torn.

El model considera dos jugadors, un 75% d'encerts i un 12% de caselles +1. Un encert mou una casella i un +1 afegeix un únic moviment sense pregunta. Amb un repartiment aproximat dels torns entre les dues persones:

```
caselles = round(minuts × 60 × 0,75 × 1,12 / (2 × 30))
         = round(minuts × 0,84)
```

| Durada seleccionada | Caselles fins a META | Durada estimada després de l'arrodoniment |
| --- | ---: | ---: |
| 10 minuts | 8 | 9,52 minuts |
| 20 minuts | 17 | 20,24 minuts |
| 30 minuts | 25 | 29,76 minuts |
| 45 minuts | 38 | 45,24 minuts |
| 60 minuts | 50 | 59,52 minuts |

El client i `calculate_finish_position` admeten minuts enters de 10 a 60. `create_game` rebutja altres durades amb `INVALID_GAME_OPTIONS`. Una petició antiga amb la seva clau d'idempotència original pot recuperar la partida existent encara que superés els 60 minuts. El límit històric de `games.target_minutes` continua sent 180 per conservar aquelles files; només les creacions noves tenen el rang reduït.

Les partides existents conserven `finish_position`, les caselles, les posicions, les preguntes utilitzades i els resultats. La migració 0011 només canvia les funcions de creació i la restricció de longitud a 3–50. Comprova transaccionalment que totes les files de partides, caselles i resultats existents continuen idèntiques.

## Banc finit de preguntes

Hi ha 130 preguntes aprovades i revisades, 26 per pila. El recorregut nou repeteix Personal, Creuada, T&P, Personal, Creuada: 40%, 40% i 20%. Amb alternança equilibrada, Personal i Creuada es divideixen entre les dues persones i cadascuna de les cinc piles consumeix aproximadament un 20% de les preguntes. Una partida de 60 minuts implica aproximadament 120 torns de 30 segons: 24 preguntes estimades per pila.

El nombre de +1 és `round(longitud × 0,12)`, limitat pels espais disponibles. Es reparteixen amb `floor(longitud × índex / (nombre + 1))`. No apareixen a la primera casella, a la penúltima o a META, ni de manera consecutiva. El recorregut de 50 caselles té +1 a 7, 14, 21, 28, 35 i 42.

Aquest repartiment redueix la pressió sobre T&P respecte a un 30% de caselles compartides. **No garanteix una durada exacta ni evita tot esgotament**: molts errors, torns concentrats en una casella o reclamacions T&P desiguals poden consumir una pila abans d'arribar a META. `QUESTION_POOL_EMPTY` conserva l'estat anterior; no reutilitza preguntes, no avança cap peça i no modifica el marcador. Només s'utilitzen preguntes `APPROVED`, actives i revisades.

## Validació executada

Les proves unitàries cobreixen tots els minuts de 10 a 60, els presets, els límits, les proporcions, els +1 i les longituds fins a 50. La prova PostgreSQL real de `tests/backend/duration.sql` utilitza els RPC autoritatius i completa una partida de 50 caselles en 87 preguntes correctes, amb alternança, T&P, +1 i arribada a META. Verifica que no hi ha repeticions, que la mateixa acció final només genera un resultat i que l'esgotament d'una pila és atòmic.

Tots els UUID de la prova SQL consten a `acceptance/gameplay-refinement/DURATION_QA_MANIFEST.json`. Una subtransacció desfà els sis jocs, l'usuari de prova i el resultat temporal abans de retornar l'informe. No crea sessions Auth ni deixa punts al marcador. L'informe compara totes les files existents de partides, caselles, usuaris i resultats abans i després, dins de la mateixa transacció.
