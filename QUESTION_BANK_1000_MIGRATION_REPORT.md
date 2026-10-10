# Migració del banc de preguntes — 10 d’octubre de 2026

La substitució està **aplicada i verificada a Supabase `lhgyopkwstuyxolwfucq`**. El manifest actiu és `excel-1000-20261010-v1`, activat a les **08:44:28 UTC**. Les partides noves utilitzen aquest banc; les anteriors mantenen la versió disponible abans de la migració.

## Font i revisió

No s’ha trobat `_question_bank/tecla_pau_1000_questions_pack`, el JSONL indicat ni el seu `PROMPT_CODEX_SOL_HIGH_EFFORT.md`. Després de comunicar-ho i rebre «bé, mira i verifica que tot surti correctament», s’ha utilitzat l’única font nova disponible: **`questions_1000.xlsx`**. S’han llegit les instruccions, el resum i totes les 1.000 files. No s’afirma haver llegit el prompt absent.

El [JSONL convertit](data/question-bank-1000/questions_1000.jsonl) conserva els 13 camps originals. El [JSONL revisat](data/question-bank-1000/reviewed_1000.jsonl) manté les preguntes, respostes, dificultats i IDs, conserva `original_fact_id` i afegeix metadades de selecció i revisió. No s’ha corregit silenciosament cap text original.

| Pila | Importades | Actives | DRAFT inactives | Fets actius de la pila |
| --- | ---: | ---: | ---: | ---: |
| PAU | 200 | 191 | 9 | 188 |
| TECLA | 200 | 175 | 25 | 169 |
| TECLA_PAU | 200 | 185 | 15 | 184 |
| PAU_TECLA | 200 | 178 | 22 | 170 |
| TP | 200 | 184 | 16 | 180 |
| **Total** | **1.000** | **913** | **87** | **710 globals** |

Els fets globals poden aparèixer en diverses piles i no són la suma de l’última columna. Les 1.000 files representen 770 conceptes, amb **186 grups de duplicats conceptuals detectats**. No hi ha textos normalitzats exactament duplicats ni IDs duplicats. Les respostes tenen 1–5 paraules i la dificultat és d’1–7.

Les 87 incidències són: 68 ambigüitats, 7 errors factuals, 2 fets pendents de contrast, 1 error de llengua, 3 fonts pendents, 2 problemes de terminologia i 4 d’edició. S’han apartat, entre altres, `throw` com a declaració d’excepció, variància/mitjana com a coeficient de variació, noms de gegants sense distingir la parella i Conan Doyle descrit com a anglès. El detall per fila és a [review_issues.csv](data/question-bank-1000/review_issues.csv).

La revisió ha contrastat els punts dubtosos amb fonts primàries quan ha estat possible. Els `source_hint` de l’Excel són sovint referències generals a cursos; això no certifica cada afirmació. `source_verified` és `false` a totes les files. Fonts i límits: [REVIEW.md](data/question-bank-1000/REVIEW.md) i [AUDIT.json](data/question-bank-1000/AUDIT.json).

## Backup i preservació

Abans dels canvis s’han exportat **les 5.130 preguntes anteriors completes**, manifests, partides, usos, resultats i definicions de les funcions substituïdes. També s’han copiat l’Excel i el repositori anterior. Backup privat fora de Git i del desplegament:

`/home/pau/.local/share/tecla-pau/backups/question-bank-1000-20261010/`

La carpeta té permisos `0700`; els fitxers, `0600`. `BACKUP_MANIFEST.json` registra mides i hashes:

- `questions-before.jsonl`: 5.130 files; SHA-256 `a0c69bc4c0014170458efd65f92b0f93ecf9653aa1069691cc9add6b0c765a79`.
- `metadata-before.json`: SHA-256 `4a9d41127495489d872ec9eb6f637eb8fbe593aea3311697f80b669dd0d660a0`.
- MD5 de totes les files antigues ordenades: **`6ede4b638e7324d0e433f2a3539a4f88`**, idèntic abans i després.

El manifest de 5.000 passa a `SUPERSEDED`. Les seves files mantenen els flags originals perquè encara serveixen les partides anteriors. Ni les 5.000 preguntes ni les 130 inicials s’han eliminat o reescrit. Cap ús històric o resultat s’ha eliminat.

L’activació s’ha executat amb una instantània coherent: els hashes de partides, usos i resultats són idèntics abans i després dins de la transacció. Durant el treball hi ha hagut activitat legítima de l’usuari; no s’ha restaurat una instantània antiga sobre les seves accions.

La verificació final confirma **6.130 preguntes totals**, zero referències orfes, 37 partides anteriors i dues encara actives amb el banc anterior. El marcador públic conserva **0–0 i zero partides comptades**; el privat històric, 1–1 i dos resultats. Són recomptes observats, no valors imposats per aquesta migració.

## Canvis realment aplicats al servidor

Les migracions locals `0018`–`0020` s’han aplicat per MCP i consten al registre remot:

- `versioned_question_bank_manifests`: recompte i piles configurables; `games.question_bank_version`; trigger que fixa la versió de les partides noves al servidor; selector per versió; taules privades de validació i equivalències.
- `question_bank_validation_rpc`: comparació independent del contingut persistit amb cada fila revisada. La finalització exigeix una prova vigent per a les 1.000 files.
- `question_bank_historical_concepts_rpc`: equivalències històriques idempotents i immutables, sense reescriure les preguntes o els snapshots.

Totes les RPCs administratives són exclusives de `service_role`. No s’han modificat les RPCs de joc, la regla +1, T&P, la finalització, el marcador o els permisos Realtime. El client continua recuperant una vista segura d’una sola pregunta.

El selector conserva les exclusions obligatòries de pregunta, fet i concepte dins d’una partida, també entre piles i en formulacions inverses. Manté l’exclusió de resposta consecutiva i del tercer subtema consecutiu. Conserva les finestres de 10 partides per a personals/TP i 5 per a creuades; quan només s’esgota l’historial recent pot recuperar el fet menys recent, però mai un fet de la partida actual.

142 conceptes reutilitzen directament claus del banc de 5.000. A més, s’han importat **77 equivalències privades**: 63 IDs del banc inicial i 14 del banc anterior. El selector comprova el snapshot original i la clau resolta, sense reescriure l’historial.

## Importació, validació i idempotència

| Artefacte | SHA-256 registrat |
| --- | --- |
| Excel | `9125ef40fd6ec8e0119d6fa46c6ce7b9a44d3755fbc681fe0e3f0bb3946aad1f` |
| JSONL convertit | `6737bce803a5a9c38b091e75e859948ffe18aa4eacae53dca789dab418ea5fe8` |
| JSONL revisat | `f8981735291bd5a792b340e7877819a365202af01598b613a0fe0010cc1cf41f` |

S’ha registrat el manifest de 1.000 files i cinc piles de 200; s’han carregat cinc lots inactius de 200, mantenint l’anterior actiu. Després s’han aplicat les decisions de revisió i s’ha validat independentment tot el contingut persistit. L’activació atòmica s’ha fet després de les proves locals i remotes.

La reimportació completa ha canviat **zero preguntes**, la revalidació **zero proves** i les 77 equivalències **zero enllaços**. La finalització repetida retorna els mateixos recomptes. Les respostes publicades modificades, els enllaços reescrits i els manifests incompatibles són rebutjats.

Reproducció administrativa amb les migracions aplicades:

```sh
python3 scripts/prepare_1000_bank.py questions_1000.xlsx
node scripts/import_questions_1000.mjs --emit-sql DIRECTORI_PRIVAT
```

Ordre en un banc `IMPORTING`: `prepare.sql`, cinc lots `stage`, cinc `review`, cinc `validate`, `historical-links.sql` i `finalize.sql`. En una reimportació publicada s’omet `stage`; l’activació continua sent l’últim pas. Sense `--emit-sql`, l’importador executa el procés amb `SUPABASE_URL` i `SUPABASE_SERVICE_ROLE_KEY` només a l’entorn administratiu, mai en variables `VITE_` o a Git.

`restore-bank.sql`, al backup, torna a publicar el manifest anterior amb la funció de finalització. No elimina el nou banc ni canvia les versions de partides existents. S’ha provat dins d’una transacció desfeta; el nou banc continua actiu després de la prova.

## Verificació executada

| Comprovació | Resultat |
| --- | --- |
| TypeScript, 34 proves Vitest i build de producció | PASS |
| Importador nou: 8 proves; conversió/revisió Excel: 4 | PASS |
| Compatibilitat del banc anterior: 6 proves Node i 4 Python | PASS |
| PostgreSQL local PGlite: 12 grups | PASS |
| PostgreSQL real: 13 grups de selecció, versions, històric i esgotament | PASS abans i després d’activar |
| Selecció real: 150 preguntes abans i 150 després, en les cinc piles | Cap fet repetit; p95 posterior 6,325 ms |
| RPCs reals +1, META, idempotència i doble beguda | PASS |
| Durades, partida de 50 caselles amb 87 torns, esgotament atòmic | PASS |
| Accés públic, identitats online, resposta segura, RLS i ACL Realtime | PASS |
| Administració real: cinc grups d’idempotència i rebuig de canvis | PASS |
| Rollback de publicació sense deixar-lo aplicat | PASS |
| App real al navegador amb transport aïllat: 8 casos | PASS |
| Banc/Excel al servidor de desenvolupament i bundle | HTTP 403; cap ID o text del banc al bundle |

Les fixtures remotes es desfan; no han quedat usuaris, partides QA o resultats ni s’han creat sessions Auth en les proves SQL. PGlite utilitza una fixture del banc anterior; la preservació de totes les 5.130 files es comprova al servidor real. Els tests de navegador executen App, repositori, canal i motion reals amb transport RPC/Realtime aïllat; no són una nova prova E2E amb sessions Supabase reals.

Evidència: [REMOTE_POSTGRES_REPORT.json](acceptance/question-bank-1000/REMOTE_POSTGRES_REPORT.json), [IMPORT_OPERATIONS.json](acceptance/question-bank-1000/IMPORT_OPERATIONS.json), [LOCAL_POSTGRES_REPORT.json](acceptance/question-bank-1000/LOCAL_POSTGRES_REPORT.json) i [CLIENT_BANK_PRIVACY_REPORT.json](acceptance/question-bank-1000/CLIENT_BANK_PRIVACY_REPORT.json).

Els advisors s’han consultat després dels canvis. RLS sense polítiques a les taules de banc i privades és deliberat: denega l’accés dels clients. Les RPCs de joc `SECURITY DEFINER` i Anonymous Auth formen part de l’arquitectura existent, amb autorització comprovada. Les RPCs administratives noves no apareixen com a accessibles pels clients. La resta d’avisos es conserva a [ADVISORS.json](acceptance/question-bank-1000/ADVISORS.json); no s’han canviat permisos fora d’abast. El build conserva l’avís de mida del chunk principal. La caducitat temporal de la sessió MCP s’ha resolt després de reconnectar i s’han completat les comprovacions pendents.

## Connexió i llegibilitat mòbil

Els avisos de connexió esperen cinc segons continus. Una recuperació anterior no mostra tampoc l’avís de reconnexió. Les accions continuen bloquejades immediatament sense connexió; els errors de validació aliens a la xarxa es mostren sense espera.

La carta permet ajustar el text a l’espai disponible sense expulsar els controls. La mida es redueix només quan cal al mòbil, amb mínim de 20 px i desplaçament intern de reserva. S’han comprovat les preguntes aprovades més llargues dels dos bancs abans/després de revelar la resposta: 360×800, 390×844 i 430×932, més 390×844 amb animacions normals. Les **16 combinacions** mostren tot el text sense desplaçament i controls accessibles. També es conserven les comprovacions generals de 390×844, 1024×768 i 1440×900. [Informe i captures del navegador](acceptance/automatic-turn/BROWSER_REPORT.json).

El paisatge, el tauler, les peces, els assets i les regles es conserven. Aquests dos ajustos són els únics canvis de presentació d’aquesta migració. La base de dades ja està actualitzada; el frontend necessita publicar el commit corresponent a Vercel.
