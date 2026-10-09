# Alcoholfabet

La revisió del 9 d’octubre de 2026 canvia el nom del joc, retira els avatars i obre l’entrada sense codi privat. Els jugadors continuen sent en Pau i la Tecla, identificats pel nom i pels colors blau i rosa de les peces.

Durant una partida, la capçalera ocupa menys espai. El tauler manté tota l’amplada disponible en mòbil, la pregunta es llegeix a 23–33 px amb pes 800 i l’espai buit de resposta es retira mentre no hi ha contingut autoritzat. El paisatge de la partida és encara més tènue. La portada presenta el mateix tauler físic i dos gots; no hi ha avatars a les seleccions, la sala ni la victòria.

S’han retirat de la UI «Respon en veu alta! L’altra persona valida la resposta.» i «No s’encadenen bonificacions.». Les respostes encara es diuen parlant i el servidor continua aplicant la regla d’un únic +1, tal com requereixen les regles del joc.

## Beure

Un error confirmat conserva un avís amb el got i «En Pau ha de beure» o «La Tecla ha de beure». Beure doble mostra dos gots, ×2 i «Beu doble». `INCORRECT_AND_DRINK`, definida a `motion/event-choreography.json`, dura 1.080 ms: entrada física de l’avís, got que puja i s’inclina, segon got desfasat si correspon, sis bombolles, pols del paper i so sincronitzat a 220 ms. S’executa una vegada per esdeveniment confirmat. Amb moviment reduït no hi ha trajectòries ni bombolles; el nom, els gots i el control de so es mantenen.

## Entrada pública i partides

La migració `0012_alcoholfabet_public_access.sql` crea el context públic `alcoholfabet`. Una sessió d’Anonymous Auth pot entrar i crear directament, sense autoritzar un dispositiu amb el codi antic. Per unir dos dispositius es conserva el codi o enllaç de la sala en línia.

El context privat anterior `pau-tecla` conserva les dades, el marcador i els seus permisos. Obrir l’entrada no autoritza una sessió nova a llegir ni canviar una partida aliena o privada. RLS, la pertinença a la partida, les accions RPC autoritatives, la resposta filtrada per rol i els canals Realtime privats continuen vigents. El marcador públic és propi del nou context; només canvia amb META.

El frontend local continua a `http://127.0.0.1:5173`. Aquesta revisió habilita l’entrada pública del joc; no modifica la configuració d’allotjament.

## Verificació

Els informes són a `acceptance/alcoholfabet/`. `ALCOHOLFABET_E2E_REPORT.json` documenta les cinc comprovacions d’accés, noms, gots, durada, abandonament i T&P. Conserva els intents previs fallits i declara els runs combinats. `COMPLETE_GAMES_E2E_REPORT.json` comprova partides completes presencials i en línia amb Supabase real.

`PUBLIC_ACCESS_SERVER_REPORT.json` comprova entrada sense codi, separació del context privat, no-membres, respostes i ACL Realtime, amb fixtures desfets dins de la transacció. `DURATION_SERVER_REPORT.json` torna a completar 50 caselles amb 87 preguntes sense repetició. `LEGACY_SECURITY_REPORT.json` verifica els permisos del context privat conservat.

`VISUAL_REPORT.json` conté 30 captures de components reals en 360×800, 390×844, 430×932, 1024×768 i 1440×900. `DRINK_MOTION_REPORT.json` executa la coreografia, el runner i l’orquestrador reals, amb i sense moviment reduït: una execució, sis bombolles en motion normal i zero partícules residuals. En aquest harness es registren els cues sonors; les proves funcionals utilitzen el gestor d’àudio de l’app.

La còpia privada anterior està a `/home/pau/Documents/alcoholfabet-before-20261009.tar.gz` (0600). Els fitxers d’avatar han sortit de `public/` i el component s’ha retirat. Les fonts històriques queden fora del paquet públic i el servidor de desenvolupament les bloqueja.
