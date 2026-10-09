# Evidència del redisseny artístic

Les captures utilitzen Supabase real, Anonymous Auth, RPCs autoritatives, canals privats i dos contextos de navegador per al mode en línia. No s'injecta estat de joc ni es simula la connexió amb el servidor.

`node scripts/capture-art-redesign.mjs --smoke` recupera la partida vertical baseline explícita i captura l'estat actual sense mutacions. La sessió protegida es llegeix de `/tmp/tecla-pau-art-baseline-storage.json` i el codi privat del fitxer local protegit. Cap credencial forma part dels informes.

`node scripts/capture-art-redesign.mjs` recorre els dotze escenaris a 390×844, 1024×768 i 1440×900. El recorregut aplica accions legítimes del joc, captura els moments d'encert, error, +1 i victòria, comprova controls de 48×48 px i absència de desbordament, i registra mostres del moviment real.

La captura final només s'executa quan la fase de UI està preparada. `QA_MANIFEST.json`, `QA_E2E_MANIFEST.json` i `QA_MOTION_MANIFEST.json` enumeren exclusivament els usuaris i jocs de les proves noves. Els manifests antics no són candidats de neteja. `DATABASE_BEFORE.json` preserva els UUIDs dels sis jocs previs i el marcador existent de Pau 0 / Tecla 1.

La neteja final s’ha executat amb MCP després de revisar els manifests i completar les proves. Conserva totes les dades prèvies excepte el baseline QA explícit, i rebutja qualsevol joc vinculat a un usuari QA que no aparegui explícitament als manifests nous.

`VISUAL_CAPTURE_REPORT.json` conté 36 captures principals i 52 extres únics, amb 372 controls de 48×48 px com a mínim i nou parelles de botons de jutge amb geometria i pes iguals. El lobby addicional de 1366×768 es captura dins la regressió online existent i es documenta a `LOBBY_1366_REPORT.json`.

`FINAL_E2E_REPORT.json` registra les vuit proves completes. `MOTION_RECORDER_RECHECK_REPORT.json` valida el registre de frames aïllat; `MOTION_PATH_RECHECK_REPORT.json` repeteix només la prova normal de gir i +1 després de l'optimització de recorregut i comprova que el distintiu apareix després de la primera arribada. Aquestes dues comprovacions acaben en abandonament i no sumen punts. Els registres anteriors es conserven a `failures/` i els problemes resolts hi estan identificats.

`FINAL_PREVIEW_REPORT.json` comprova el build de producció a les tres mides amb la sessió QA existent, sense cap signup nou, i compara el SHA-256 dels JS/CSS servits amb el `dist` final. La regressió real de la vista abandonada es documenta a `ABANDON_REGRESSION_FIX_REPORT.json` i es corregeix amb l'únic canvi de serialització booleana de la migració 0010.

`MOTION_NO_VIDEO_REPORT.json` i `MOTION_NO_VIDEO_FRAMES.json` mesuren el mateix recorregut final sense vídeo ni captures, amb la sessió QA existent i un únic joc nou explícit. La prova manté les comprovacions de gir, recorregut continu, pausa intermèdia i +1 posterior a la primera arribada; acaba abandonada. L'informe de rendiment distingeix aquesta mesura de les gravacions amb vídeo i de les captures responsives.

`QA_CLEANUP_REPORT.json` registra 17 usuaris, 22 partides i 8 resultats QA eliminats, amb cap UUID QA restant. Preserva exactament els 10 altres jocs, 6 usuaris i 2 resultats presents al punt de neteja; el marcador legítim és 1–1. El 0–1 de `DATABASE_BEFORE.json` és un snapshot inicial, no un objectiu de reinicialització. Les noves partides no llistades creades durant el treball també es conserven. Les tres sessions QA locals s’han retirat i no s’han fet més escriptures de prova després de la neteja.

La conclusió completa és a [ART_REDESIGN_FINAL_AUDIT.md](../../audit/ART_REDESIGN_FINAL_AUDIT.md). El sistema d’art és a [ART_SYSTEM.md](../../docs/ART_SYSTEM.md); [FINAL_ART_ACCEPTANCE_MATRIX.csv](FINAL_ART_ACCEPTANCE_MATRIX.csv) inclou els criteris específics del redisseny i els 36 estats visuals. `VISUAL_REVIEW.md` i `review/` contenen la comparació de pantalles. `ART_MOTION_AUDIT.md` i `motion-performance-report.json` expliquen el moviment i els límits: la ruta sense vídeo té p95 de 16,7–16,8 ms, mentre el gir de targeta té intervals més llargs. No es garanteixen 60 FPS constants ni comportament en dispositius físics o Safari no provats.

La neteja autoritzada ja s'ha executat: 17 usuaris, 22 jocs i vuit resultats QA eliminats. `QA_CLEANUP_REPORT.json` verifica zero restes dels UUIDs llistats, preservació transaccional exacta dels altres deu jocs, sis usuaris i dos resultats, i marcador legítim Pau 1 / Tecla 1. El marcador inicial era una fotografia històrica; les partides noves no llistades s'han conservat. Les sessions temporals s'han retirat i `.env.local` i el codi privat es mantenen amb permisos 600. Aquesta campanya QA està tancada i no crea més usuaris ni jocs.
