# Sistema d’art — Tecla&Pau

La referència és el paisatge aprovat `sitges_scene_desktop_ai.webp` i la seva composició vertical. Aquest sistema es deriva dels materials, el traç i la llum d’aquesta obra. No substitueix el paisatge ni regenera els avatars aprovats.

## Lectura de l’obra

Llum de capvespre lateral i alta, càlida, amb el sol a la dreta de l’escena; el frontal dels objectes rep un rebot ambre des de la taula. La vora superior/esquerra es perfila amb crema i els volums projecten ombra curta cap a baix/esquerra, amb oclusió fosca al contacte. Evitem imposar ombres de migdia o lluentors blanques. El paisatge combina terracota, mel i ocre amb mar blau apagat, oliva fosc i violeta al cel. Contorn marró irregular de baixa intensitat, superfícies pintades amb veta i pinzellades visibles, contrast alt només en vores i objectes propers. Saturació mitjana; volum il·lustrat, sense fotorealisme PBR.

| Funció | Pigment | Ús |
|---|---|---|
| Tinta | `#343d3b` | Text principal sobre paper |
| Paper | `#f8edd6` / `#e7d1a7` | Fibra i cantell |
| Fusta | `#a76d3e` / `#623d27` | Tauler, controls principals |
| Pau | `#426c82` | Blau ceràmic, peça i accents |
| Tecla | `#ac6570` | Rosa pigmentat, peça i accents |
| Creuada | `#727958` | Oliva i petits gravats |
| T&P | `#84708c` | Lavanda fumada |
| +1 / Meta | `#b68b43` | Ocre, llautó vell |
| Encert | `#55735a` | Verd artesanal |
| Error | `#ad5d49` | Terracota |

## Materials i representació

- **Fusta:** mat, mel i noguera. Veta longitudinal i nusos subtils; frontal amb gruix real, cantell arrodonit, llum ambre petita i ombra d’oclusió. Base completa del tauler, mai una cinta flotant. L’ornament ocupa les vores, no la ruta.
- **Paper:** gruixut, crema, fibres molt lleus i vora dibuixada. Cantell fosc de 2–4 px i dues ombres (contacte i dispersió). Les targetes, panells, avisos i modals comparteixen el mateix material. Cara posterior amb motiu botànic i marca del joc; cara frontal amb text HTML real. El gir conserva capes i gruix.
- **Ceràmica:** esmalt setinat amb pigment apagat, filet crema imperfecte, petit reflex càlid, ombra curta. Caselles amb símbol propi i petits patrons; botons de jugador i controls de validació. Mai plàstic brillant.
- **Metall:** només llautó vell en Meta, corona i detalls; sense reflex de mirall.
- **Vidre:** contorn verd oliva/mel i reflex de capvespre en el got de feedback; no s’aplica transparència de vidre als panells.
- **Peces:** Pau blau amb silueta angular; Tecla rosa amb silueta arrodonida. Petit símbol gravat propi, sense inicials, peó d’escacs ni emoji. Fusta pintada/ceràmica de la mateixa llum que el tauler.
- **Caselles:** personals amb retrat gravat; creuades amb dues branques entrellaçades; T&P amb dues figures; +1 amb marca ocre; Sortida amb llavor/entrada; Meta amb llautó/corona. Color, forma de símbol i textura diferencien categories.
- **Botons:** una base comuna ArtButton; fusta, paper o ceràmica segons funció. Vora, cantell i ombra compartits. Correcte/Incorrecte tenen idèntica geometria, contrast i pes. No hi ha opció suggerida abans de validar.
- **Badges, marcador i progrés:** petites plaques de paper i ceràmica. Progrés com a solc gravat amb pigment, avatars originals emmarcats amb material càlid. Sense xips empresarials.
- **Icones:** geometria original SVG, traç coordinat 2,1 px, terminals arrodonits, tinta marró i petits pigments crema/oliva. Llegibles a 24 px i sense logotips de llibreries.
- **Modals i overlays:** ArtModal de paper sobre vel marró càlid; l’escena segueix visible. Connexió i rotació formen part del mateix ambient. Focus i scrollbars amb ocre i noguera.
- **Efectes:** pols i retalls de paper amb pigments del sistema. Encert amb check de tinta verda; error amb creu terracota i got. +1 amb segell ocre i moviment separat. Victòria amb corona de llautó i paper discret.

## Llum i ombres centralitzades

`src/art-system/tokens.css` és la font executada de paleta, llum, materials, ombres i estats. `src/art-system/materials.css` defineix les superfícies. Les variables històriques `--tp-*` són àlies per conservar els contractes de motion. La il·luminació SVG deriva de la mateixa paleta. Gradients només modelen matèria i llum, mai efectes tecnològics.

## Interacció

Normal: textura visible i ombra curta. Hover: llum +3% i elevació màxima d’1 px. Pressed: descens de 2 px i ombra més curta. Focus: doble contorn ocre/tinta contrastat. Disabled: pigment apagat amb text llegible, sense desaparèixer. Loading: indicador dins l’espai reservat, sense canviar amplada. Success/Error: pigments verd/terracota, símbols i resposta física curta. Tots els objectius tàctils fan almenys 48×48 px.

## Motion i responsive

`motion/event-choreography.json` conserva l’ordre temporal i la font de veritat. Transformacions del moviment es resolen sobre les coordenades de ruta SVG; inclinació breu de la peça i compressió mínima en aterrar. Ombra de contacte separada de la silueta. Sense rebots exagerats. Moviment reduït conserva tot el flux i els estats.

Mòbil: el mateix tauler amb perspectiva molt plana, menys ornament i controls al peu de targeta, sense scroll durant el torn. Tauleta i escriptori: perspectiva moderada i ombra de contacte; 60–65% tauler, 35–40% targeta. Mateix material i iconografia en tots tres formats.

## Porta de propagació

Primer s’ha d’inspeccionar una partida vertical completa a 390×844 amb fons, tauler, peces, targeta, controls, capçalera i efectes. Només després es propaga l’ús dels components a inici, preparació, sala i diàlegs. La verificació final captura els dotze estats demanats a 390×844, 1024×768 i 1440×900. Les captures i la inspecció visual són evidència; no s’atribueix rendiment a dispositius físics sense mesura.

Porta superada durant aquesta implementació: inspecció de `acceptance/art-redesign/screenshots/vertical-system-smoke-{390x844,1024x768,1440x900}.png`. Mateixa partida real de baseline sense mutar (versió 2), cap error ni desbordament, controls mínims 48 px, focus per Tab i validació simètrica. Després de la inspecció s’ha autoritzat la propagació dels components. La fusta del tauler afegeix una mostra de veta retallada del paisatge aprovat a les capes SVG; base, vores, caselles, gravats, peces i ruta continuen sent objectes separats i programàtics.
