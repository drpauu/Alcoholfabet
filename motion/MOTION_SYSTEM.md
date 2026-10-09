# Sistema de motion i efectes

## Objectiu

Cada animació ha de reforçar una acció del joc. No hi ha motion ornamental permanent. El ritme ha de ser satisfactori, curt i fàcil de seguir encara que els jugadors estiguin parlant o hagin begut.

## Principis

1. Una acció principal per vegada.
2. El servidor confirma abans d'animar resultats online.
3. El moviment visual mai no modifica l'estat de negoci.
4. `state_version` evita repetir una seqüència.
5. Sons i vibració es disparen des del mateix orchestrator.
6. Les animacions no canvien la posició final del layout.
7. Amb `prefers-reduced-motion`, la informació es conserva.

## Arquitectura recomanada

- `GameEventOrchestrator`: rep l'esdeveniment confirmat i construeix la seqüència.
- `MotionLayer`: targeta, partícules, overlays i càmera.
- `BoardMotionController`: trajectòria i aterratge de fitxes.
- `AudioManager`: precàrrega, desbloqueig, volum i deduplicació.
- `Haptics`: opcional.
- `playedEventVersions`: conjunt de versions ja animades.

## Easing

- Entrada natural: `cubic-bezier(.22, 1, .36, 1)`.
- Sortida curta: `cubic-bezier(.4, 0, 1, 1)`.
- Rebot suau: `cubic-bezier(.2, .9, .3, 1.15)`.
- Moviment de peça: corba ease-in-out o spring molt amortit.

## Durades base

- Microfeedback: 135-270 ms.
- Targeta: 330-450 ms.
- Feedback de resposta: 450-630 ms.
- Pas de fitxa: 570-690 ms per casella.
- +1 complet: 2.550 ms amb feedback.
- Victòria: 2.700-3.900 ms.
- Reconnexió: 675-1.050 ms.

## Regla Realtime

No animis una acció optimista que modifiqui posició o guanyador.

Seqüència online:

1. Usuari prem.
2. Botó entra en estat pending.
3. RPC confirma.
4. Arriba nova vista i `state_version`.
5. Orchestrator compara versions.
6. Executa una sola seqüència.
7. Marca versió com reproduïda.

## Targeta de pregunta

Entrada:

- Comença 24 px per sota i 8 px a la dreta.
- Rotació Z de 1.2 graus.
- Opacitat 0.
- Ombra baixa.
- Acaba a posició 0, rotació 0, opacitat 1 i ombra de targeta.
- So `card_slide` al 15% de la seqüència.

Revelació:

- Primera meitat: `rotateY(0deg)` a `rotateY(90deg)`.
- Canvia el contingut exactament al punt mig.
- Segona meitat: `rotateY(-90deg)` a `rotateY(0deg)`.
- So `card_flip` al punt mig.
- Mantén alçada reservada per evitar layout shift.

## Correcte

- Bloqueja botons immediatament.
- Targeta puja 4 px.
- Halo verd fins a 18 px, baixa a 0.
- Check SVG es dibuixa amb stroke-dashoffset.
- 3 partícules, màxim 24 px de recorregut.
- So `correct` al 60 ms.
- Després inicia el moviment de peça.

## Incorrecte

- Bloqueja botons.
- Targeta: -4, +4, -2, +2, 0 px.
- Halo vermell curt.
- Creu SVG es dibuixa.
- El brindis entra al centre del viewport: got vectorial gran, líquid, reflexos i nom.
- So `incorrect` al 75 ms.
- `drink` o `double_drink` a 930 ms, coordinat amb el brindis.
- No moguis tota la pantalla.

## Moviment de fitxa

- Utilitza path SVG o coordenades centrals de caselles.
- La fitxa s'eleva 5-8 px.
- Ombra s'amplia i perd opacitat durant el vol.
- Segueix una corba, no una línia mecànica quan el path gira.
- Cada aterratge reprodueix `pawn_step`.
- En un moviment de dues caselles, hi ha dos aterratges diferenciats.

## +1

1. Moviment normal a la casella.
2. Pausa 180-270 ms.
3. Casella fa pols d'escala 1 → 1.06 → 1.
4. Apareix badge `+1!`.
5. So `plus_one`.
6. Segon moviment.
7. El segon destí no activa un nou +1.

## T&P

Obert:

- Dos botons respiren molt subtilment una sola vegada.

Pulsació:

- Botó seleccionat escala 0.98.
- Spinner discret o text `Comprovant…`.
- Haptic 20 ms.

Confirmació guanyada:

- Anell de color del jugador.
- Text `Respon en Pau` o `Respon la Tecla`.
- L'altre botó perd saturació.

Confirmació perduda:

- Cap error agressiu.
- Text `Ha respost primer l'altra persona`.

## Desconnexió

- No tallis l'escena completament.
- Difumina l'escena 3-5 px.
- Overlay fosc semitransparent.
- Icona connexió.
- Text i spinner.
- Accions bloquejades.

Reconnexió:

- Check verd.
- Text `T'has tornat a connectar`.
- Overlay desapareix en 300 ms.
- Recupera la vista abans de permetre accions.
- No repeteixis l'últim efecte.

## Victòria

1. Fitxa arriba a META.
2. So d'ateratge.
3. Càmera/escena escala 1 → 0.97 i es recentra.
4. Corona cau 12 px i rebota una vegada.
5. Confeti de 12-18 peces, no centenars.
6. Melodia `victory`.
7. Entra targeta de guanyador.
8. Després apareix el marcador actualitzat.
9. Botons finals després de 2.85-3.3 s.

## Reduced motion

Substitueix:

- Trajectòries per fades curtes.
- Gir 3D per canvi d'opacitat.
- Confeti per corona estàtica.
- Shake per canvi de color i icona.

Mantén sons només si l'usuari els té activats.

## Brindis d’Alcoholfabet

`INCORRECT_AND_DRINK` dura 3.600 ms segons `event-choreography.json`. Una capa temporal, muntada amb un portal fora de la càmera del tauler, centra la composició al viewport. El got és un SVG amb capes de vidre, beguda, glaçons, condensació i reflexos. L’entrada, l’elevació, la inclinació, l’oscil·lació del líquid, el reflex que travessa el vidre, deu partícules i l’ona del brindis comparteixen la mateixa línia de temps. En beure doble dos gots brindaran simètricament. El so `DRINK`/`DOUBLE_DRINK` i la vibració es disparen a 930 ms; la sortida comença a 3.150 ms.

El nom és el de `respondingPlayer` de l’esdeveniment confirmat, també en T&P quan el torn següent pertany a l’altre jugador. Els controls esperen que acabi el brindis; el tauler no canvia de mida o posició. L’avís accessible a la targeta conserva el nom i la penalització després de la sortida. El portal és només visual i no duplica l’anunci del lector de pantalla.

Una vista recuperada o una versió duplicada no repeteix la seqüència. Abandonar, canviar de partida o desconnectar cancel·la el brindis i neteja animacions i partícules. Amb moviment reduït, el JSON reserva 900 ms per llegir el got estàtic i el nom: només fades curts, cap inclinació, cap oscil·lació ni partícules, i so segons la preferència persistent de l’usuari.

## Ritme més pausat aprovat

Les animacions principals duren un 50% més que la revisió anterior. El JSON conserva la sincronització d’entrades, pauses, sortides i cues d’àudio: targeta 360 ms, gir 420 ms amb canvi de cara a 210 ms, encert 540 ms i pas de peça 630 ms, +1 complet 2.550 ms, brindis 3.600 ms i victòria 3.450 ms. El compositor calcula els totals de moviment i T&P des dels passos del JSON. El moviment reduït conserva les seves durades breus, amb el brindis estàtic de 900 ms.
