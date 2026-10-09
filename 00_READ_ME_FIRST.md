# Tecla&Pau — paquet mestre per a Codex Sol Ultra

Aquest paquet és la font de veritat per acabar o refer l'aplicació **Tecla&Pau** amb un acabat visual de joc de taula, animacions coreografiades, sons, mode presencial i mode en línia amb Supabase.

## Què has de fer tu

1. Copia aquest paquet a l'arrel del repositori actual de l'aplicació.
2. No copiïs la contrasenya de Supabase al repositori.
3. Connecta Codex a Supabase amb `setup/connect-supabase-codex.ps1` o segueix `setup/SUPABASE_MCP_SETUP.md`.
4. Obre Codex des de l'arrel del repositori.
5. Enganxa exactament el contingut de `PASTE_THIS_IN_CODEX.txt`.
6. Deixa que Codex inspeccioni, executi i millori el projecte; no li demanis només un pla.

## Ordre de lectura obligatori per a l'agent

1. `MASTER_PROMPT_CODEX_SOL_ULTRA.md`
2. `AGENTS.md`
3. `design/ART_DIRECTION.md`
4. `design/SCREEN_SYSTEM.md`
5. `motion/MOTION_SYSTEM.md`
6. `motion/event-choreography.json`
7. `docs/02_REGLES_DEL_JOC.md`
8. `docs/10_REALTIME_I_SEGURETAT.md`
9. `supabase/README.md`
10. `acceptance/FINAL_ACCEPTANCE_MATRIX.csv`

## Contingut principal

- Referències visuals completes i retalls de cada pantalla.
- Avatars aprovats i peces.
- Fons vectorials de Sitges per ordinador/iPad i mòbil.
- Tauler SVG, coordenades i estructura de capes.
- GIFs i storyboards de totes les animacions principals.
- Laboratori executable d'efectes (`motion/motion-lab`).
- Sons WAV originals.
- Components React de referència per a animacions.
- 130 preguntes validades.
- Esquema, RLS, funcions i especificació Supabase.
- Configuració MCP de Supabase per a Codex.
- Proves, criteris d'acceptació i matriu visual.

## Seguretat

La contrasenya compartida anteriorment no forma part d'aquest paquet. Canvia-la abans de producció. La publishable key de Supabase tampoc s'incrusta al codi; es llegeix de variables d'entorn.
