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

La migració `0013_online_player_identity.sql` afegeix dos codis privats que assignen el rol exclusivament en línia, amb validació al servidor. El client recupera les sessions locals invàlides i mostra el motiu de l’error d’entrada amb un botó per tornar-ho a provar. Les proves amb dos dispositius, les captures i la neteja de QA són a [acceptance/online-identity/](acceptance/online-identity/README.md).

La fusta del tauler utilitza vetes vectorials i una ombra separada, amb la vora inferior nítida. La regla del +1 s’ha verificat amb RPCs reals: un encert avança dues caselles amb una sola pregunta; un error o una resposta desconeguda no avança, passa el torn i indica beure doble. Informes: [acceptance/plus-board/](acceptance/plus-board/README.md).
