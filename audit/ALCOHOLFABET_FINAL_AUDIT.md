# Alcoholfabet — auditoria final

Revisió acabada el 9 d’octubre de 2026, segons les instruccions posteriors de l’usuari. Nom Alcoholfabet, entrada pública sense codi privat, avatars retirats, tauler i pregunta amb més espai, textos d’ajuda retirats i coreografia de beure reforçada. La còpia prèvia privada és `/home/pau/Documents/alcoholfabet-before-20261009.tar.gz` (0600).

## Execució verificada

- `npm run check`: TypeScript, 30 proves unitàries en set fitxers i build PASS. El paquet servit a 4173 és idèntic al build final.
- Set casos de navegador PASS: cinc d’accés, joc, beure i durada, més dues partides completes fins a META. Utilitzen Supabase Auth, RPC i Realtime reals. `ALCOHOLFABET_E2E_REPORT.json` declara els runs independents combinats; es conserven els intents previs fallits. La denegació dels avatars antics al servidor local i la descodificació estable de `<picture>` es van corregir i tornar a provar. La prova de descodificació continua exigint que totes les imatges carreguin correctament.
- SQL real PASS: entrada anònima sense codi o dispositiu autoritzat, creació i entrada a sala pública, protecció del context privat anterior, no-membres, ACL Realtime i resposta amagada al respondent. La regressió de durada completa 50 caselles amb 87 preguntes sense repetició; la suite històrica de permisos privats també passa. Els fixtures SQL es desfan dins de la transacció.
- Migració `0012_alcoholfabet_public_access.sql` aplicada amb MCP, versió `20261009152522`. Un context públic nou conserva íntegres les partides, rutes, resultats i permisos del context privat anterior. No cal cap acció manual de Supabase.
- 30 captures de components reals i 35 captures de l’app real als cinc formats: 360×800, 390×844, 430×932, 1024×768 i 1440×900. Sense overflow, solapaments ni controls menors de 48×48. La pregunta té 23–33 px; el tauler utilitza tota l’amplada mòbil.
- Quatre casos de motion PASS, amb i sense moviment reduït. El runner i l’orquestrador reals executen una vegada el brindis, sis bombolles en motion normal, el cue ordinari o doble correcte i zero partícules residuals. Els cues es registren al harness; l’app real utilitza el seu gestor de so. No s’hi creen usuaris o partides.
- Scan del paquet final PASS: zero codi privat, claus de servei, fotografies originals, preguntes crues, camins d’avatars o textos d’ajuda retirats. Els 14 fitxers d’avatar han sortit de `public/`; les fonts històriques no entren a `dist/` i estan bloquejades al servidor local. Les 130 preguntes aprovades es conserven idèntiques a la còpia prèvia.
- Neteja completa dels nou usuaris, sis partides i dos resultats QA enumerats. Conservats exactament els 16 jocs, sis usuaris, dos resultats i totes les files relacionades no enumerades presents en la comprovació. Marcador privat legítim 1–1; el context públic no conserva punts QA. Cap fixture d’aquesta revisió restant.

Les proves i els hashes queden a `acceptance/alcoholfabet/`; el resum és `FINAL_REPORT.json`. `acceptance/FINAL_ACCEPTANCE_MATRIX.csv` té 97 criteris: 96 PASS i un PARTIAL. Inclou evidència històrica i actualitza el criteri d’avatars segons la nova instrucció. El fitxer anterior es conserva a `audit/alcoholfabet-before/`.

## Límits

La fluïdesa en tots els dispositius físics i Safari conserva el PARTIAL anterior; no s’ha declarat una garantia general de 60 FPS. La durada continua sent una estimació de 30 segons per torn i el banc finit de preguntes manté els seus límits documentats. L’entrada pública no canvia l’allotjament del frontend; l’app local es continua servint a 5173. El codi de sala en línia connecta els dos dispositius. Les sessions públiques noves no tenen accés a les partides privades històriques.
