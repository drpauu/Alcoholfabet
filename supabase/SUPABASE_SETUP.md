# Supabase — Tecla&Pau

Projecte verificat: `lhgyopkwstuyxolwfucq`, `https://lhgyopkwstuyxolwfucq.supabase.co`.

El 9 d'octubre de 2026 s'han aplicat les migracions `0001`–`0009` mitjançant el MCP de Supabase. L'esquema inicial del projecte era buit. Hi ha 130 preguntes aprovades, 26 per pila. S'ha desplegat `verify-couple-access`, versió 1, en estat ACTIVE.

Durant la verificació del redisseny integral s'ha aplicat també `0010_game_view_boolean_answer_capability.sql` amb el MCP. Quan s'abandona una partida online durant una pregunta, el respondent queda buit i una comparació SQL podia retornar NULL. `canSeeAnswer` ara retorna sempre un booleà (`coalesce(..., false)`), de manera que el client pot recuperar la partida abandonada. La selecció de resposta i els permisos de la funció es conserven.

## Autenticació i configuració externa

Anonymous Sign-Ins s'ha activat al Dashboard el 9 d'octubre de 2026. S'ha verificat `external.anonymous_users=true` i una alta anònima real amb `is_anonymous=true` i sessió vàlida. L'app fa servir `signInAnonymously()`. No hi ha cap codi de demostració.

Com a reforç opcional, pots desactivar **Realtime → Settings → Allow public access** al Dashboard. Els canals de l'app són sempre privats i la denegació d'accés d'un no membre s'ha provat amb un WebSocket real. La configuració global d'accés públic no es pot consultar ni editar amb el MCP disponible.

## Configuració del client

Copia `.env.example` a `.env.local` i configura `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY`. La publishable key és la clau pública del projecte, mai una service role key. No incloguis el codi privat, el seu hash ni contrasenyes a variables `VITE_*`.

El codi inicial s'ha generat criptogràficament i desat en `/home/pau/.config/tecla-pau/access-code.txt`, amb permisos `0600`. No es publica ni apareix als informes. El hash SHA-256 està a `private.couple_access_config`; l'esquema `private` no és exposat a la Data API i no concedeix permisos als clients.

Per preparar o rotar el codi en un altre entorn:

```sh
python3 scripts/backend-access-code.py
# Usa --rotate només si vols invalidar el codi anterior.
```

Executa el fitxer SQL protegit `~/.config/tecla-pau/set-access-code.sql` amb el rol de propietari de la base de dades. La rotació del codi no revoca els dispositius ja autoritzats; revoca'ls expressament si cal.

## Edge Function

`verify-couple-access` valida el bearer token contra Supabase Auth i delega la verificació del codi a `authorize_private_code`. Només utilitza els secrets de plataforma automàtics `SUPABASE_URL` i `SUPABASE_ANON_KEY`. No necessita service role key, cap contrasenya ni un secret manual amb el codi.

La verificació limita cada sessió a deu intents fallits en quinze minuts. Anonymous Auth té també el seu propi límit d'alta per IP, que cal mantenir actiu. Les respostes incorrectes són genèriques i no registren el codi ni el token.

CORS accepta els entorns locals 5173 i 4173. Per a producció, configura `ALLOWED_ORIGINS` amb els orígens exactes separats per comes i torna a desplegar la funció.

```sh
supabase link --project-ref lhgyopkwstuyxolwfucq
supabase db push
supabase functions deploy verify-couple-access --no-verify-jwt
```

`verify_jwt=false` al gateway és compatible amb les claus de signatura actuals: el handler verifica el token de cada petició amb l'endpoint Auth abans d'invocar la RPC. Les peticions sense un token vàlid reben 401.

## RPCs i contracte

- `get_access_context()` recupera autorització, parella, marcador i última partida incompleta del dispositiu.
- `get_game_view(p_game_id)` retorna una vista per sessió i rol. La clau `answerCa` s'omet completament al respondent online i a tots dos mentre T&P està oberta.
- `create_game(p_mode,p_target_minutes,p_starting_player,p_creator_role,p_idempotency_key)` genera i persisteix el recorregut. `p_starting_player=NULL` tria el primer jugador al servidor.
- `join_game_by_code(p_invite_code,p_role,p_idempotency_key)` accepta el codi normalitzat i rebutja rols ocupats o un dispositiu que ja és membre.
- `start_game(p_game_id,p_expected_state_version,p_idempotency_key)` exigeix els dos rols en una partida online.
- `apply_game_action(p_game_id,p_action,p_expected_state_version,p_idempotency_key,p_payload)` accepta BEGIN_TURN, REVEAL_ANSWER, CLAIM_TP, JUDGE_CORRECT, JUDGE_INCORRECT, NEXT_TURN i ABANDON_GAME.
- `scoreboard(p_couple_id)` consulta exclusivament `match_results`.
- `authorize_private_code(p_code)` comprova el hash privat i autoritza la sessió; l'Edge Function és el punt d'entrada de la UI.

Els errors RPC són codis estables en majúscules dins de l'error PostgREST. Els serveis frontend els tradueixen al català. Les accions bloquegen la partida i comproven dispositiu, rol, fase, versió i idempotència. La clau idempotent queda vinculada al mateix actor, partida, tipus d'acció i payload. Els helpers interns no són executables per `anon` ni `authenticated`.

T&P conserva la casella de la pregunta disputada i el seu modificador. El reclamant avança des de la seva pròpia posició. L'alternança continua des del torn original. `+1` només s'aplica una vegada. Arribar a META finalitza i insereix el resultat dins de la mateixa transacció; `game_id` és UNIQUE. Abandonar o perdre la connexió no suma.

## Realtime

Canal `game:<uuid>`, sempre `config.private=true`. Els membres autoritzats poden rebre Broadcast/Presence i publicar Presence. Només el servidor publica els avisos de joc. El Broadcast conté únicament identificador de partida, versió i tipus d'esdeveniment; Supabase pot afegir un identificador de missatge. El client torna a consultar `get_game_view`.

En reconnexió, renova l'Auth de Realtime, torna a subscriure's, publica Presence i recupera la vista. Les autoritzacions Realtime es comproven en unir-se i renovar JWT; una revocació bloqueja immediatament les RPCs i els SELECT. Les sessions Realtime ja obertes no recalculen els permisos fins a renovació o reconnexió, comportament de la plataforma.

## Proves executades

```sh
python3 validation/validate_questions.py
python3 scripts/backend-qa-fixtures.py
python3 scripts/backend-integration.py
node scripts/backend-realtime.mjs
```

El preparador crea tres sessions anònimes reals i autoritza només els dos jugadors a través de l'Edge Function. Llegeix el codi privat del fitxer protegit, sense imprimir-lo. Necessita `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY` a l'entorn o el fitxer QA privat ja creat. No l'executis mentre uns E2E de navegador comparteixen aquestes fixtures.

Les suites llegeixen fixtures temporals protegides fora del repositori: `TECLA_PAU_QA_ENV` i `TECLA_PAU_QA_USERS`, amb valors per defecte a `/tmp/tecla-pau-qa-*.json`. La primera execució va utilitzar tres sessions Auth reals amb contrasenyes aleatòries abans d'activar Anonymous Auth; la UI del producte no ofereix aquest accés. La verificació final s'ha repetit amb tres sessions anònimes reals: onze comprovacions REST i sis Realtime, totes superades. No s'han substituït les RPCs ni el RLS.

`tests/backend/security.sql` s'ha executat contra el projecte real; totes les fixtures i els Broadcast es desfan amb ROLLBACK. Comprova revocació, límit d'intents, parser de topic i permisos privats de Broadcast/Presence i l'error estable d'una pila de preguntes esgotada sense modificar la partida.

Informes de la primera implementació: `acceptance/backend-integration-report.json`, `acceptance/backend-realtime-report.json` i `acceptance/backend-security-report.json`. Les seves fixtures, incloent partides, resultats i usuaris anònims temporals, es van eliminar després de verificar-les. Aquella neteja va eliminar 39 partides QA, 24 usuaris temporals i 6 resultats; el marcador històric resultant era 0–0. Vegeu `acceptance/QA_CLEANUP_REPORT.json`. Aquest valor no representa les partides jugades posteriorment per l’usuari.

El redisseny integral posterior té vuit E2E reals, la regressió d’abandonament de la migració 0010 i manifests de QA independents a [acceptance/art-redesign/](../acceptance/art-redesign/README.md). La neteja d’aquest encàrrec ha eliminat només 17 usuaris, 22 partides i 8 resultats QA. Conserva exactament les 10 partides, 6 usuaris i 2 resultats no llistats, inclosos els creats mentre es feia la revisió. El marcador al punt de neteja és 1–1; no s’ha reinicialitzat. Vegeu [QA_CLEANUP_REPORT.json](../acceptance/art-redesign/QA_CLEANUP_REPORT.json) i l’auditoria del redisseny.
