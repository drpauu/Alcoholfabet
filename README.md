# Alcoholfabet

Joc públic de taula i de beure per a en Pau i la Tecla, amb React, TypeScript i Supabase. La mateixa base de dades arbitra els modes presencial i en línia: el navegador envia intencions i rep una vista segura segons el seu rol.

## Executar

```sh
npm ci
cp .env.example .env.local
# Emplenar VITE_SUPABASE_PUBLISHABLE_KEY amb la clau pública del projecte.
npm run dev
```

Obre http://127.0.0.1:5173. En aquest entorn ja hi ha `.env.local` configurat; no està inclòs al control de versions. El menú i el mode presencial són públics. Només el mode en línia demana el codi privat del jugador.

Anonymous Sign-Ins està activat i verificat al projecte remot. Les proves finals de partida han utilitzat dispositius anònims nous i el backend real, sense simular el servidor.

## Desplegar a Vercel

Al projecte de Vercel, obre **Settings → Environment Variables** i configura `VITE_SUPABASE_URL=https://lhgyopkwstuyxolwfucq.supabase.co` i `VITE_SUPABASE_PUBLISHABLE_KEY` amb la mateixa clau pública de `.env.local`. Selecciona **Production** i, si utilitzes desplegaments de prova, **Preview**. Desa els canvis i torna a desplegar des de **Deployments → Redeploy**: Vite incorpora els valors durant la compilació, no després. `.env.local` queda fora de Git i no es transfereix automàticament a Vercel.

Configuració del build: framework **Vite**, comanda `npm run build`, directori de sortida `dist`. La compilació ara falla amb els noms de les variables absents per evitar publicar una app sense connexió. La clau ha de ser pública; no hi introdueixis una service role key ni els codis dels jugadors. El missatge «Cal configurar la connexió al joc.» indica que el frontend publicat s’ha compilat sense la configuració de connexió necessària.

## Jugar

En persona, escolliu durada i qui comença, responeu parlant i premeu `Mostra la resposta` abans de jutjar. En línia, el codi privat identifica en Pau o la Tecla al servidor; després compartiu el codi de sala i comenceu quan tots dos siguin connectats. El rol es conserva en recarregar i es pot canviar des de la preparació de la trobada. El respondent no rep la resposta al JSON. T&P es reclama atòmicament al servidor. Només arribar formalment a Meta afegeix una victòria.

## Verificar

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright necessita Chromium. La configuració utilitza el navegador instal·lat en aquest entorn; en un altre equip, instal·la'l amb `npx playwright install chromium` i defineix `PLAYWRIGHT_CHROMIUM_EXECUTABLE` amb el seu camí, o elimina l'override `executablePath` de la configuració.

Les proves E2E fan escriptures reals al projecte Supabase configurat. Necessiten accés anònim activat. Les proves en línia llegeixen els dos codis des de `~/.config/tecla-pau/online-player-codes.json`, amb permisos `0600` i claus `PAU` i `TECLA`; `TECLA_ONLINE_CODES_FILE` permet canviar-ne el camí. Aquest fitxer queda fora del repositori i del build. Les traces estan desactivades per evitar registrar credencials. Executeu les suites de backend, E2E i motion successivament perquè comparteixen marcador.

## Fitxers

- `src/components/`: escena, tauler SVG, fitxes, avatars i targeta.
- `src/components/art/`: botons, targetes, panells, icones, modals i avisos amb una base comuna.
- `src/art-system/`: pigments, materials, llum, ombres i efectes del redisseny mediterrani.
- `src/hooks/`: reducer de sessió i canal privat amb recuperació d'estat.
- `src/services/`: frontera Supabase i validació de vistes segures.
- `src/motion/`: coreografies del JSON, trajectòries SVG, àudio i deduplicació.
- `supabase/`: esquema, RLS, RPCs i funció d'accés.
- `audit/`: auditoria inicial i final; `acceptance/`: proves i matriu.

Les fotografies de referència privades romanen fora de `public/` i `dist/`. Els assets aprovats es conserven a `assets/production/`.

La direcció d’art i els contractes dels components són a [docs/ART_SYSTEM.md](docs/ART_SYSTEM.md). El paisatge aprovat es conserva; tauler, peces, paper, ceràmica, botons i símbols comparteixen el mateix sistema de materials i llum. El tauler continua sent SVG amb ruta, caselles i punts d’animació disponibles al codi. El [refinament dels avatars](docs/AVATAR_REFINEMENT.md) corregeix el nas de la Tecla, els contorns blancs i el doble marc: cada perfil reutilitza el mateix mestre transparent que el personatge de l’inici.

L’auditoria del redisseny actual és a [audit/ART_REDESIGN_FINAL_AUDIT.md](audit/ART_REDESIGN_FINAL_AUDIT.md), amb [36 pantalles revisades als tres formats](acceptance/art-redesign/VISUAL_REVIEW.md), 18 proves unitàries, vuit E2E sobre Supabase real i preview del build final verificats. Els rechecks de motion després de l’últim ajust i els límits de rendiment estan documentats per separat. La matriu específica és [FINAL_ART_ACCEPTANCE_MATRIX.csv](acceptance/art-redesign/FINAL_ART_ACCEPTANCE_MATRIX.csv).

L’auditoria de la primera implementació és a [audit/FINAL_AUDIT.md](audit/FINAL_AUDIT.md). L’evidència del redisseny integral es desa separadament a [acceptance/art-redesign/](acceptance/art-redesign/). Les proves escriuen només en partides QA identificades; la neteja conserva les partides i el marcador de l’usuari.

La revisió de llegibilitat i avisos de beure, el retorn directe al menú en abandonar i la durada estimada amb 30 segons per torn estan documentats a [GAMEPLAY_REFINEMENT.md](docs/GAMEPLAY_REFINEMENT.md). Les noves partides admeten 10–60 minuts i el tauler es mostra per trams quan el recorregut és llarg.

## Revisió Alcoholfabet

Entrada pública amb Anonymous Auth, nom Alcoholfabet i cap avatar al paquet públic. Els noms Pau i Tecla i els colors blau i rosa identifiquen les peces. La pregunta i el tauler tenen prioritat visual; els resultats incorrectes mostren un brindis amb got, nom, bombolles i so, o dos gots per beure doble. S’han retirat els dos textos d’ajuda demanats.

La migració `0012_alcoholfabet_public_access.sql` crea el context públic separat; conserva íntegres les partides i el marcador privat històrics. El codi de sala en línia continua servint per unir els dos dispositius. Informes de la revisió: `acceptance/alcoholfabet/`; documentació: `docs/ALCOHOLFABET.md`.

El brindis actual apareix gran al centre durant 3,6 segons, amb got vectorial, líquid i reflexos animats; dos gots brinden quan toca beure doble. Verificació local sense escriptures a Supabase: `node scripts/verify-drink-stage.mjs` (Vite ha d’estar actiu al port 5173). Captures, vídeo i comprovacions de cancel·lació, recàrrega i moviment reduït: `acceptance/drink-stage/`.

Les animacions principals s’han alentit un 50%, amb el so sincronitzat. S’ha retirat la frase d’estimació de la pantalla de durada. Proves d’aquesta revisió: `acceptance/animation-tempo/`; el brindis es verifica amb `node scripts/verify-drink-stage.mjs --output-dir=acceptance/animation-tempo/drink`.

La pregunta s’obre automàticament en començar, reprendre o passar al torn següent. S’ha eliminat el pas «La següent casella us espera» i el botó de començar el torn. En línia inicia el torn només el dispositiu autoritzat pel servidor. Amb Vite actiu, `node scripts/verify-automatic-turn.mjs` comprova el flux presencial, els dos rols en línia, T&P, recàrrega, errors i reconnexió amb RPCs aïllades, sense escriure a Supabase ni al marcador. Informe i captures: `acceptance/automatic-turn/`.

La migració `0013_online_player_identity.sql` afegeix dos codis privats que assignen el rol exclusivament en línia, amb validació al servidor. El client recupera les sessions locals invàlides i mostra el motiu de l’error d’entrada amb un botó per tornar-ho a provar. Les proves amb dos dispositius, les captures i la neteja de QA són a [acceptance/online-identity/](acceptance/online-identity/README.md).

La fusta del tauler utilitza vetes vectorials i una ombra separada, amb la vora inferior nítida. La regla del +1 s’ha verificat amb RPCs reals: un encert avança dues caselles amb una sola pregunta; un error o una resposta desconeguda no avança, passa el torn i indica beure doble. Informes: [acceptance/plus-board/](acceptance/plus-board/README.md).

## Banc anterior de 5.000 preguntes

El banc anterior continua a Supabase: 5.000 files, 4.596 aprovades i 404 DRAFT. Des del 10 d’octubre és `SUPERSEDED` per a partides noves; les anteriors el poden continuar utilitzant. Les 130 originals també conserven els IDs i resultats. El joc tria al servidor una sola pregunta i no descarrega el banc al navegador.

No es repeteix cap `fact_id` dins d’una partida, encara que tingui altres formulacions o aparegui en una altra pila. Les relacions capital–país també es bloquegen en sentit invers. El selector evita els fets de les últimes 10 partides (5 per a les piles creuades), la mateixa resposta consecutiva i un tercer subtema consecutiu. Quan no queda cap fet nou respecte de l’historial recent, escull el menys recent; les exclusions dins de la partida continuen sent obligatòries.

```sh
python3 scripts/validate_question_pack.py data/question-bank/questions_5000.jsonl
python3 scripts/audit_question_bank.py data/question-bank/questions_5000.jsonl
node --test tests/question-bank/importer.test.mjs
python3 tests/question-bank/audit_test.py
```

L’importador utilitzat és `scripts/import_questions_supabase.mjs`. Amb `--emit-sql DIRECTORI_PRIVAT` genera 25 lots de 200 files per executar mitjançant MCP, seguits de la finalització. Sense aquest argument utilitza `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` exclusivament a l’entorn administratiu del procés. Les funcions administratives rebutgen els clients normals. No poseu aquesta clau a `.env.local`, a cap variable `VITE_` ni a Git. La reimportació no crea duplicats i una importació incompleta no activa el banc.

Migracions i verificació: [QUESTION_BANK_IMPORT_REPORT.md](QUESTION_BANK_IMPORT_REPORT.md). Les incidències per fila són a `question_review_issues.csv`; els textos canònics i de revisió estan protegits a `data/question-bank/` i queden fora del desplegament. `.vercelignore` també exclou el ZIP original i les evidències de QA.

## Banc actual de 1.000 preguntes

El 10 d’octubre s’ha substituït el banc de les partides noves amb les 1.000 files de `questions_1000.xlsx`: **913 aprovades i 87 inactives** per errors o ambigüitats. El paquet, JSONL i prompt nous no eren presents; s’ha convertit l’Excel mantenint els textos. Les cinc piles tenen 200 files cadascuna. Els duplicats conceptuals detectats comparteixen una clau global i el servidor impedeix repetir-la dins d’una partida.

Cada partida nova fixa la versió del banc al servidor. Les partides en curs, preguntes antigues, referències, historial i marcador es conserven. Importació inicialment inactiva, validació independent de les 1.000 files i activació atòmica; la reimportació comprovada canvia zero preguntes i zero enllaços històrics.

```sh
python3 scripts/prepare_1000_bank.py questions_1000.xlsx
node --test tests/question-bank/workbook-importer.test.mjs
python3 tests/question-bank/workbook_audit_test.py
node scripts/import_questions_1000.mjs --emit-sql DIRECTORI_PRIVAT
```

El mode SQL genera els passos administratius, sense executar-los. En una reimportació publicada s’omet `stage`. Les migracions `0018`–`0020` estan aplicades al projecte existent. Els bancs crus i l’Excel no formen part del desplegament. Informe, recomptes, backup, revisió, proves i restauració: [QUESTION_BANK_1000_MIGRATION_REPORT.md](QUESTION_BANK_1000_MIGRATION_REPORT.md).

Els avisos de connexió esperen cinc segons de problema continu; una recuperació breu tampoc mostra avís de reconnexió. La carta mòbil ajusta el text a l’espai disponible i conserva els controls accessibles. Les preguntes més llargues dels dos bancs s’han verificat en tres mides mòbils i amb animacions normals a 390×844. `node scripts/verify-automatic-turn.mjs` verifica aquests casos amb transport aïllat, sense escriure al marcador.

L’ajust mòbil cobreix també la resposta, beure, els resultats de +1 i passar de torn. El tauler cedeix espai quan cal, la resposta o penalització conserva una fila pròpia i els botons es mantenen visibles. En pantalles molt petites només es desplaça la pregunta. Amb Vite actiu, `node scripts/verify-mobile-turn-layout.mjs` comprova els textos més llargs, els dos rols en línia, canvis d’alçada i el brindis amb animació. Vegeu `MOBILE_TURN_LAYOUT_REPORT.md` i `acceptance/mobile-turn-layout/`.
