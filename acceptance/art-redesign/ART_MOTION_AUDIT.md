# Auditoria de motion del sistema d’art

Estat: verificació de QA completa. Captures PASS a les tres mides, vuit E2E PASS, dues repeticions normals específiques PASS i benchmark focal sense vídeo/captures PASS. `motion-performance-report.json` té evidenceComplete=true. La garantia de 60 FPS constants en dispositius físics continua PARTIAL: no s’ha mesurat aquell maquinari. Aquest document no modifica l’auditoria històrica de la primera implementació.

## Contracte executat

`motion/event-choreography.json` continua sent la font de veritat de l’ordre i les durades. Un únic orquestrador processa els esdeveniments confirmats de la vista segura del servidor. El client no decideix posicions, torns ni marcador. El runner restaura els estils i elimina animacions i partícules generades al final o en cancel·lar la seqüència.

| Seqüència | Ordre i temps del JSON |
|---|---|
| Pregunta | Entrada física de 240 ms; so als 35 ms |
| Resposta | Rotació Y durant 140 ms, canvi de contingut al punt mig, segona meitat de 140 ms |
| Encert | Feedback de 360 ms; després, cada tram de ruta dura 420 ms |
| +1 | Primer tram 420 ms; pausa 160 ms; pols 340 ms; segon tram des dels 920 ms. Amb el feedback previ, total 1.700 ms |
| Error | Desplaçament lateral 330 ms, creu 240 ms, got entra des dels 180 ms; total 560 ms |
| T&P | Feedback local de petició, confirmació del servidor i traç de reclamant de 300 ms |
| Desconnexió | Desenfocament del paisatge i entrada del vel durant 220 ms; controls bloquejats |
| Reconnexió | Check, sortida del vel des dels 280 ms i controls després de recuperar vista/canal; total 620 ms |
| Victòria | Aterratge; zoom als 360 ms; corona als 520 ms; paper als 600 ms; targeta als 920 ms; marcador als 1.420 ms; accions als 1.900 ms. Total 2.300 ms |

`gameScene` apunta al picture del paisatge; el panell de connexió queda fora del seu desenfocament. `gameCamera` apunta al contingut de la partida; els controls de capçalera i els diàlegs queden fora del zoom de victòria. El vel amb backdrop conserva el joc al fons sense desenfocar el text del panell.

El marcador tenia l’únic pas animate del JSON sense destí explícit. El runner li aplica ara una entrada física de paper amb y6→0, inclinació −0,7°→0, opacity0→1 i l’ombra compartida, durant els mateixos 420 ms. La resta de passos animate conserven el seu destí. La gravació E2E de victòria confirma una transformació residual de y0,379→0 i opacitat0,937→1; el mostreig de 80 ms no captura l’inici complet de l’entrada. Les mostres responsive anteriors mesuren la ruta de la peça i no demostren aquest canvi del marcador.

## Cos, ruta i materials

La coordenada de la peça continua al wrapper SVG exterior. El cos intern `data-pawn-body` s’inclina fins a 2,2° i comprimeix breument un 4% en aterrar; l’ombra és un ellipse independent. Les coordenades d’arribada coincideixen amb les caselles de la ruta SVG i el runner en segueix la corba. No hi ha animació contínua de la peça en repòs.

El recorder normal inicial podia reutilitzar un callback pendent quan començava una altra gravació. S’ha preservat com a intent històric i s’ha corregit la identitat de cada gravació i el timestamp nadiu de requestAnimationFrame. La repetició corregida va confirmar que el segell +1 era visible 133,3 ms abans de la primera arribada. La cerca aproximada dels dos extrems feia 482 lectures natives de la corba per tram; el runner ara utilitza data-board-fraction de les caselles per obtenir els extrems exactes. Manté les 21 mostres de ruta, els offsets de les peces, l’aterratge, les ombres i el JSON. La cerca anterior només és el fallback per a un DOM sense aquestes fraccions. Després del canvi, la prova normal verifica directament que el segell apareix després de l’arribada; les mostres mostren un marge de 283,3 ms. TypeScript, els 18 tests unitaris i el build passen.

La targeta gira el contingut i el paper real de `questionCardInner`, amb perspectiva i preservació 3D; el contingut es canvia al punt mig. La corona és un SVG original de llautó vell amb gravat botànic. El +1 és un segell SVG original de paper amb pigment ocre. El check verd, la creu terracota i el got provenen del llenguatge d’art del joc.

El confeti executat són retalls petits, irregulars, amb textura de paper i pigments Pau/Tecla/ocre/oliva/lavanda. L’encert emet tres partícules i la victòria setze retalls. Les fonts genèriques històriques `effects/confetti.svg` i `effects/sparkle.svg` no es carreguen al producte. Els noms contractuals correctHalo/errorHalo es mantenen; el feedback visual és una vora temporal apagada de la targeta, amb color verd/terracota i ombra càlida, sense llum neó.

El carregador és un rellotge ceràmic immòbil amb grans de pigment; els controls sense loading amaguen l’indicador i no mantenen una animació invisible. Les variants correctes/incorrectes comparteixen geometria i pes. La comprovació de components React amb Strict Mode, Esc, focus, loading sense canvi d’amplada i disabled llegible és a `../art/component-behavior-qa.json`.

## Mesura i límits

`node scripts/summarize-art-motion-evidence.mjs` produeix `motion-performance-report.json` a partir dels sis registres de captures responsive, les seqüències normals E2E, la mesura focal sense vídeo i els seus informes finals. `evidenceComplete` requereix captures PASS sense omissions, vuit E2E PASS sense fallades/flaky/skips, les dues repeticions normals i el benchmark focal PASS, absència d’errors, timestamps normals creixents, +1 després de l’arribada amb vídeo i sense, ordre de victòria i moviment real del marcador. Un informe FAIL no es considera complet. Cap fitxer històric de rendiment es sobreescriu.

Les mostres requestAnimationFrame llegeixen la transformació calculada del wrapper de ruta. La gravació comença abans de l’acció i inclou RPC, planificació i treball del navegador. Els registres responsive inclouen captures de pantalla i timestamps performance.now després de les lectures d’estil; els normals corregits utilitzen el timestamp del callback i inclouen codificació de vídeo. La mesura focal final utilitza timestamps nadius sense vídeo ni captures. La mediana d’FPS és 1.000 dividit per la mediana dels intervals, i p95 és l’interval del percentil 95. Aquestes dades descriuen el host Linux de QA, no un rendiment garantit en maquinari físic. Els sis registres responsive són anteriors al càlcul directe dels extrems; no se’ls atribueix una millora de rendiment posterior.

Els registres E2E també mostregen fase, transformació de la targeta i visibilitat de la resposta. Els registres responsive mostregen animacions actives i opacitat del +1. La inclinació interna, l’ombra i el pigment es verifiquen en codi i captures; aquests registres de coordenades no els mesuren directament. Els temps de victòria E2E comencen després de recuperar FINISHED, i per això no s’han de tractar com a temps exactes des de l’origen del JSON.

El mode reduced-motion conserva cues, canvi de cara i estats, limita els recorreguts a feedback breu i elimina partícules. La comprovació de fluxos amb aquest mode forma part de la suite final; els vídeos de motion utilitzen no-preference.

## Resultats finals

La suite [FINAL_E2E_REPORT.json](FINAL_E2E_REPORT.json) registra 8 PASS, 0 fallades, 0 flaky, 0 skips i 0 errors. Cobreix accés, presencial, online amb resposta segura/T&P concurrent/reload/reconnexió, victòria, abandonament sense punts i la regressió d’abandonar durant QUESTION. [MOTION_RECORDER_RECHECK_REPORT.json](MOTION_RECORDER_RECHECK_REPORT.json) i [MOTION_PATH_RECHECK_REPORT.json](MOTION_PATH_RECHECK_REPORT.json) registren cadascun 1 PASS; cap d’aquestes repeticions arriba a META. La suite de vuit tests és anterior al shortcut de ruta; la repetició PATH verifica el canvi posterior amb producció real.

La mesura focal final [MOTION_NO_VIDEO_REPORT.json](MOTION_NO_VIDEO_REPORT.json) registra 1 PASS, sense crear usuaris i sense arribar a META. [MOTION_NO_VIDEO_FRAMES.json](MOTION_NO_VIDEO_FRAMES.json) conserva els vuit registres amb timestamp nadiu, videoRecording=false i screenshotRecording=false. És la referència principal de rendiment del codi final; la sèrie amb vídeo es conserva per inspecció visual i ordre d’estats.

| Seqüència final sense vídeo a 1440×900 | Registres | Mediana FPS de mostreig | p95 del registre complet | Punts diferents durant ruta |
|---|---:|---:|---:|---:|
| Resposta | 4 | 59,88 | 100,0–100,1 ms | 0 |
| Error | 1 | 59,88 | 83,3 ms | 0 |
| Encert | 2 | 59,88 | 83,3–83,4 ms | 24 per registre |
| +1 | 1 | 59,88 | 16,8 ms | 49 |

Durant el moviment efectiu de les peces, els dos encerts registren p95 de 16,7–16,8 ms i el +1, 16,8 ms; tots tres tenen mediana de 59,88 FPS. En +1 la primera arribada és als 1.228,5 ms, la pausa observada dura almenys 483,4 ms i la segona arribada és als 2.128,5 ms. El segell apareix 233,4 ms després de la primera arribada, i l’assert corresponent passa. No hi ha timestamps duplicats ni errors. La mitjana del registre +1 complet és 48,56 FPS i el seu interval màxim és 216,6 ms: una mediana propera a 60 no significa 60 constants.

Els quatre girs sense vídeo registren angles positius abans del canvi i negatius després, amb primera resposta al DOM a −90°. Entre mostres on l’angle 3D canvia, la mediana és 59,88–60,24 FPS i el p95, 66,6–116,7 ms sobre 8–10 intervals per gir. Aquests intervals inclouen el canvi del punt mig i no resolen 140 ms exactes ni fluïdesa constant. El retard des de la fase confirmada fins a la primera resposta al DOM és 333,3–349,9 ms. Aquest límit es conserva a l’informe, sense convertir la mediana de la ruta en una garantia per a tot el joc.

La gravació normal actual [MOTION_BROWSER_QA.json](MOTION_BROWSER_QA.json) i [el vídeo](videos/motion/card-and-plus-one.webm) corresponen al recorder corregit i al shortcut. No tenen timestamps duplicats ni errors del navegador.

| Seqüència normal a 1440×900 amb vídeo | Registres | Mediana FPS de mostreig | p95 d’interval | Punts diferents durant ruta |
|---|---:|---:|---:|---:|
| Resposta | 4 | 20,00–20,04 | 116,7–183,4 ms | 0 |
| Error | 1 | 29,94 | 83,3 ms | 0 |
| Encert | 2 | 20,00–20,04 | 100,0–100,1 ms | 10 per registre |
| +1 | 1 | 20,00 | 83,4 ms | 20 |

Els dos encerts i el +1 mostren coordenades intermèdies sobre la corba, no només inici i destí. En +1 la primera arribada és als 1.411,2 ms de gravació, la peça resta a la casella intermèdia almenys 416,7 ms i l’arribada final és als 2.294,5 ms. El segell comença als 1.694,5 ms, després de la primera arribada. La seva visibilitat queda registrada fins als 2.211,1 ms. El p95 d’interval del registre +1 passa de 216,7 ms abans del shortcut a 83,4 ms en la repetició posterior; la mediana continua sent 20 FPS amb vídeo. Els intervals observats també depenen de la càrrega del host i no són un benchmark aïllat del càlcul de ruta.

Les quatre respostes registren rotació 3D amb angles positius abans del canvi i negatius després; la primera presència de la resposta al DOM coincideix amb −90°. El retard observat des de la fase ANSWER_REVEALED fins a aquesta presència és 316,7–366,7 ms. El mostreig amb vídeo no resol el punt de 140 ms amb exactitud; el callback de canvi continua fixat al punt mig del JSON. La resposta present al DOM en aquell angle no equival encara a text frontal llegible.

L’error manté la peça en la mateixa coordenada durant tota la gravació. La creu es registra visible als 574,7–1.058,0 ms, i el got als 824,6–1.058,0 ms. Les captures core incorrect dels tres formats també mostren got de 56×77 px i creu separats. Els fitxers incorrect-settled mostren un estat posterior i no s’utilitzen per afirmar visibilitat del got.

Les sis mostres responsive següents són anteriors al shortcut i inclouen captures programades. Tenen 0 timestamps duplicats; els seus intervals es prenen després de les lectures d’estil i serveixen com a evidència complementària de recorregut. La gravació normal amb timestamp rAF nadiu és la referència principal per al +1 final.

| Mida | Seqüència | Mediana FPS de mostreig | p95 d’interval | Punts diferents durant ruta |
|---|---|---:|---:|---:|
| 390×844 | +1 | 59,88 | 113,1 ms | 48 |
| 390×844 | Victòria | 60,24 | 49,3 ms | 23 |
| 1024×768 | +1 | 59,88 | 104,6 ms | 47 |
| 1024×768 | Victòria | 59,88 | 101,4 ms | 23 |
| 1440×900 | +1 | 59,88 | 116,8 ms | 44 |
| 1440×900 | Victòria | 59,88 | 119,4 ms | 23 |

La victòria normal [MOTION_VICTORY_QA.json](MOTION_VICTORY_QA.json) i [el vídeo](videos/motion/victory.webm) són posteriors al fallback físic del marcador i anteriors al shortcut de ruta. Confirmen l’ordre corona → targeta → marcador → accions. Les primeres mostres visibles són, respectivament, 2.033, 3.097, 3.185 i 3.291 ms després de recuperar FINISHED. Aquests temps inclouen stalls grans del host amb vídeo; no demostren execució exacta al mil·lisegon de les entrades de 520/920/1.420/1.900 ms del JSON. Sí que mostren ordre correcte, entrada física del marcador i accions finals després de mostrar-lo.

Build verificat després del shortcut: `index-DKPt5zKC.js` i `index-BNObSpEa.css`. L’informe agregat conserva les xifres individuals i la procedència de cada sèrie; no afirma 60 FPS constants ni rendiment garantit en dispositius físics.
