# Alcoholfabet

La revisió del 9 d’octubre de 2026 canvia el nom del joc, retira els avatars i obre l’entrada sense codi privat. Els jugadors continuen sent en Pau i la Tecla, identificats pel nom i pels colors blau i rosa de les peces.

Durant una partida, la capçalera ocupa menys espai. El tauler manté tota l’amplada disponible en mòbil, la pregunta es llegeix a 23–33 px amb pes 800 i l’espai buit de resposta es retira mentre no hi ha contingut autoritzat. El paisatge de la partida és encara més tènue. La portada presenta el mateix tauler físic i dos gots; no hi ha avatars a les seleccions, la sala ni la victòria.

S’han retirat de la UI «Respon en veu alta! L’altra persona valida la resposta.» i «No s’encadenen bonificacions.». Les respostes encara es diuen parlant i el servidor continua aplicant la regla d’un únic +1, tal com requereixen les regles del joc.

## Beure

Un error confirmat fa aparèixer un got vectorial gran al centre de la pantalla, amb «En Pau» o «La Tecla» i «ha de beure». El vidre inclou glaçons, reflexos i beguda d’ambre en moviment. Beure doble mostra dos gots que brinden entre ells, ×2 i «Beu doble». La coreografia `INCORRECT_AND_DRINK`, definida a `motion/event-choreography.json`, dura 3.600 ms; l’elevació, el líquid, els reflexos, deu partícules, la sortida i el so del brindis a 930 ms es coordinen des del mateix runner.

S’executa una vegada per esdeveniment confirmat. La capa desapareix en acabar i també si es cancel·la, s’abandona la partida o es perd la connexió. La targeta conserva l’avís amb el nom i la penalització. El nom prové del respondent confirmat, també en T&P. Amb moviment reduït es presenta el got estàtic durant 900 ms, sense trajectòries ni partícules; el control de so es respecta.

## Entrada pública i partides

La migració `0012_alcoholfabet_public_access.sql` crea el context públic `alcoholfabet`. Una sessió d’Anonymous Auth pot entrar al menú i crear una partida presencial sense codi. La revisió posterior `0013_online_player_identity.sql` afegeix dos codis privats exclusivament per a partides en línia: cada codi identifica un dels jugadors al servidor. La creació i la incorporació exigeixen el rol identificat. Per unir els dos dispositius es conserva també el codi o enllaç de sala.

El context privat anterior `pau-tecla` conserva les dades, el marcador i els seus permisos. Obrir l’entrada no autoritza una sessió nova a llegir ni canviar una partida aliena o privada. RLS, la pertinença a la partida, les accions RPC autoritatives, la resposta filtrada per rol i els canals Realtime privats continuen vigents. El marcador públic és propi del nou context; només canvia amb META.

El frontend local continua a `http://127.0.0.1:5173`. Aquesta revisió habilita l’entrada pública del joc; no modifica la configuració d’allotjament.

## Verificació

Els informes són a `acceptance/alcoholfabet/`. `ALCOHOLFABET_E2E_REPORT.json` documenta les cinc comprovacions d’accés, noms, gots, durada, abandonament i T&P. Conserva els intents previs fallits i declara els runs combinats. `COMPLETE_GAMES_E2E_REPORT.json` comprova partides completes presencials i en línia amb Supabase real.

`PUBLIC_ACCESS_SERVER_REPORT.json` comprova entrada sense codi, separació del context privat, no-membres, respostes i ACL Realtime, amb fixtures desfets dins de la transacció. `DURATION_SERVER_REPORT.json` torna a completar 50 caselles amb 87 preguntes sense repetició. `LEGACY_SECURITY_REPORT.json` verifica els permisos del context privat conservat.

`VISUAL_REPORT.json` conté 30 captures de components reals en 360×800, 390×844, 430×932, 1024×768 i 1440×900. `DRINK_MOTION_REPORT.json` executa la coreografia, el runner i l’orquestrador reals, amb i sense moviment reduït: una execució, sis bombolles en motion normal i zero partícules residuals. En aquest harness es registren els cues sonors; les proves funcionals utilitzen el gestor d’àudio de l’app.

La còpia privada anterior està a `/home/pau/Documents/alcoholfabet-before-20261009.tar.gz` (0600). Els fitxers d’avatar han sortit de `public/` i el component s’ha retirat. Les fonts històriques queden fora del paquet públic i el servidor de desenvolupament les bloqueja.

La revisió posterior del brindis central es verifica a `acceptance/drink-stage/BROWSER_REPORT.json`, amb la versió anterior conservada a `audit/drink-stage-before/`. Els informes anteriors d’Alcoholfabet descriuen l’estat verificat abans d’aquesta revisió.

La revisió de ritme allarga les animacions principals un 50% i elimina la frase d’estimació de la pantalla de durada. Els informes actuals d’aquesta revisió són a `acceptance/animation-tempo/`; els anteriors es conserven com a historial.

La identificació en línia i la recuperació de sessions es documenten a `acceptance/online-identity/`. S’han executat cinc comprovacions de navegador amb Supabase real, dues suites SQL transaccionals, 34 proves unitàries i nou captures als tres formats requerits. Les fixtures QA s’han eliminat amb una neteja limitada als identificadors registrats.
