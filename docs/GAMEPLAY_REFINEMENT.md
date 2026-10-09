# Lectura, avisos de beure i torns de 30 segons

Els resultats incorrectes mostren un got amb beguda ambre i el nom del respondent confirmat pel servidor: «En Pau ha de beure» o «La Tecla ha de beure». L’avís es manté fins al següent torn i conserva «Beu doble» i ×2 quan la casella té +1. En T&P s’utilitza `lastEvent.payload.respondingPlayer`; el jugador del següent torn ja pot ser diferent. El dispositiu que respon en línia continua sense rebre la resposta.

Abandonar espera que l’RPC confirmi l’estat `ABANDONED` i porta al menú principal. També ho fa al segon dispositiu després de recuperar la vista segura per Realtime, i en recarregar un apuntador antic. S’esborren els dos apuntadors locals de la partida, i el marcador continua sent el del servidor. Si falla l’RPC es conserva la partida i la confirmació perquè es pugui tornar a intentar.

La durada de les noves partides s’estima amb 30 segons per torn compartit, dos jugadors, 75% d’encerts i 12% de caselles +1. Les opcions 20/30/45/60 minuts generen 17/25/38/50 caselles. El selector personalitzat admet 10–60 minuts per evitar presentar durades que el banc de 130 preguntes sense repetició no pot sostenir. És una estimació: el rellotge no passa torns ni decideix respostes. Vegeu [DURATION_MODEL.md](DURATION_MODEL.md) per al model i els seus límits. La migració 0011 conserva les partides antigues i els resultats existents.

Els taulers de més de 15 caselles es mostren per trams superposats. Cada moviment d’una casella o +1 queda complet dins del tram que s’enfoca automàticament. Les fletxes permeten inspeccionar tota la ruta sense canviar posicions, torn o versió. La sortida i Meta apareixen només als seus trams reals. El HUD continua mostrant el progrés global dels dos jugadors; una peça fora del tram s’indica amb el nom, número i fletxa, sense representar-la en una casella falsa.

El fons té menys brillantor, saturació i contrast mitjançant un filtre exclusiu de la imatge d’escena. Els avatars, peces i paper queden fora del filtre. Els textos sobre el paisatge tenen tinta crema i contorn o suport mat; els textos secundaris sobre paper són més foscos. Els controls mantenen les dimensions tàctils.

## Verificació

Les proves de la revisió queden a `acceptance/gameplay-refinement/`. `VISUAL_REPORT.json` distingeix el harness de components sense Auth/DB de les captures de l’app real. `DURATION_SERVER_REPORT.json` registra les proves SQL amb rollback; `GAMEPLAY_E2E_REPORT.json` i `COMPLETE_GAMES_E2E_REPORT.json` registren els contexts reals amb Supabase: tres proves d’aquesta revisió i dues partides completes. `npm run check` passa TypeScript, 29 proves unitàries i la compilació final.

Hi ha 35 captures de l’app real en 360×800, 390×844, 430×932, 1024×768 i 1440×900. Després es va corregir l’espai de les preguntes llargues als mòbils de poca alçada. `SMALL_VIEWPORT_REPORT.json` comprova el CSS final amb 30 captures addicionals de components reals, preguntes aprovades i avisos dobles de les dues persones: sense solapaments, controls de 48×48 o més i un marge mínim de 4,8 px entre la pregunta i la resposta o l’avís. Aquestes captures locals no creen sessions ni partides, i les captures funcionals anteriors es conserven com a evidència històrica.

`QA_CLEANUP_REPORT.json` confirma la retirada dels 18 usuaris, 13 partides i 5 resultats enumerats al manifest d’aquesta revisió. Les dades no enumerades, el banc de preguntes i el marcador legítim queden preservats. `BUILD_SECURITY_REPORT.json` comprova que el paquet final no conté el codi privat, claus de servei, fotografies originals ni preguntes del banc, i que els avatars vigents són idèntics. `PREVIEW_REPORT.json` comprova per HTTP que el servidor local serveix exactament aquest paquet.
