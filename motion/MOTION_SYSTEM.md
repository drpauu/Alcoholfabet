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

- Microfeedback: 90-180 ms.
- Targeta: 220-300 ms.
- Feedback de resposta: 300-420 ms.
- Pas de fitxa: 380-460 ms per casella.
- +1 complet: 900-1.250 ms.
- Victòria: 1.800-2.600 ms.
- Reconnexió: 450-700 ms.

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
- So `correct` al 40 ms.
- Després inicia el moviment de peça.

## Incorrecte

- Bloqueja botons.
- Targeta: -4, +4, -2, +2, 0 px.
- Halo vermell curt.
- Creu SVG es dibuixa.
- Got entra 14 px des de baix i s'atura.
- So `incorrect` al 50 ms.
- `drink` o `double_drink` a 220 ms.
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
2. Pausa 120-180 ms.
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
9. Botons finals després de 1.8-2.2 s.

## Reduced motion

Substitueix:

- Trajectòries per fades curtes.
- Gir 3D per canvi d'opacitat.
- Confeti per corona estàtica.
- Shake per canvi de color i icona.

Mantén sons només si l'usuari els té activats.

## Brindis d’Alcoholfabet

`INCORRECT_AND_DRINK` dura 1.080 ms segons `event-choreography.json`: l’avís entra, el got puja i s’inclina, sis bombolles d’ambre surten i el paper fa un pols curt. En beure doble entra un segon got 60 ms després. El so `DRINK`/`DOUBLE_DRINK` continua a 220 ms. No hi ha animació contínua ni canvis de negoci; una vista recuperada o una versió duplicada no repeteix el brindis. Amb moviment reduït es retiren bombolles i trajectòries, es conserva el nom i es respecta el control de so.
