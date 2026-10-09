# Pau & Tecla

Joc privat de taula per a en Pau i la Tecla, amb React, TypeScript i Supabase. La mateixa base de dades arbitra els modes presencial i en línia: el navegador envia intencions i rep una vista segura segons el seu rol.

## Executar

```sh
npm ci
cp .env.example .env.local
# Emplenar VITE_SUPABASE_PUBLISHABLE_KEY amb la clau pública del projecte.
npm run dev
```

Obre http://127.0.0.1:5173. En aquest entorn ja hi ha `.env.local` configurat; no està inclòs al control de versions. El codi privat inicial està en un fitxer local amb permisos 600: `/home/pau/.config/tecla-pau/access-code.txt`. No es copia al frontend ni als informes.

Anonymous Sign-Ins està activat i verificat al projecte remot. Les proves finals de partida han utilitzat dispositius anònims nous i el backend real, sense simular el servidor.

## Jugar

En persona, escolliu durada i qui comença, responeu parlant i premeu `Mostra la resposta` abans de jutjar. En línia, cada dispositiu escull el seu rol; compartiu el codi curt i comenceu quan tots dos siguin connectats. El respondent no rep la resposta al JSON. T&P es reclama atòmicament al servidor. Només arribar formalment a Meta afegeix una victòria.

## Verificar

```sh
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright necessita Chromium. La configuració utilitza el navegador instal·lat en aquest entorn; en un altre equip, instal·la'l amb `npx playwright install chromium` i defineix `PLAYWRIGHT_CHROMIUM_EXECUTABLE` amb el seu camí, o elimina l'override `executablePath` de la configuració.

Les proves E2E fan escriptures reals al projecte Supabase configurat. Necessiten un codi d'accés real via `TECLA_ACCESS_CODE_FILE` i accés anònim activat. Si està desactivat, s'utilitza explícitament el fixture protegit `/tmp/tecla-pau-qa-users.json`; mai forma part del build. Executeu les suites de backend, E2E i motion successivament perquè comparteixen marcador.

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

La direcció d’art i els contractes dels components són a [docs/ART_SYSTEM.md](docs/ART_SYSTEM.md). El redisseny conserva els avatars i el paisatge aprovats; tauler, peces, paper, ceràmica, botons i símbols comparteixen el mateix sistema de materials i llum. El tauler continua sent SVG amb ruta, caselles i punts d’animació disponibles al codi.

L’auditoria del redisseny actual és a [audit/ART_REDESIGN_FINAL_AUDIT.md](audit/ART_REDESIGN_FINAL_AUDIT.md), amb [36 pantalles revisades als tres formats](acceptance/art-redesign/VISUAL_REVIEW.md), 18 proves unitàries, vuit E2E sobre Supabase real i preview del build final verificats. Els rechecks de motion després de l’últim ajust i els límits de rendiment estan documentats per separat. La matriu específica és [FINAL_ART_ACCEPTANCE_MATRIX.csv](acceptance/art-redesign/FINAL_ART_ACCEPTANCE_MATRIX.csv).

L’auditoria de la primera implementació és a [audit/FINAL_AUDIT.md](audit/FINAL_AUDIT.md). L’evidència del redisseny integral es desa separadament a [acceptance/art-redesign/](acceptance/art-redesign/). Les proves escriuen només en partides QA identificades; la neteja conserva les partides i el marcador de l’usuari.
