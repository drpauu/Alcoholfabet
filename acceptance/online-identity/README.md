# Identitat en línia i recuperació d’entrada

Revisió del 9 d’octubre de 2026. El menú i les partides presencials continuen sent públics. Només en línia, un dels dos codis identifica en Pau o la Tecla. El servidor valida el rol en crear i en unir-se a la sala; el client no pot substituir-lo. La identitat es conserva en recarregar.

S’ha comprovat l’entrada amb una sessió anònima nova. El bloqueig original no s’ha reproduït en aquesta sessió; s’ha afegit i verificat la recuperació d’una sessió local rebutjada per Auth. Els errors d’inici mostren el motiu disponible i un botó per tornar-ho a provar.

## Proves executades

- `npm run check`: TypeScript, 34 proves unitàries i build correctes. `npm run build` s’ha repetit després de l’ajust final que evita duplicar el missatge d’error d’entrada.
- [E2E_REPORT.json](E2E_REPORT.json): cinc comprovacions en Chromium contra l’App real servida amb Vite, Supabase i Realtime privat. Inclou identificació, codi incorrecte, rol falsificat, dos dispositius, resposta privada, recàrrega, abandonament, mode presencial sense codi i recuperació d’una sessió invàlida. Zero errors JavaScript registrats.
- [SERVER_REPORT.json](SERVER_REPORT.json): `tests/backend/online-identity.sql`, amb quatre grups de comprovacions de permisos, assignació de rol, intents i marcador. Fixtures i canvis temporals de codis desfets dins de la transacció.
- [PUBLIC_ACCESS_REPORT.json](PUBLIC_ACCESS_REPORT.json): `tests/backend/public-access.sql`, amb quatre grups de regressió d’entrada pública, aïllament de partides, resposta privada, RLS i Realtime. Dades existents preservades.
- [BUILD_SECURITY_REPORT.json](BUILD_SECURITY_REPORT.json): cap valor dels dos codis ni dels seus hashes al repositori; cap clau secreta de Supabase ni JWT de service role a `public/` o `dist/`. El marcador literal de prefix que conté l’SDK s’ha revisat separadament.
- Nou captures: entrada amb camp de codi buit, jugador identificat i partida restaurada, cadascuna en 390×844, 1024×768 i 1440×900. Les geometries no presenten desbordament. La revisió visual representativa dels tres formats confirma paper llegible, controls sencers i cap credencial visible.

La col·lecció de les 14 proves Playwright existents s’ha validat; no es declara una nova execució completa d’aquella suite. Aquesta revisió executa les cinc comprovacions dedicades descrites més amunt. El build conserva l’avís existent de mida de bundle superior a 500 kB.

## Backend i neteja

La migració [0013_online_player_identity.sql](../../supabase/migrations/0013_online_player_identity.sql) s’ha aplicat amb MCP al projecte `lhgyopkwstuyxolwfucq`, versió remota `20261009161414`. Els dos codis s’han configurat com a hashes en taules privades amb RLS i sense permisos de client. Els valors només romanen al fitxer local protegit fora del repositori. Les traces i els vídeos d’aquesta prova estan desactivats.

[QA_CLEANUP_REPORT.json](QA_CLEANUP_REPORT.json) verifica que s’han eliminat exclusivament els sis usuaris anònims i les dues partides QA abandonades registrats al manifest. No queden fixtures d’aquesta revisió. Els codis privats i les dades no llistades s’han preservat; el marcador no s’ha reinicialitzat.

La còpia anterior als canvis és `/home/pau/Documents/alcoholfabet-online-identity-before-20261009.tar.gz`, amb permisos `0600`. Aquesta verificació correspon al frontend local de `http://127.0.0.1:5173`; no documenta una publicació del frontend en un altre allotjament.
