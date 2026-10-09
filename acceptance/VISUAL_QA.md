# Verificació visual — 9 d’octubre de 2026

S’han executat 34 captures en Chromium real contra Supabase, amb una sessió anònima nova, autorització privada i una partida presencial real. No s’han substituït les respostes de xarxa en aquestes captures. L’evidència final és `screenshots/real-visual-metrics.json` i els PNG `screenshots/real-*`.

| Pantalla | Mides executades |
| --- | --- |
| Accés privat | 390×844, 1024×768, 1440×900 |
| Inici i durada | Les tres anteriors, 360×800, 430×932, 1366×768 |
| Abans del torn | 390×844, 1024×768, 1440×900 |
| Pregunta i resposta presencial | Les sis mides de joc, 768×1024 i 844×390 |

Les captures principals s’han obert i inspeccionat visualment al costat de les referències. S’han conservat el fons de Sitges, els avatars i les peces de producció. La composició combina un paisatge, un tauler SVG amb caselles i peces independents, targetes HTML de paper i controls tàctils. No incorpora fotografies privades ni la referència composta com a fons.

Resultats mesurats:

- Zero errors JavaScript de pàgina.
- Sense overflow horitzontal ni scroll vertical en les sis mides de joc compatibles; les pantalles de rotació també queden dins del viewport.
- `Gira l’iPad` a 768×1024 i `Gira el dispositiu` a 844×390. El joc i la capçalera queden ocults durant el gate.
- Controls principals de 54–65 px d’alçada; validació de 55–56 px i separació de 10 px.
- Mateixa posició i dimensions exteriors de la targeta entre pregunta i resposta: 415,30 px a 390×844, 437 px a 1024×768 i 462 px a 1440×900.
- El tauler descansa sobre la zona de fusta; la perspectiva és de 9° en ordinador/tauleta i 2° en mòbil.
- El marcador general apareix a l’inici i no durant el torn.
- Els accents i l’ela geminada utilitzen Nunito; el logotip utilitza Caveat, totes dues servides localment.

Els marges calculats en mòbil són 12 px a dalt i 14 px a baix durant el joc, amb `max(..., env(safe-area-inset-*))`. El navegador utilitzat no té notch físic: es verifica la declaració i la reserva mínima, però no es presenta aquesta prova com una verificació en un iPhone físic.

Les primeres captures `visual-fixture-*` són iteracions de composició amb dades controlades i no són l’evidència final de funcionalitat o seguretat.

La partida visual final ha quedat incompleta a `ANSWER_REVEALED`; no ha arribat a Meta ni ha sumat cap resultat. L’identificador de partida i d’usuari consten al manifest per facilitar la neteja de QA. L’estat d’autenticació queda exclusivament a `/tmp/tecla-pau-visual-storage.json`, amb permisos 0600.

Per reproduir, executa Vite i `node scripts/capture-visual.mjs`. El codi privat es llegeix d’un fitxer extern al repositori (`TECLA_ACCESS_CODE_FILE`, o la ruta local establerta durant el setup). `TECLA_VISUAL_URL`, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` i `TECLA_VISUAL_STATE_FILE` permeten ajustar el servidor, el navegador i la ubicació privada de la sessió. El capturador crea una sessió independent i deixa una partida incompleta; no executa cap validació que pugui arribar a Meta.
