# Auditoria final — Tecla&Pau

9 d’octubre de 2026. Aplicació executada amb Chromium real, frontend de desenvolupament i build de producció, contra el projecte Supabase `lhgyopkwstuyxolwfucq`.

## Resultat funcional verificat

Modes presencial i en línia jugables fins a Meta. Entrada privada amb Auth anònima, durada i primer jugador, sala amb rols fixos i Presence, pregunta oral, revelació presencial, validació del jutge online, encert/error, T&P concurrent, bonificació +1, recàrrega, desconnexió/reconnexió, abandonament i tornar a jugar. La vista del respondent no conté la clau `answerCa` ni resposta al DOM. El marcador compta únicament resultats formals únics.

El repositori inicial no tenia app executable ni package.json: s’han conservat els assets i documents aprovats, reforçat les peces de domini i construït React/TypeScript. La còpia inicial íntegra està fora del projecte, amb permisos 600, a `/home/pau/Documents/tecla-pau-app-before-implementation.tar.gz`. El laboratori original es va executar i capturar abans dels canvis.

## Proves executades

| Verificació | Resultat | Evidència |
|---|---|---|
| TypeScript estricte | PASS | `npm run typecheck` |
| Unitàries | 18/18 PASS | `npm test`, quatre fitxers a tests/unit |
| Build producció | PASS | `npm run build`, dist |
| E2E complets | 7/7 PASS, cap skip ni flaky | `acceptance/FINAL_E2E_REPORT.json`, 3m42s |
| Integració REST real | 11/11 PASS | `acceptance/backend-integration-report.json` |
| Realtime real | 6/6 PASS | `acceptance/backend-realtime-report.json` |
| Seguretat SQL | PASS | `acceptance/backend-security-report.json`, transaccions amb ROLLBACK |
| Preguntes | 130; 26 per pool; revisades i aprovades | `python3 validation/validate_questions.py` |
| Build al navegador | PASS, zero errors JavaScript | `acceptance/PRODUCTION_SMOKE.json` |
| Visual i responsive | 34 captures reals; zero errors/overflow | `acceptance/VISUAL_QA.md` i screenshots/real-* |
| Motion normal | Trajectòria, flip, +1 i ordre de victòria PASS | JSON, vídeo i `acceptance/MOTION_AUDIT.md` |
| Secrets/build | Cap pregunta original, foto privada, codi d’accés ni clau secreta | `acceptance/build-security-audit.json` |

La suite final usa contexts independents amb sessions anònimes noves. No simula Supabase, les RPCs, RLS ni els canals. Les primeres execucions de backend van usar sessions QA amb contrasenya mentre Anonymous Auth estava desactivat; les proves finals REST/Realtime es van repetir amb Auth anònima després que l’usuari activés l’opció.

## Backend aplicat

Nou migracions, 0001–0009, aplicades amb MCP al projecte indicat. RLS a les taules exposades; helpers interns revocats al client; hash del codi a l’esquema private. Edge Function `verify-couple-access` desplegada i verificada.

RPCs: `get_access_context`, `get_game_view`, `create_game`, `join_game_by_code`, `start_game`, `apply_game_action`, `scoreboard`, `authorize_private_code`. Totes les mutacions de joc es resolen transaccionalment al servidor, amb versió i clau idempotent vinculada a actor i intenció. `match_results.game_id` és únic. Broadcast privat només notifica; el client recupera una vista segura. Detall i passos de desplegament a `SUPABASE_SETUP.md`.

## Correccions trobades durant les proves

- Generador inicial podia crear tres categories seguides; ara ho impedeix.
- La fase de servidor `MOVING` no activava motion d’encert: produïa teletransport. Corregit i cobert per regressió i navegador normal.
- Errors PostgREST arribaven com a objectes; normalitzats a Error per tractar versió antiga i revocació.
- `CLOSED` del canal substituït podia programar una nova reconnexió; ara callbacks i timers respecten generació. Connexió estable comprovada cinc segons després de reconnectar.
- Respostes tardanes, sortida d’Auth i invitacions en dispositius ja autoritzats queden tractades.
- El servidor Vite també bloqueja dades de preguntes, fitxers d’entorn, SQL i fotografies de referència privades.

## Límits reals

La matriu conté 87 PASS i 1 PARTIAL. `Q006` no s’acredita com a 60 FPS constants: sense vídeo, mediana 60,24 FPS, mitjana 44,66 FPS i p95 dels intervals de 39,8 ms. La gravació afegeix cost i empitjora les xifres; s’inclouen totes les mesures, sense imputar-les a un telèfon físic. La trajectòria i la coreografia estan comprovades, però queda pendent mesurar el rendiment en els dispositius físics de la parella.

Les proves de responsive cobreixen 360×800, 390×844, 430×932, 768×1024, 1024×768, 1366×768, 1440×900 i mòbil horitzontal 844×390. Safe areas: CSS env() i reserva mínima verificats en simulació; no s’ha provat un notch físic ni Safari/iOS físic.

L’app s’ha executat localment; no s’ha publicat cap frontend a un domini públic. Per usar-la des de dispositius remots, cal servir dist amb HTTPS i configurar l’origen permès de l’Edge Function segons SUPABASE_SETUP. El projecte backend sí que està desplegat i operatiu.

## Dades de QA i accés

La neteja final ha eliminat 39 partides QA, 24 usuaris temporals i 6 resultats, només pels UUID identificats als manifests i amb comprovació de jocs fora del manifest. Marcador verificat 0–0 i cap usuari, dispositiu, sessió o partida QA restant. La parella, les 130 preguntes i el hash privat s’han preservat. Evidència a `acceptance/QA_CLEANUP_REPORT.json`.

`.env.local` està configurat localment i ignorat. El codi privat inicial queda només a `/home/pau/.config/tecla-pau/access-code.txt`, amb permisos 600; no apareix en aquest informe ni al build. Les fotografies originals es mantenen fora de public i dist.
