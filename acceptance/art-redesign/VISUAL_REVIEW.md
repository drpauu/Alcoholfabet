# Revisió visual del redisseny

Resultat: **PASS als 36 estats obligatoris**, inspeccionats a 390×844, 1024×768 i 1440×900. El tauler, les peces, el paper, els controls, la capçalera i els efectes comparteixen la paleta, els materials i la llum de `docs/ART_SYSTEM.md`. No queda cap problema visual pendent identificat en aquesta revisió.

Les captures originals són del navegador amb Supabase real. El [manifest de captura](VISUAL_CAPTURE_REPORT.json) registra 88 PNG únics, `missing: []` i `errors: []`. El lobby addicional de 1366×768 té [informe propi](LOBBY_1366_REPORT.json) i reutilitza el joc i els actors de l’E2E. La revisió visual s’ha fet sobre els PNG originals i els contactes següents, que només els disposen en HTML sense modificar-los.

## Porta de dotze estats

| Estat | 390×844 | 1024×768 | 1440×900 |
|---|---|---|---|
| Inici | PASS | PASS | PASS |
| Selector de durada | PASS | PASS | PASS |
| Sala en línia | PASS | PASS | PASS |
| Tauler abans del torn | PASS | PASS | PASS |
| Pregunta | PASS | PASS | PASS |
| Resposta revelada | PASS | PASS | PASS |
| Encert | PASS | PASS | PASS |
| Error i got | PASS | PASS | PASS |
| T&P | PASS | PASS | PASS |
| +1 | PASS | PASS | PASS |
| Desconnexió | PASS | PASS | PASS |
| Victòria | PASS | PASS | PASS |

Contactes complets: [mòbil](review/contact-sheet-390x844.png), [tauleta](review/contact-sheet-1024x768.png) i [ordinador](review/contact-sheet-1440x900.png). Cada contacte conté els dotze PNG requerits. Les versions HTML contigües permeten obrir les imatges originals.

S’han comparat amb les captures inicials `acceptance/screenshots/real-game-{390x844,1440x900}.png` i amb els tres `vertical-system-smoke-*` de la primera porta. El tauler ara té base completa, cantell treballat, gruix, veta pintada i ombra de contacte. Les caselles tenen pigment ceràmic, gravats i patrons diferenciats. Les peces tenen siluetes pròpies: fulla angular blava i flor/conquilla rosa, amb acabat mat i petits símbols gravats. Els avatars aprovats es conserven.

La llum ambre del tauler i els controls concorda amb el capvespre del paisatge; les vores crema, les ombres curtes i la saturació apagada es mantenen entre pantalles. Les targetes comparteixen el mateix paper, cantell i ornament botànic. La decoració queda fora del text de pregunta, resposta i accions. Els botons de validació tenen la mateixa geometria, pes tipogràfic i ombra. Els overlays conserven l’ambient mediterrani i el seu text és nítid.

## Cobertura addicional

- Durada personalitzada als tres formats, amb input de paper i sense spinner genèric del navegador.
- Qui comença, normes i confirmació d’abandonament als tres formats.
- Accés privat, error d’accés, elecció en línia, rol, unir-se, respondent, jutge i partida abandonada. Contactes: [mòbil](review/contact-online-390x844.png), [tauleta](review/contact-online-1024x768.png), [ordinador](review/contact-online-1440x900.png). L’estat de càrrega també està capturat en mòbil.
- Tauler real de 100 minuts, amb Meta a la posició 15, als tres formats. Plaques, caselles i peces queden dins de la base; Sortida i Meta no se superposen a les caselles adjacents.
- Pregunta i resposta revelada a 360×800, 430×932 i 1366×768. Els sis PNG passen la inspecció de text, controls, tauler i separació de targeta. La pregunta d’aquest grup té 32 caràcters segons [l’informe](ADDITIONAL_RESPONSIVE_REPORT.json); no s’utilitza com a prova d’una pregunta llarga.
- Rotació a 844×390 i 768×1024, amb paisatge visible, vel càlid i missatge llegible.
- Corona i retalls de paper de victòria als tres formats. Els extres `incorrect-settled-*` documenten el resultat assentat; la creu i el got en moviment estan visibles als tres PNG principals `incorrect-*`.
- [Lobby real a 1366×768](screenshots/online-lobby-extra-1366x768.png): paper fins a y706, cos de pàgina de 768 px i controls de 48/54 px.

## Correccions comprovades

| Problema observat | Correcció final i evidència |
|---|---|
| En un recorregut dens, els extrems envaïen la primera/última casella. | Plaques adaptatives i desplaçament només de l’art de Sortida; `board-100-minutes-*` als tres formats passen. Les coordenades de ruta continuen intactes. |
| El paper del lobby mòbil cobria el tauler. | Espais compactes i avatars horitzontals. Captura real: paper y430,7–829, tauler fins a y393,0; separació de 37,7 px. |
| El lobby de poca alçada tallava el peu del paper. | Regles exclusives de lobby a `min-width:768px/max-height:800px`. Captures reals: paper fins a y722 a 1024×768 i y706 a 1366×768; sense scroll. |
| La durada personalitzada tallava Continuar a 1024×768. | Quatre presets en una fila quan l’alçada és limitada. Paper fins a y715,4 i tots els controls visibles en la recaptura real. |
| El got de feedback era petit i podia coincidir amb la creu. | Got 56×77 amb posició separada. `incorrect-*` dels tres formats mostren els dos símbols sense cobrir el text. |
| L’overlay de connexió rebia el blur del seu avantpassat. | Blur acotat al paisatge i al joc. Els tres `disconnect-*` tenen paper i text nítids sobre l’escena desenfocada. |
| El zoom de victòria reduïa controls de capçalera. | Càmera acotada a l’escena física; els controls mantenen almenys 48×48 en les captures finals. |

## Geometria i comprovacions

[BOARD_GEOMETRY_REPORT.json](BOARD_GEOMETRY_REPORT.json) mesura la geometria SVG nativa en Chromium: 77 centres per a set longituds de tauler (Meta 5, 6, 7, 9, 12, 15 i 16). `data-board-x/y`, `boardPoint` i els endpoints de `boardPathBetween` coincideixen amb `getPointAtLength` amb error mesurat zero. Les peces conserven l’offset visual y+10 esperat pel runner. La ruta, les caselles i les peces continuen sent objectes programàtics; la mostra de veta del paisatge només texturitza la cara de fusta.

El manifest real comprova controls mínims de 48×48, focus visible per Tab, text sense desbordament i geometria simètrica de Correcte/Incorrecte. El lobby mòbil manté els controls principals al peu del paper. El canvi de regla de lobby també s’ha executat en un harness local a 1024×768 i 1366×768: paper de 472 px, cos de 768 px i botons de 54 px. Els PNG del directori `review/` amb noms de harness documenten iteració de components; no substitueixen les captures reals de `screenshots/`.

Última comprovació després del canvi de lobby: `npm run check` PASS, TypeScript PASS, 18 tests en quatre fitxers PASS i build de producció PASS. Les animacions i les mostres temporals tenen [auditoria pròpia](ART_MOTION_AUDIT.md) i [mesures separades](motion-performance-report.json). Aquesta revisió visual no dedueix FPS d’un PNG ni atribueix rendiment a un dispositiu físic.

Els contactes es poden regenerar executant `node acceptance/art-redesign/review/create-contact-sheets.mjs`; `PLAYWRIGHT_CHROMIUM_EXECUTABLE` permet indicar el Chromium disponible. El generador exigeix els dotze PNG principals de cada mida i no muta l’aplicació ni el servidor.
