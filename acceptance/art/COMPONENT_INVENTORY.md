# Components d’art compartits

La propagació s’ha fet després de l’aprovació de la partida vertical completa. `src/components/art/index.ts` exporta una única base física `ArtButton`, els seus set controls derivats, `ArtIcon`, `ArtPanel`, `ArtCard`, `ArtBadge`, `ArtModal`, `ArtToast` i `ArtLoader`.

| Àmbit | Components executats |
|---|---|
| Inici | ArtButtonSecondary ceràmic Pau/Tecla, ArtButtonQuiet, ArtPanel per al marcador |
| Accés privat | ArtPanel com a form, ArtButtonPrimary submit, ArtButtonQuiet |
| Configuració | ArtPanel, ArtButtonSecondary per a totes les opcions, ArtButtonPrimary/Quiet |
| Sala en línia | ArtPanel, ArtButtonSecondary copiar/compartir, ArtButtonPrimary iniciar |
| Partida | ArtCard/ArtBadge, ArtButtonPrimary/TP/Correct/Incorrect, ArtIconButton |
| Victòria | ArtCard, ArtPanel per al marcador, ArtButtonPrimary/Secondary |
| Normes i abandonament | ArtModal, ArtButtonPrimary/Secondary/Incorrect |
| Errors i connexió | ArtToast, ArtPanel, ArtLoader, ArtIcon |
| Rotació | ArtIcon original sobre el vel càlid de l’escena |

`App.tsx` no conté cap button ni dialog cru, classe paper-panel/paper-dialog, icona antiga o tancament ×. Els elements natius button i dialog viuen només als components base. Els controls mantenen text català, handlers, permisos, atributs ARIA, formularis submit i data-motion. La targeta rep el pool segur del servidor per pintar el símbol de categoria. Només s’ha eliminat el distintiu +1 HTML redundant; l’objectiu SVG original del tauler es conserva.

Els 27 pictogrames SVG originals comparteixen traç principal arrodonit de 2,1 px. La corona de llautó i el segell de paper +1 usen la mateixa paleta i llum. Les 29 fonts SVG s’han validat com a XML i tenen còpies públiques idèntiques.

La inclinació de la peça viu al cos SVG intern, separat de la coordenada de ruta i de l’ombra. La compressió d’aterratge és mínima. Les partícules són paper i pigment càlid. L’ordre i les durades continuen derivant de motion/event-choreography.json; no s’ha canviat cap regla del servidor.

Verificació: npm run check passa TypeScript, 18 tests i build. component-behavior-qa.json registra Strict Mode sense tancament espontani, Esc amb una sola petició, focus retornat al control que obre, càrrega sense canvi d’amplada, disabled llegible, conservació de data-motion i absència d’errors de pàgina. La comprovació es va executar amb els components React reals en una fixture temporal ja eliminada, sense afegir cap ruta al producte.
