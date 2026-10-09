# Sistema de pantalles

## Pantalles de producte

1. Entrada pública directa.
2. Inici.
3. Normes.
4. Selecció de mode.
5. Selecció de durada.
6. Selecció de qui comença.
7. Crear partida online.
8. Unir-se a partida online.
9. Sala d'espera.
10. Tauler abans del torn.
11. Pregunta presencial.
12. Resposta revelada presencial.
13. Pregunta online — respondent.
14. Pregunta online — jutge.
15. T&P obert.
16. T&P reclamat.
17. Encert.
18. Error.
19. +1.
20. Beu doble.
21. Desconnexió.
22. Reconnexió.
23. Partida abandonada.
24. Victòria.
25. Reprendre partida.
26. Gira el dispositiu.

## Esquelet compartit

### HUD superior

- Nom i indicador blau d'en Pau.
- Progrés d'en Pau.
- Torn actual.
- Progrés de la Tecla.
- Nom i indicador rosa de la Tecla.
- Menú discret.

No mostra el marcador històric durant la partida.

### Tauler

- Caselles del recorregut.
- Sortida i Meta.
- Peça blava.
- Peça rosa.
- Casella objectiu destacada.
- Context de Sitges.

### Targeta

Ordre visual:

1. Torn.
2. Categoria.
3. Pregunta.
4. Resposta, si està autoritzada.
5. Acció principal.
6. Accions de validació, si corresponen.

## Mides orientatives

### Mòbil 390x844

- HUD: 64-72 px.
- Tauler: 260-330 px segons fase.
- Targeta: resta de pantalla.
- Pregunta: 22-26 px.
- Botó principal: 52-60 px.
- Marges laterals: 16 px.

### iPad 1024x768

- HUD: 72-80 px.
- Columna tauler: 62%.
- Columna targeta: 38%.
- Targeta max: 420 px.
- Pregunta: 24-30 px.

### Desktop 1440x900

- Escena max: 1480 px.
- Tauler: 65-70%.
- Targeta: 360-480 px.
- Pregunta: 26-34 px.

## Comportament per fase

### TURN_INTRO

- Tauler gran.
- Casella objectiu fa pols suau.
- Targeta encara no ha entrat.
- Botó `Començar el torn`.

### QUESTION

- Targeta entra.
- Tauler redueix presència en mòbil.
- Respondent no veu resposta.

### ANSWER_REVEALED / JUDGING

- Targeta gira.
- Resposta en banda verd pàl·lid.
- Botons `Incorrecte` i `Correcte` a la mateixa posició sempre.

### RESULT / MOVING

- No permetre pulsacions duplicades.
- Targeta conserva resultat.
- La peça es mou al tauler.

### BETWEEN_TURNS

- Botó `Següent torn`.
- Temps lliure per parlar i beure.

### FINISHED

- Tauler visible.
- Peça a META.
- Corona i confeti.
- Marcador històric actualitzat una sola vegada.

## Revisió Alcoholfabet

Entrada sense codi privat; sense avatars a inici, seleccions, partida ni victòria. La pregunta utilitza 23–33 px i pes 800, el tauler té amplada completa en mòbil i la capçalera es compacta. El got i el nom del respondent dominen el resultat incorrecte. Un +1 incorrecte mostra dos gots i «Beu doble». Les partides en línia continuen requerint la invitació de la sala per unir els dos membres.
