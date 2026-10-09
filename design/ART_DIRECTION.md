# Direcció d'art — Tecla&Pau

## 1. Intenció

Tecla&Pau ha de semblar un joc de taula personal fet expressament per a una parella adulta. L'aplicació no ha de semblar una web que conté un joc; ha de semblar que el dispositiu s'ha convertit en una taula de joc.

Paraules clau:

- Mediterrani.
- Sitges.
- Artesanal.
- Càlid.
- Adult.
- Proper.
- Lúdic.
- Tàctil.
- Polidet.
- Relaxat.

Evitar:

- SaaS.
- Dashboard.
- Casino.
- Infantilització.
- Neó.
- Glassmorphism.
- 3D hiperrealista.
- Efectes espectaculars sense sentit.
- Decoració turística genèrica.

## 2. Escena

La interfície és una composició de capes:

1. Cel i llum de capvespre.
2. Mar i perfil urbà de Sitges.
3. Taula de fusta.
4. Decoració perifèrica.
5. Tauler.
6. Fitxes.
7. Targeta de pregunta.
8. Controls.
9. Efectes temporals.

Cap capa no ha de semblar enganxada arbitràriament. Les ombres, l'escala i la perspectiva han de compartir una direcció de llum comuna.

## 3. Sitges

Elements recognoscibles:

- La Punta.
- L'església de Sant Bartomeu i Santa Tecla.
- El Baluard.
- Façana marítima de cases blanques.
- Una referència subtil a Maricel.
- Mar Mediterrani.

No incloure:

- Càmera fotogràfica.
- Maletes.
- Avions.
- Creuers.
- Cartells turístics.
- Resorts tropicals.
- Edificis de fantasia.
- Castells genèrics.
- La paraula `Sitges` escrita a la llibreta.

La cultura local pot aparèixer en una postal discreta, una gralla, un timbal, un motiu de gegants o del Drac, però no com un parc temàtic.

## 4. Materials

### Fusta

- Veta visible però subtil.
- Mat, no lacada.
- Tons càlids.
- Ombra de contacte sota cada element.

### Paper

- Crema, no blanc pur.
- Lleu textura.
- Vores suaus.
- Ombra doble: contacte curt i difusió ampla.

### Fitxes

- Volum arrodonit.
- Reflex brillant petit.
- Ombra el·líptica.
- En Pau: blau.
- La Tecla: rosa.
- Formes lleugerament diferents.

## 5. Composició

### Pantalla inicial

- El paisatge i els avatars generen emoció.
- El títol té protagonisme.
- El marcador general apareix una sola vegada.
- Dos botons principals: presencial i online.
- `Normes` és secundari.

### Partida en ordinador/iPad

- El tauler domina.
- La targeta no tapa la peça activa ni la següent casella.
- El HUD superior és curt i net.
- La decoració queda a les vores.

### Partida en mòbil

- El tauler es veu, però la pregunta és llegible sense esforç.
- La targeta no és un modal genèric.
- Els botons queden a la zona del polze.
- No hi ha scroll durant un torn normal.

## 6. Avatars

Utilitza els assets aprovats. Han de mantenir:

- Línia clara.
- Pigments càlids, volum pintat i llum coherent amb el paisatge.
- Adult jove.
- Semblança amb les fotos.
- Coherència entre pantalles.

No generis expressions noves amb una cara diferent. Per a feedback, anima l'asset amb translació, rotació, escala, corona o partícules.

El refinament demanat per l’usuari el 9 d’octubre de 2026 utilitza `pau_character_v2` i `tecla_character_v2`. Corregeix el nas de la Tecla i els contorns d’extracció, amb més detall il·lustrat. El perfil deriva del mateix mestre transparent amb `PlayerPortrait`; el marc pertany a la UI. La portada i els perfils sempre comparteixen la mateixa cara. Vegeu `docs/AVATAR_REFINEMENT.md`.

## 7. Densitat visual

La pantalla pot ser rica en detall, però la interacció ha de ser simple.

Regla:

- Molt ambient a la perifèria.
- Poc soroll al centre d'acció.
- Una pregunta.
- Una decisió.
- Una animació principal cada vegada.

## 8. Il·luminació

- Derivada del paisatge aprovat: sol lateral a la dreta, capvespre, rebot frontal càlid de la taula.
- Ombres curtes cap a baix/esquerra amb contacte marró, sense negre fred.
- Halo càlid ambiental.
- Efectes d'encert/error no han de canviar tota l'escena.

## 9. Criteri d'acceptació

Una captura compleix la direcció d'art quan:

- Sense llegir text, sembla un joc de taula.
- Sitges és recognoscible.
- L'escena té profunditat.
- Els botons semblen part del sistema visual, no components per defecte.
- La peça activa és localitzable en menys d'un segon.
- La pregunta és llegible immediatament.
- No sembla una app empresarial.

## Sistema d’art integral

La petició de redisseny artístic amplia aquesta direcció: materials, caselles, peces, controls, icones i efectes es defineixen a `docs/ART_SYSTEM.md`. Els tokens executats són a `src/art-system/tokens.css`; els avatars i el paisatge aprovats conserven la seva identitat.
