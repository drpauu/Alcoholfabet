# MASTER PROMPT — CODEX SOL ULTRA — ALCOHOLFABET

## 0. Missió

Acaba o reconstrueix, dins del repositori actual, l'aplicació web **Alcoholfabet**. El resultat ha de ser un joc de taula digital públic, fluid i visualment polidet per a dos jugadors fixos: en Pau i la Tecla.

No lliuris una maqueta, un pla, una landing page ni una demostració parcial. Implementa, executa, compara, prova i corregeix fins que el producte sigui jugable de principi a fi en mode presencial i en mode en línia.

La feina actual pot contenir una implementació funcional però visualment deficient. No la reescriguis a cegues. Audita-la, conserva el que sigui correcte i substitueix la capa visual, d'animació i d'orquestració d'efectes quan no compleixi les referències.

## 1. Fonts de veritat i precedència

En cas de contradicció, segueix aquest ordre:

1. Aquest document.
2. `AGENTS.md`.
3. `docs/02_REGLES_DEL_JOC.md`.
4. `docs/10_REALTIME_I_SEGURETAT.md`.
5. `design/ART_DIRECTION.md`.
6. `design/SCREEN_SYSTEM.md`.
7. `motion/MOTION_SYSTEM.md` i `motion/event-choreography.json`.
8. `assets/reference/full/01_primary_visual_reference.png`.
9. `assets/reference/full/02_style_system_reference.png`.
10. La resta de fitxers.

Les fotografies de `assets/reference/people/` són privades i només serveixen de referència de semblança. No les publiquis, no les copiïs a `public/` i no les pugis a Storage.

## 2. Regla d'execució

Abans de modificar res:

1. Inspecciona l'arbre del repositori, `package.json`, rutes, components, tests i configuració Supabase.
2. Executa l'aplicació actual i captura l'estat inicial a 390x844, 1024x768 i 1440x900.
3. Fes un commit o còpia de seguretat.
4. Classifica cada àrea com a: conservar, refactoritzar o substituir.
5. Llegeix el laboratori d'efectes de `motion/motion-lab/` i els components de `motion/reference-react/`.
6. Implementa per fases, però continua automàticament fins al final.
7. Després de cada fase, executa build, TypeScript i proves rellevants.
8. No aturis la feina per decisions menors ja resoltes en els documents.

## 3. Producte

- Jugadors fixos: en Pau i la Tecla.
- Joc 1 contra 1.
- Sense noms editables, perfils públics ni més jugadors.
- Sense contingut sexual.
- Joc social i de beure; la web és tauler i àrbitre visual.
- Les respostes sempre es diuen parlant.
- No hi ha inputs de resposta, reconeixement de veu, micròfon ni gravació.

### Modes

**En persona**

- Un dispositiu.
- Els dos veuen la pregunta.
- La resposta queda oculta fins a `Mostra la resposta`.
- Després apareixen `Correcte` i `Incorrecte`.

**En línia**

- Dos dispositius.
- Un dispositiu és d'en Pau i l'altre de la Tecla.
- Qui respon veu la pregunta, però mai la resposta.
- L'altre dispositiu veu la resposta i valida.
- Tot és Realtime.
- Recàrrega i reconnexió recuperen exactament la partida.

## 4. Regles essencials

L'objectiu és arribar primer a la META.

Categories:

- `PAU`: pregunta personal d'en Pau.
- `TECLA`: pregunta personal de la Tecla.
- `TECLA_PAU`: la Tecla respon sobre en Pau, nivell assequible.
- `PAU_TECLA`: en Pau respon sobre la Tecla, nivell assequible.
- `TP`: tots dos poden reclamar; només guanya la primera reclamació confirmada al servidor.

Encert:

- Avança fins a la casella següent.
- Es reprodueix la seqüència visual i sonora d'encert i moviment.

Error:

- No avança.
- Perd el torn.
- Beu.

Casella `+1`:

- Si encerta, avança a la casella i una casella addicional sense respondre cap altra pregunta.
- No s'encadena un segon `+1`.
- Si falla o no sap la resposta, no avança, perd el torn i beu doble.

El marcador general només compta partides finalitzades. Una partida incompleta, abandonada o desconnectada no suma res. Una mateixa partida mai no pot sumar dues vegades.

## 5. Requisit visual principal

La referència visual no és orientativa: és el criteri d'acceptació.

L'aplicació ha de semblar un joc de taula físic sobre una taula de fusta mediterrània, amb:

- Sitges recognoscible i cultural.
- La Punta i l'església de Sant Bartomeu i Santa Tecla.
- El Baluard, front marítim i referència subtil a Maricel.
- Capvespre càlid.
- Paper, fusta, ombres, profunditat i perspectiva.
- Olives, gots, vegetació i petits objectes de taula.
- Peça blava d'en Pau.
- Peça rosa de la Tecla.
- Noms i colors de les peces, sense avatars.

No utilitzis:

- Interfície SaaS o dashboard.
- Cards blanques genèriques.
- Glassmorphism, neó o gradients tecnològics.
- Emojis com a assets.
- Càmeres, maletes, avions, creuers o tòpics turístics.
- Edificis inventats.
- La paraula `Sitges` escrita a la llibreta.
- La imatge composta sencera com a únic background.

Construeix capes reals: escena, taula, decoració, tauler SVG, caselles, peces, targetes, controls, textos i efectes.

## 6. Sistema visual obligatori

Utilitza els assets de producció inclosos:

- `assets/production/backgrounds/`
- `assets/production/board-v2/`
- `assets/production/pawns/`
- `assets/production/icons/`
- `assets/production/effects/`
- `assets/production/textures/`
- `assets/production/sounds/`

Si cal retocar un asset, conserva el mateix estil. No utilitzis avatars. Les fonts retirades es conserven fora del paquet públic.

Utilitza design tokens de `design/design-tokens.css` i `design/design-tokens.json`.

Tipografia:

- Logotip: manuscrita, només per a `Alcoholfabet`.
- UI: arrodonida, adulta i molt llegible.
- Màxim dues famílies.

## 7. Responsive i orientació

**Mòbil (<768 px)**

- Vertical.
- Tauler superior, targeta inferior.
- Controls grans a la zona inferior.
- Sense scroll durant un torn normal.
- `100dvh` i safe areas.
- En horitzontal: pantalla `Gira el dispositiu`.

**iPad/tauleta (>=768 px)**

- Horitzontal durant la partida.
- En vertical: `Gira l'iPad`.
- Tauler 60-65%, targeta 35-40%.
- Perspectiva més marcada que al mòbil.

**Ordinador**

- Horitzontal.
- Tauler sempre visible.
- Targeta lateral o parcialment superposada.
- Amplada màxima controlada.

Mides de verificació:

- 360x800
- 390x844
- 430x932
- 768x1024
- 1024x768
- 1366x768
- 1440x900

## 8. Animacions: no acceptar efectes pobres

No resolguis el joc amb una col·lecció de `transition: opacity`.

Cada acció ha de tenir una coreografia coordinada entre targeta, tauler, peça, partícules, so i estat. Implementa les seqüències exactes de `motion/event-choreography.json`.

Requisits:

- Targeta que llisca físicament sobre la taula.
- Gir de targeta amb canvi de contingut al punt mig.
- Encert amb elevació, halo, check dibuixat i partícules.
- Error amb moviment curt, halo vermell i got.
- Peça que segueix el recorregut SVG, s'eleva i aterra.
- `+1` amb pols de casella, nota brillant i segon moviment.
- T&P sense optimisme local: espera confirmació del servidor.
- Victòria amb arribada a META, petit zoom de càmera, corona i confeti discret.
- Reconnexió amb transició curta i sense repetir accions antigues.
- `prefers-reduced-motion` complet.

Utilitza `transform`, `opacity`, `filter` i trajectòries SVG. Evita animar layout costós.

## 9. Sons

Integra els WAV inclosos i el mapa de `motion/audio-cues.json`.

- No hi ha música contínua.
- AudioContext només després d'una interacció.
- Control de so persistent però discret.
- No repeteixis sons per esdeveniments Realtime duplicats.
- Sincronitza cada so amb el moment indicat a la coreografia.

## 10. Arquitectura frontend

Objectiu:

- React + TypeScript estricte.
- Sense `any` no justificat.
- Components presentacionals separats de dades.
- Màquina d'estats o reducer central.
- Estat de servidor separat de l'estat visual.
- Serveis Supabase encapsulats.
- Sistema d'efectes centralitzat.
- Textos catalans centralitzats.

Pots utilitzar una llibreria de motion mantinguda si ja existeix al projecte o si aporta valor clar. No introdueixis un motor 3D pesat.

## 11. Supabase

Projecte existent:

- Project ref: `lhgyopkwstuyxolwfucq`
- URL: `https://lhgyopkwstuyxolwfucq.supabase.co`

Utilitza el MCP de Supabase configurat per al projecte. Si el MCP no està disponible, utilitza Supabase CLI o prepara/aplica migracions de manera verificable.

No exposis:

- Database password.
- Service role key.
- Secrets d'Edge Functions.

La publishable key es llegeix de variables d'entorn.

Implementa:

- Anonymous Auth.
- Menú i mode presencial públics sense codi privat, mitjançant Anonymous Auth.
- Identificació amb dos codis privats només en línia; el servidor assigna i exigeix el rol PAU o TECLA en crear i unir-se a una partida.
- Espai públic `alcoholfabet` separat de les partides privades històriques.
- Membres de partida validats al servidor.
- RLS a totes les taules exposades.
- Accions d'escriptura mitjançant RPC/funcions revisades.
- `state_version`.
- `idempotency_key`.
- `match_results.game_id UNIQUE`.
- Canals privats `game:<game_id>`.
- Broadcast i Presence.
- PostgreSQL com a font de veritat.

### Protecció de resposta

La resposta correcta no pot arribar al dispositiu de qui respon.

No pot existir en:

- JSON.
- DOM.
- CSS ocult.
- Cache precargada.
- Broadcast.
- Logs del client.

`get_game_view` o equivalent construeix una vista per sessió i rol.

### Realtime

Flux:

1. Client envia intenció.
2. Servidor valida i persisteix.
3. Incrementa versió.
4. Servidor emet un Broadcast privat.
5. Clients recuperen la vista segura.
6. UI orquestra l'animació una sola vegada.

En reconnectar:

- Renova auth Realtime.
- Torna al canal privat.
- Publica Presence.
- Recupera vista.
- Descarta accions pendents antigues.

## 12. Dades inicials

Importa `data/questions_approved.json`.

- 130 preguntes.
- 26 per pool.
- Respostes d'1 a 5 paraules.
- Només `APPROVED`, actives i revisades poden entrar en partida.
- No repetir pregunta dins de la mateixa partida.

## 13. Fases d'implementació

### Fase A — Auditoria i estabilització

- Executa l'app actual.
- Captura screenshots.
- Identifica regressions i mocks.
- Estableix baseline.

### Fase B — Direcció d'art i layout

- Integra escena, tauler, targetes i tokens; sense avatars.
- Implementa responsive real.
- Compara visualment amb mockups.

### Fase C — Motor presencial

- Durada.
- Generació de recorregut.
- Categories.
- T&P.
- +1.
- Final i marcador local provisional només si backend no està connectat encara.

### Fase D — Supabase i online

- Migracions.
- RLS.
- RPCs.
- Realtime.
- Vistes segures.
- Reconnexió.
- Marcador persistent.

### Fase E — Motion i àudio

- Integra totes les seqüències.
- Evita dobles execucions.
- Valida rendiment.

### Fase F — QA final

- Unit tests.
- Integració Supabase.
- E2E amb dos contexts.
- Visual regression.
- Responsive.
- Seguretat.
- Build de producció.

## 14. Browser testing obligatori

Utilitza un navegador real.

Crea dos contexts:

- Context A: en Pau.
- Context B: la Tecla.

Prova:

1. Accés públic directe.
2. Crear partida online.
3. Unir-se amb l'altre rol.
4. Pregunta sense resposta al respondent.
5. Resposta visible al jutge.
6. Correcte.
7. Incorrecte.
8. T&P simultani.
9. +1.
10. Recàrrega.
11. Desconnexió i reconnexió.
12. Arribada a META.
13. Marcador exactament una vegada.
14. Partida abandonada sense punt.
15. Tornar a jugar.

## 15. Criteri visual quantitatiu

Abans d'acabar, completa `acceptance/FINAL_ACCEPTANCE_MATRIX.csv`.

No consideris complet:

- Una pantalla que només té els colors correctes però no la composició.
- Una peça que teletransporta.
- Una targeta que només fa fade.
- Una victòria amb confeti genèric sense integració al tauler.
- Una app que sembla un dashboard.
- Una app que mostra la resposta a través de Network/DOM.

## 16. Lliurament

Deixa:

- Aplicació funcional.
- Assets de producció.
- Migracions.
- Edge Functions.
- Tests.
- `.env.example`.
- `README.md`.
- `SUPABASE_SETUP.md`.
- Informe d'auditoria final amb proves realment executades.

Al final, informa de:

- Què funciona.
- Quines proves han passat.
- Quines migracions s'han aplicat.
- Quines funcions existeixen.
- Quines accions manuals queden.
- Qualsevol limitació real no resolta.

No afirmis res que no hagis verificat.

## Revisió aprovada de producte — 9 d’octubre de 2026

La instrucció posterior de l’usuari substitueix les referències històriques a accés privat, avatars i nom Pau & Tecla: Alcoholfabet té entrada pública, cap avatar i protagonisme del tauler i les preguntes. Beure mostra un got amb el nom, i una coreografia de brindis central de 3.600 ms definida al JSON, amb got vectorial gran, líquid i reflexos animats (900 ms estàtics amb moviment reduït); amb moviment reduït conserva un avís estàtic i el so activat. El codi de la sala en línia només connecta els dos dispositius. Els textos d’ajuda «Respon en veu alta! L’altra persona valida la resposta.» i «No s’encadenen bonificacions.» no es mostren. La regla de no encadenar +1 es conserva al servidor.

## Ritme i textos de durada — revisió posterior

Per instrucció posterior de l’usuari, les animacions principals duren un 50% més i els sons segueixen els mateixos moments visuals. La frase d’estimació de torns s’ha retirat de la pantalla de durada. La lògica de càlcul de la durada de les partides es conserva.

## Identitat en línia — revisió posterior

La instrucció posterior de l’usuari introdueix dos codis privats, un per a cada jugador, exclusivament per a partides en línia. El menú i el mode presencial conserven l’entrada pública. Els valors dels codis es configuren fora del repositori; els hashes i la vinculació entre sessió i rol romanen al servidor. En crear o entrar en una partida en línia, el servidor exigeix el rol identificat. El rol es conserva en recarregar. L’entrada recupera una sessió local invàlida i ofereix un error explicatiu i un botó per tornar-ho a provar si falla la connexió.

## Banc canònic — revisió posterior de 9 d’octubre de 2026

La instrucció posterior de l’usuari substitueix el banc inicial de 130 preguntes per les 5.000 files del paquet canònic. Les 130 originals i el seu historial es conserven, però el selector fa servir la versió canònica activada. Una pregunta i un `fact_id` no es poden repetir dins de la mateixa partida, tampoc quan canvia la pila. Les formulacions inverses de la mateixa relació capital–país comparteixen una clau semàntica addicional. El selector evita els fets de les 10 últimes partides per a PAU, TECLA i TP, i de les 5 últimes per a les piles creuades. Només si no queda cap candidat nou es recupera el fet menys recent de partides anteriors; mai s’afluixen les exclusions dins de la partida, de resposta consecutiva o de tercer subtema consecutiu. L’esgotament real retorna un error estable.

Les files dubtoses queden DRAFT i inactives, sense eliminar ni canviar els textos originals. El banc i els identificadors descriptius de l’historial són exclusius del servidor; qui respon només rep la vista segura. Consulteu `QUESTION_BANK_IMPORT_REPORT.md` i `data/question-bank/REVIEW.md` per als recomptes i les proves executades.

## Inici automàtic del torn — revisió posterior

Per instrucció posterior de l’usuari, s’elimina el pas «La següent casella us espera» i el botó de començar el torn. En crear, reprendre o passar al torn següent, el dispositiu que té la capacitat autoritzada pel servidor envia automàticament BEGIN_TURN. En línia només ho fa el jugador que té el torn. La confirmació del servidor i la coreografia de la pregunta es conserven; la reconnexió, les animacions, les operacions pendents i els diàlegs oberts bloquegen l’enviament fins que es pot continuar.

## Actualització del banc i mòbil — 10 d’octubre de 2026

La instrucció posterior substitueix el banc de les partides noves per les 1.000 preguntes de `questions_1000.xlsx`; el paquet, JSONL i prompt nous no s’han trobat. La conversió conserva els textos. El manifest actiu és `excel-1000-20261010-v1`: 913 aprovades i 87 inactives per incidències. Els bancs antics i l’historial es conserven. Les partides noves fixen la versió al servidor i les anteriors mantenen la disponible abans de la migració. La importació comença inactiva, és idempotent i es valida fila per fila abans d’activar. Els duplicats conceptuals detectats i les equivalències històriques es resolen al servidor. Vegeu `QUESTION_BANK_1000_MIGRATION_REPORT.md`.

Per petició de l’usuari, els avisos de connexió esperen cinc segons continus; no es mostra reconnexió si la interrupció s’ha recuperat abans. Els bloquejos d’accions sense connexió continuen immediats. Les preguntes completes han de cabre a la carta mòbil amb la resposta i els controls; s’ajusta només la tipografia necessària i es permet desplaçament intern de reserva. La resta dels visuals es conserva.

En la revisió mòbil posterior, l’ajust també cobreix el resultat, beure i el torn següent. La resposta o l’avís de beure tenen una fila pròpia i els controls queden visibles. El tauler pot cedir espai a la carta quan calgui; la tipografia no baixa de 20 px. En pantalles excepcionalment petites o amb textos històrics més llargs, només es desplaça la pregunta, sense tapar la resposta o la penalització. El resum de +1 escurçat diu «Avances dues caselles» i conserva les regles del servidor. Els dos gots reserven marge per al seu moviment lateral.
