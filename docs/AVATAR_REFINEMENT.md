# Refinament dels avatars i els marcs

Revisió del 9 d’octubre de 2026, a petició de l’usuari. El problema era visible als assets: el nas de la Tecla quedava esborrat al personatge gran; els contorns tenien restes blanques d’extracció, i els retrats de perfil incorporaven un cercle amb franja blanca que es tornava a emmarcar a la UI.

## Mestres únics

Els dos personatges s’han retocat amb l’eina integrada `image_gen.imagegen`, a partir de les il·lustracions anteriors, les referències privades de semblança i el paisatge aprovat. La Tecla té nas amb pont, punta, fossa i ombra; tots dos tenen ulls expressius, textura de pinzell controlada, cabells i roba més definits i llum càlida coherent. Es conserven els cabells, el vestuari, l’expressió i l’orientació de cada personatge. La Tecla acabada també serveix de referència d’estil per a en Pau.

Els mestres són:

- [pau_character_v2.png](../assets/production/avatars/pau_character_v2.png) i la seva versió WebP.
- [tecla_character_v2.png](../assets/production/avatars/tecla_character_v2.png) i la seva versió WebP.

Tots dos tenen 1133×1388 px i canal alfa real. El WebP conserva exactament el canal alfa del PNG; només s’ha convertit el format, sense dibuixar, retallar ni alterar els píxels fora de l’eina d’imatge. Les còpies de `assets/production/` i `public/assets/production/` són idèntiques. Les fotografies originals no es copien a `public/` ni al build.

Els prompts complets i el rol de cada referència són a [IMAGE_PROMPTS.json](../acceptance/avatar-refinement/IMAGE_PROMPTS.json). Els hashes, mides i comprovacions d’alfa són a [ASSET_REPORT.json](../acceptance/avatar-refinement/ASSET_REPORT.json).

## Perfil i integració

`PlayerPortrait` presenta el mateix mestre utilitzat a l’inici dins d’un marc de fusta pintada. El marc és un element de la UI, amb un retall intern real; la imatge no incorpora un cercle ni un altre marc. El retall es calibra per a cada personatge i escala proporcionalment amb el mateix component en indicador de jugador, sala, selector i victòria. No es genera una cara nova per a cada mida o estat.

Els marcs conserven les cinc mides anteriors (37×40, 45×48, 53×56, 66×70 i 90×95 px). Els rostres i les imatges no es deformen: el zoom i el desplaçament del retall són proporcionals. La portada té una ombra de contacte estreta i una suavització només al peu dels torsos, ajustada a l’extensió alfa de cada mestre. En mòbil, les figures són més grans i se superposen lleument per mantenir una parella pròxima sense reduir els controls.

Els avatars antics es conserven com a historial, sense sobreescriure’ls. La UI consumeix els dos mestres v2. La còpia prèvia dels assets i consumidors és `/home/pau/Documents/tecla-pau-avatars-before-20261009.tar.gz`, amb permisos 600.

## Verificació

La QA d’aquesta revisió es desa separadament a `acceptance/avatar-refinement/`. El navegador executa components React presentacionals reals a 390×844, 1024×768 i 1440×900, amb les cinc mides de perfil i els contexts d’inici, HUD, sala, rol i victòria. És una comprovació de representació visual, sense importar els serveis de joc ni crear sessions Auth o partides. No substitueix ni repeteix la bateria funcional de Supabase anterior.

Les captures i els resultats del navegador es registren a [REPORT.json](../acceptance/avatar-refinement/REPORT.json): 21 captures inspeccionades PASS, 72 perfils retallats i sis figures a les tres mides. Els 36 marcs comparables amb el baseline conserven x, y, amplada i alçada; els 15 controls d’inici també conserven geometria, amb mínim 48 px. No hi ha errors de navegador ni peticions a Auth, base de dades o serveis externs. La comparació inicial de components es conserva a `audit/avatar-refinement-before/`; aquestes captures són independents de les partides reals de l’encàrrec anterior.

[LOCAL_CHECK_REPORT.json](../acceptance/avatar-refinement/LOCAL_CHECK_REPORT.json) registra `npm run check` PASS: TypeScript, 18 proves unitàries en quatre fitxers i build. Després de l’últim ajust de CSS només de portada s’ha repetit `npm run build` (TypeScript i build PASS), juntament amb les tres captures de portada afectades. Les altres captures corresponen al mateix component de perfil sense canvis posteriors.

[BUILD_SECURITY_REPORT.json](../acceptance/avatar-refinement/BUILD_SECURITY_REPORT.json) comprova el build final: cap fotografia original, codi privat, clau secreta, JWT service_role ni pregunta aprovada crua. Els fitxers privats conserven permisos 600. El build manté l’avís conegut de chunk principal superior a 500 KB. No s’han modificat migracions, Edge Functions, regles ni dades de partida durant aquesta revisió.
