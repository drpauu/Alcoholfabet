# Importació del banc canònic — Alcoholfabet

Estat: **aplicat i verificat** al projecte Supabase `lhgyopkwstuyxolwfucq`. No es repeteix cap pregunta ni cap fet dins d’una partida, tampoc entre piles o variants. El selector i les restriccions de la base de dades ho imposen al servidor.

## Contingut importat

- Fitxer canònic llegit i validat: 5.000 files; SHA-256 `77ec50045385d329676759da468f69804f89dfb7a468fe52462b1e49eb7d21da`.
- APPROVED i actives: **4596**. DRAFT i inactives: **404**.
- IDs de fet originals: 1.529. Claus de selecció semàntica: 1.475, perquè capital–país i país–capital comparteixen la mateixa relació.
- Files totals a `public.questions`: **5.130**. Les **130 originals** es conserven amb el contingut, els IDs i els resultats antics.
- Identificadors `id` i `external_id` textuals; enums existents conservats. Dificultat ampliada d’1–3 a 1–7, sense rebaixar cap valor del paquet.

| Pila | Importades | Actives | DRAFT |
|---|---:|---:|---:|
| PAU | 1300 | 1279 | 21 |
| TECLA | 1300 | 1079 | 221 |
| TECLA_PAU | 750 | 739 | 11 |
| PAU_TECLA | 750 | 611 | 139 |
| TP | 900 | 888 | 12 |

| Tema | Importades | Actives | DRAFT |
|---|---:|---:|---:|
| Informàtica UPC | 1150 | 1137 | 13 |
| Geografia | 858 | 843 | 15 |
| Geografia i geopolítica | 42 | 42 | 0 |
| Ciència | 500 | 488 | 12 |
| Enginyeria Biomèdica UB | 1150 | 1117 | 33 |
| Sitges | 600 | 276 | 324 |
| Música | 300 | 297 | 3 |
| Atletisme | 100 | 100 | 0 |
| Cultura general | 300 | 296 | 4 |

## Auditoria i conservació

S’ha executat el validador del paquet amb `python3 scripts/validate_question_pack.py data/question-bank/questions_5000.jsonl`: recompte, distribució, IDs, textos únics per pila, respostes d’1–5 paraules i metadades correctes. La segona auditoria automàtica recorre totes les files i propaga les incidències a totes les variants d’un fet. No s’han substituït preguntes ni respostes per contingut nou.

Les 404 files pendents consten a [question_review_issues.csv](question_review_issues.csv), amb ID, fet, pila, motiu i font. Inclouen ambigüitats, monedes antigues, prefix telefònic, terminologia i verificació factual pendent. Les 324 formulacions de fets detallats de Sitges que no s’han pogut contrastar amb les pàgines oficials queden inactives: les pàgines han retornat 403/503/timeouts. La font general del seguici i Ball de Bastons sí que s’han contrastat. Fonts, abast i limitacions de la revisió: [REVIEW.md](data/question-bank/REVIEW.md). No s’afirma una certificació humana exhaustiva dels 1.529 fets.

La còpia privada prèvia del banc i del repositori és a `/home/pau/.local/share/tecla-pau/backups/question-bank-20261009/`, amb permisos restringits. S’han comparat els camps originals de les 130 preguntes amb l’exportació anterior: contingut original intacte. Les columnes noves enllacen 21 preguntes històriques amb conceptes canònics revisats; els registres d’ús antics conserven les seves instantànies.

## Migracions aplicades

| Fitxer local | Versió Supabase | Canvi |
|---|---|---|
| `0014_question_bank_and_fact_selection.sql` | `20261009184958` | Metadades, escala 1–7, índexs, unicitat per fet, instantànies d’ús, importació administrativa i selector. |
| `0015_question_usage_privacy_and_legacy_history.sql` | `20261009185526` | Historial descriptiu exclusiu del servidor i enllaços semàntics del banc anterior. |
| `0016_question_usage_default_deny.sql` | `20261009185624` | Retirada de la política de lectura antiga i de tots els permisos de client sobre ús. |
| `0017_question_selection_query_bounds.sql` | `20261009190029` | Consulta limitada a l’ús de la partida actual abans de filtrar candidats. |

No s’ha creat una segona taula de preguntes. `private.question_bank_imports` només registra la publicació del banc i no és llegible pels clients. `questions` i `game_question_usage` mantenen RLS i denegació de lectura directa. Es conserven `get_game_view`, el motor d’accions, el resultat únic per partida i els canals Realtime privats.

## Importador i repeticions

S’ha utilitzat [import_questions_supabase.mjs](scripts/import_questions_supabase.mjs) amb `--emit-sql /home/pau/.local/share/tecla-pau/question-bank-import-20261009`, i s’han executat els seus 25 lots de 200 files mitjançant MCP. Cada lot fa upsert administratiu sobre els IDs existents. Una finalització independent comprova el recompte exacte i les cinc piles abans d’activar la versió `canonical-5000-20261009-v1`. Una importació parcial continua en IMPORTING i el joc conserva el banc actiu anterior.

S’han reexecutat els 25 lots complets: 5.000 files rebudes, **0 files modificades i 0 duplicats**. La data, la versió, el checksum, els 50 lots i els recomptes queden registrats al servidor. [Evidència per lot](acceptance/question-bank/IMPORT_BATCH_REPORT.json).

El selector aplica, per aquest ordre pràctic, aprovació i activitat, pila correcta, exclusió de l’ID i del fet dins de la partida, clau semàntica addicional, resposta anterior i dos subtemes anteriors. Evita els fets de les últimes **10 partides** per a PAU, TECLA i TP, i **5** per a les piles creuades. L’historial és del mateix context de jugadors, inclou partides abandonades amb preguntes vistes i considera també els fets que havien aparegut en una altra pila.

Quan no queda cap candidat fora de la finestra recent, el fallback escull el fet amb l’última aparició més antiga. **Mai afluixa les exclusions de la partida actual, de resposta consecutiva o de tercer subtema consecutiu.** Si aquests criteris esgoten una pila, retorna `QUESTION_POOL_EMPTY`; no repeteix una pregunta per continuar. Aquesta és una garantia dins de cada partida, no una promesa d’absència de repeticions per sempre amb un banc finit.

## Rendiment

150 seleccions consecutives reals, consumint una pregunta per torn en les cinc piles: mitjana **14.35 ms**, p95 **28.79 ms**, màxim **36.78 ms** al servidor. La mesura exclou xarxa, Realtime i animació.
El pla final de candidats ha executat la consulta en **7,395 ms** amb 4,779 ms de planificació. Utilitza l’índex de pila/activitat/revisió/versió, l’índex d’ordre de torn i els índexs d’historial i membres d’ús. La materialització de l’ús actual evita llegir tot l’historial global. Es sorteja entre fets elegibles i després entre les seves formulacions; no hi ha `ORDER BY random()` sobre les 5.000 preguntes. [Pla real](acceptance/question-bank/QUERY_PLAN.json).

## Proves executades

- `npm run check`: TypeScript, **34 proves unitàries** i build correctes. També passen **6 proves Node** de l’importador i **4 proves Python** de l’auditoria.
- [question-bank.sql](tests/backend/question-bank.sql): **11 grups** de comprovacions a PostgreSQL real, amb 150 seleccions, unicitat per fet i per relació inversa, finestres exactes de 10/5, fallback menys recent, esgotament dur, resposta consecutiva, tercer subtema, DRAFT, RLS i conceptes històrics. Totes les fixtures es reverteixen.
- `tests/backend/plus-one.sql`, `duration.sql` i `security.sql`: regressions reals correctes de +1, beure doble, T&P, durada, partida de 50 caselles fins a Meta, puntuació idempotent, permisos i canals privats.
- `tests/e2e/game.spec.ts` (presencial i online amb dos contexts): **2 partides completes**, aproximadament 3,6 minuts de prova. Cadascuna arriba a Meta amb **30 preguntes, 30 fets i 30 claus semàntiques diferents**, les cinc piles i **un únic resultat**. Es comproven error, +1, T&P concurrent, reload i desconnexió/reconnexió.
- [verify-question-bank.mjs](scripts/verify-question-bank.mjs), també després de l’última migració: les **cinc piles** amb dos contexts reals, pregunta i resposta omesa al respondent, resposta al jutge, DOM segur, refresc i recàrrega sense nova pregunta, T&P amb una sola reclamació, denegació del banc, dels identificadors d’ús i de l’importador als dos jugadors. No hi ha prefetch del banc.
- Captures inicials i finals a **390×844, 1024×768 i 1440×900**, revisades visualment: tauler i carta llegibles, sense desbordament ni resposta al respondent.
- Bundle final idèntic al frontend anterior (`index-C1pFU578.js`, 606.567 bytes): no incorpora banc, selector administratiu ni fotografies privades. El banc original, el banc revisat i el ZIP no són servits per Vite i queden fora dels assets de desplegament.

Evidències: [backend](acceptance/question-bank/BANK_SERVER_REPORT.json), [partides completes](acceptance/question-bank/COMPLETE_GAMES_REPORT.json), [cinc piles i navegador](acceptance/question-bank/BANK_BROWSER_REPORT.json), [build](acceptance/question-bank/BUILD_REPORT.json).

## Neteja i operacions pendents

S’han eliminat exclusivament **8 usuaris anònims QA**, **4 partides QA** i **2 resultats QA** identificats als manifests. No queda cap fixture persistent. Les comprovacions transaccionals confirmen intactes totes les altres files: 19 usuaris, 30 partides, 6 resultats i totes les 5.130 preguntes, incloent activitat real creada durant la prova. [Neteja verificada](acceptance/question-bank/QA_CLEANUP_REPORT.json).

No queda cap operació manual d’importació o migració: el banc actiu ja és al Supabase existent i les apps connectades el fan servir mitjançant la mateixa RPC. Queda la revisió editorial/factual de les **404 files DRAFT**, especialment els detalls de Sitges amb font inaccessible. Continuen fora de selecció. No s’ha fet cap desplegament nou de Vercel en aquesta tasca; el JavaScript del joc no ha canviat. Els canvis del repositori i l’exclusió dels fitxers privats queden preparats per al pròxim desplegament.
