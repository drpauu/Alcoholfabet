# Auditoria del redisseny integral — Tecla&Pau

9 d’octubre de 2026. Aquesta auditoria correspon al nou encàrrec d’art i és independent de l’auditoria de la primera implementació. El redisseny visual, la bateria E2E, el preview de producció i l’auditoria de motion estan verificats. La neteja QA es documenta a la secció final.

## Resultat implementat

La capa visible comparteix un sistema mediterrani de paper gruixut, fusta treballada, ceràmica pigmentada i llautó vell, amb llum de capvespre. El paisatge i els avatars aprovats es conserven. El tauler té base completa, gruix, veta, vores irregulars, gravats i ombra de contacte. Les peces són un objecte blau angular per a en Pau i una ceràmica rosa arrodonida per a la Tecla, amb símbols i siluetes diferents.

Tots els botons consumeixen ArtButton; les targetes i els panells comparteixen ArtPanel/ArtCard, i els diàlegs utilitzen ArtModal. S’han aplicat també ArtBadge, ArtToast, ArtLoader i 27 icones SVG pròpies a inici, preparació, sala, pregunta, reconnexió, normes, abandonament i victòria. Els inputs, plaques de codi, focus i scrollbars segueixen el mateix material. Correcte i Incorrecte tenen el mateix pes i geometria.

El sistema executat és a `src/art-system/` i està documentat a [ART_SYSTEM.md](../docs/ART_SYSTEM.md). `design/` conserva els tokens i la direcció d’art; `motion/event-choreography.json` continua sent el contracte temporal. La ruta, les caselles i les coordenades d’animació són SVG programàtic. El tauler combina capes independents i una mostra retallada de veta del paisatge aprovat.

## Auditoria i porta visual

L’app anterior es va executar abans dels canvis i es van capturar 34 imatges a [art-redesign-before/](art-redesign-before/). Hi ha còpia prèvia protegida, amb permisos 600, a `/home/pau/Documents/tecla-pau-app-before-art-redesign-20261009.tar.gz`. `.env.local` no forma part del backup.

La primera pantalla completa es va inspeccionar abans de propagar els components: `vertical-system-smoke-{390x844,1024x768,1440x900}.png`, amb la partida real baseline, sense mutar-la. Després es va aplicar el sistema a totes les pantalles.

La porta final conté 36 captures obligatòries: inici, durada, sala online, abans del torn, pregunta, resposta revelada, encert, error, T&P, +1, desconnexió i victòria a 390×844, 1024×768 i 1440×900. [VISUAL_CAPTURE_REPORT.json](../acceptance/art-redesign/VISUAL_CAPTURE_REPORT.json) passa sense captures pendents ni errors. Inclou 52 extres únics, 372 controls de com a mínim 48×48 px i 9 parelles de validació amb geometria, font, padding i ombres equivalents. La inspecció de les 36 captures està registrada a [VISUAL_REVIEW.md](../acceptance/art-redesign/VISUAL_REVIEW.md), amb els contactes a [review/](../acceptance/art-redesign/review/).

També s’han comprovat pregunta/resposta a 360×800, 430×932 i 1366×768, rotació 844×390 i 768×1024, tauler de 100 minuts, accés, error, càrrega, rols i diàlegs. Les captures responsive extra utilitzen una pregunta real de 32 caràcters; no són una prova de la pregunta més llarga. La geometria nativa comprova 77 centres en set longituds de tauler, amb error 0 entre ruta, DOM i exports.

## Correccions verificades durant la revisió

- La càmera de victòria actua sobre la partida; la capçalera conserva controls de 48 px.
- La reconnexió desenfoca el paisatge i manté el text del panell nítid.
- La copa conserva 56×77 px i queda separada de la creu d’error.
- La sala usa avatars horitzontals i espai compacte en mòbil i pantalles horitzontals de poca alçada.
- La durada personalitzada cap a iPad i escriptori; l’input de paper no mostra fletxes natives del navegador.
- Sortida i Meta s’adapten al tauler dens sense ocultar números, símbols ni peces.
- L’entrada del marcador final executa una animació física de paper de 420 ms al moment establert al JSON.
- Les caselles exposen la fracció exacta de la ruta SVG. El runner evita 482 cerques natives d’extrems per tram, conserva les 21 mostres i inicia el segell +1 després de la primera arribada. La repetició final sense vídeo comprova una pausa de 483,4 ms i un segell visible 233,4 ms després de l’arribada.

Els frames `incorrect-settled-*` mostren el resultat després del feedback; no s’atribueix una copa visible ni un instant exacte de 360 ms a aquestes imatges. Les captures core d’error sí mostren el feedback. Els intents QA fallits queden separats a `failures/`.

## Backend i privacitat

La QA utilitza Supabase real, Auth anònima, RPCs autoritatives, Realtime privat i dues sessions de navegador per a l’online. S’ha aplicat amb MCP la migració [0010](../supabase/migrations/0010_game_view_boolean_answer_capability.sql): una partida online abandonada durant QUESTION podia serialitzar `canSeeAnswer: null`; ara retorna un booleà amb `coalesce(..., false)`. La resta de la funció i els permisos es conserven. La verificació amb la mateixa sessió recupera ABANDONED v4 sense pregunta ni resposta. No s’han desplegat noves Edge Functions.

L’inventari comprova 35 SVG, incloses 27 icones, quatre textures, dues peces i dos efectes, amb còpies de producció i public idèntiques. Els deu fitxers d’avatars són idèntics al backup. Les fotografies originals no apareixen als assets públics. El scan del build comprova les 130 preguntes, fotografies originals, codi privat, claus secretes i JWT service_role, sense publicar valors. `.env.local` i el fitxer del codi privat conserven permisos 600.

## Validació funcional final

TypeScript, les 18 proves unitàries de quatre fitxers i el build han passat després de l’últim ajust de ruta: [LOCAL_CHECK_REPORT.json](../acceptance/art-redesign/LOCAL_CHECK_REPORT.json). El scan de [BUILD_SECURITY_REPORT.json](../acceptance/art-redesign/BUILD_SECURITY_REPORT.json) correspon als JS/CSS finals de `dist`, els mateixos hashes que serveix el preview.

La bateria [FINAL_E2E_REPORT.json](../acceptance/art-redesign/FINAL_E2E_REPORT.json) passa amb 8 proves, 0 fallades, 0 flaky, 0 skips i 0 errors. Executa accés privat, presencial, online amb dos contexts, resposta segura, T&P concurrent, recàrrega, reconnexió, victòria amb resultat únic, abandonament durant pregunta sense punt i motion normal/victòria. Aquest recorregut complet és anterior a l’optimització final del càlcul de ruta. Després del canvi s’han executat de nou la prova afectada de gir, recorregut i +1, amb vídeo i sense vídeo: [MOTION_PATH_RECHECK_REPORT.json](../acceptance/art-redesign/MOTION_PATH_RECHECK_REPORT.json) i [MOTION_NO_VIDEO_REPORT.json](../acceptance/art-redesign/MOTION_NO_VIDEO_REPORT.json), totes dues PASS. No s’atribueix una segona execució de la suite completa a aquests rechecks.

[FINAL_PREVIEW_REPORT.json](../acceptance/art-redesign/FINAL_PREVIEW_REPORT.json) executa el build de producció a les tres mides, amb una sessió QA existent, sense altes noves. Recupera una vista real de partida abandonada, comprova controls i viewport sense desbordament, i registra zero errors. Els JS/CSS servits coincideixen byte a byte amb els hashes finals. No és una segona bateria de tots els fluxos sobre el preview.

[ART_MOTION_AUDIT.md](../acceptance/art-redesign/ART_MOTION_AUDIT.md) i [motion-performance-report.json](../acceptance/art-redesign/motion-performance-report.json) consoliden les sis sèries responsive, la suite completa, les repeticions corregides i la mesura sense vídeo. Els 14 checks d’evidència passen. El registre final confirma el gir amb canvi de cara al punt mig, la ruta contínua, dos aterratges +1 i l’ordre de corona, paper, targeta, marcador i accions de victòria. Les traces responsive i de victòria anteriors al càlcul directe de ruta estan identificades com a tals.

La prova de components React comprova diàlegs controlats en Strict Mode, Esc, restauració de focus i botó loading sense canvi d’amplada: [component-behavior-qa.json](../acceptance/art/component-behavior-qa.json). La matriu específica del nou encàrrec és [FINAL_ART_ACCEPTANCE_MATRIX.csv](../acceptance/art-redesign/FINAL_ART_ACCEPTANCE_MATRIX.csv): 68 files, 67 PASS i un PARTIAL de rendiment. La matriu principal conserva l’evidència històrica de backend i apunta a la UI actual: 88 files, 87 PASS i un PARTIAL de rendiment. Cap criteri P0 queda pendent.

## Dades QA i límits

El marcador existent al començament era Pau 0 / Tecla 1. Durant la revisió es van crear partides i un resultat nou fora dels manifests QA; tots es van conservar. La neteja amb MCP del 9 d’octubre de 2026 a les 13:44:37 UTC està restringida als UUIDs QA explícits del nou encàrrec i al baseline QA identificat.

[QA_CLEANUP_REPORT.json](../acceptance/art-redesign/QA_CLEANUP_REPORT.json) registra COMPLETE: 17 usuaris temporals, 22 partides i 8 resultats QA eliminats; cap UUID QA restant a usuaris, partides, dispositius, sessions, identitats, membres ni resultats. La transacció comprova que els 10 altres jocs, 6 altres usuaris i 2 altres resultats són idèntics abans i després. El marcador legítim al punt de neteja és Pau 1 / Tecla 1, dues partides finalitzades; no s’ha reinicialitzat. La parella, les 130 preguntes i el hash privat es conserven.

La consulta posterior comprova RLS a totes les taules exposades i `get_game_view` executable per authenticated, sense EXECUTE per anon. S’han retirat els tres fitxers temporals de sessió protegits; `.env.local` i el codi privat conserven permisos 600. No s’han executat més proves amb escriptures després de la neteja.

Les captures mostren marcadors temporals que inclouen resultats QA. Són evidència del flux executat i no descriuen el marcador legítim després de la neteja.

La inspecció és en Chromium sobre Linux amb viewports simulats. No acredita Safari, notch físic ni FPS constants en mòbils físics. El benchmark final sense vídeo/captures registra una mediana de 59,88 FPS a les vuit sèries. Durant el desplaçament de les peces, p95 dels intervals és 16,7–16,8 ms; el +1 conté 49 punts de recorregut diferents. Els intervals amb gir actiu de targeta tenen p95 de 66,6–116,7 ms: el registre no acredita fluïdesa constant ni durades físiques exactes del gir. La ruta passa les comprovacions funcionals; rendiment constant continua PARTIAL a les matrius. Les altres sèries inclouen cost de captura o codificació de vídeo i no es barregen amb aquesta mesura.

Vite adverteix que el chunk principal supera 500 KB (591.908 bytes JS i 40.841 bytes CSS); el build és vàlid. Les imatges principals són WebP i no s’ha afegit cap motor 3D. No queda cap acció manual necessària per executar l’app local configurada; una publicació futura haurà de configurar el seu origen CORS a l’Edge Function. No s’ha publicat el frontend durant aquest encàrrec.
