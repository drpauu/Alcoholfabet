# Auditoria de motion i àudio — 9 d’octubre de 2026

S’han implementat i executat les seqüències de `motion/event-choreography.json` amb un únic runner Web Animations API. El servidor conserva l’estat de negoci; el runner només modifica temporalment transformacions, opacitat, filtres i efectes visuals.

## Implementació verificada

- La targeta entra amb desplaçament i rotació. El gir dura 280 ms i canvia el contingut al punt mig de 140 ms; la primera animació allibera el seu `fill` abans de passar de +90° a −90°.
- L’encert aixeca la targeta, dibuixa el check, emet tres partícules i inicia el recorregut de la peça després del feedback. La peça segueix el path SVG real, s’eleva i modifica l’ombra durant el vol.
- El `+1` té dues arribades diferenciades, pausa de 160 ms, pols de casella, badge i so propi. El segon moviment no encadena un altre modificador.
- L’error no mou la peça: combina shake curt, halo, creu dibuixada i got. El so selecciona beure o beure doble segons el resultat confirmat.
- T&P confirma el reclamant del servidor, dibuixa l’anell amb el seu color i presenta l’estat pending sense avançar cap peça localment.
- La victòria espera el moviment a META. Després coordina càmera, corona, setze peces de confeti, targeta de guanyador, marcador i accions finals. Els controls es bloquegen durant la seqüència.
- La reconnexió hidrata la versió actual, descarta seqüències pendents i evita reproduir resultats antics. La vista segura es recupera abans de desbloquejar accions.
- `prefers-reduced-motion` elimina trajectòries, shake, gir 3D i partícules; conserva icones, corona, missatges, controls i sons autoritzats.
- Els deu WAV del mapa d’àudio es carreguen després d’una interacció. AudioContext es crea en aquesta interacció; el control de so es desa i atura immediatament els sons quan es desactiva. Les cues es dedupliquen per acció i arribada.

L’auditoria al navegador va detectar i corregir una regressió real: el servidor retorna `MOVING` en els encerts no finals, i l’adaptador inicial només reconeixia `RESULT`. Ara reconeix totes les fases de resultat i disposa d’un test específic que evita el teletransport.

## Proves executades

`npm run typecheck`, build de producció i 15 tests unitaris de regles, coreografia, deduplicació, hidratació, recuperació d’errors i àudio han passat.

El test normal de gir, error, recorregut i `+1` va passar en 39,9 s. Va registrar més de vuit punts diferents en cada moviment verificat, contingut revelat després del punt mig i una partida abandonada sense punt. El test normal de META també va passar: després de la confirmació observada, la corona es va veure a 1.237 ms, la targeta a 1.719 ms, el marcador a 2.094 ms i les accions a 2.512 ms, en aquest ordre.

Evidència:

- `MOTION_BROWSER_QA.json`: mostres reals de transformacions i fases.
- `MOTION_VICTORY_QA.json`: visibilitat mesurada amb opacitat i gates, no només presència al DOM.
- `screenshots/motion/`: encert, error, `+1` i victòria.
- `videos/motion/card-and-plus-one.webm` i `videos/motion/victory.webm`: gravacions de les sessions reals.
- `QA_GAMES_MOTION.json`: identificadors de fixtures per a la neteja final; no conté tokens ni contrasenyes.

## Rendiment i límit de la mesura

La mesura curta sense encoder sobre el joc real a 1440×900 va registrar 65 frames: mediana de 60,24 FPS, mitjana de 44,66 FPS, p95 del gap de 39,8 ms i gap màxim de 336,5 ms. Inclou la confirmació RPC i el primer render del nou estat en Chromium headless. Amb gravació de vídeo, les medianes per seqüència van anar de 23,64 a 59,88 FPS, amb p95 màxim de 112,2 ms.

Aquestes xifres descriuen el host de QA. No acrediten 60 FPS constants en altres dispositius. S’ha verificat continuïtat de trajectòria i absència de teletransport, però cal comprovar el rendiment percebut també en maquinari mòbil i iPad real.

`node scripts/summarize-motion-evidence.mjs` regenera `motion-performance-report.json` a partir de l’última evidència. `motion-performance-no-video.json` conserva la mesura sense encoder.
