# +1 i acabat del tauler

El +1 es resol en una sola resposta: l’encert arriba a la casella i avança una casella addicional, sense generar una altra pregunta. Si es falla o no se sap la resposta, la peça es queda al lloc, es perd el torn i es beu doble. Els textos de normes i de resultat ara ho expliquen explícitament.

El motor remot ja aplicava aquesta regla. S’ha conservat i verificat amb [tests/backend/plus-one.sql](../../tests/backend/plus-one.sql), executat mitjançant MCP. [SERVER_REPORT.json](SERVER_REPORT.json) registra sis grups de comprovacions: encert i error en tots dos modes, una sola pregunta, absència de bonificacions encadenades, idempotència, claimant T&P i arribada atòmica a Meta amb un únic resultat. Les fixtures es desfan dins de la transacció i les dades existents es conserven. No s’ha aplicat cap migració nova.

La fusta anterior superposava un retall raster ampliat del fons sobre el tauler. Aquella capa s’ha retirat i s’han dibuixat vetes llargues en SVG. L’ombra es renderitza en una silueta separada perquè el filtre no rasteritzi tota la superfície. Es conserven la paleta, el bisell, el gravat, la ruta, les caselles i les peces.

[BROWSER_REPORT.json](BROWSER_REPORT.json) comprova l’App i els components reals amb vistes locals proporcionades per rutes de navegador, sense Auth ni escriptures a Supabase. Hi ha 12 captures principals i 12 detalls de la vora inferior: pregunta, encert i error, cadascun en 390×844, 1024×768, 1440×900 i desktop amb densitat 2×. Les geometries no presenten desbordament; la fusta no conté imatges raster. El resultat correcte mostra una única acció de següent torn sense controls per respondre una altra pregunta; l’error conserva la posició i mostra dos gots amb el nom. Aquestes vistes són hidratades i no constitueixen una nova prova de la coreografia dinàmica del brindis.

La revisió visual de les captures representatives de mòbil, tauleta i desktop, inclòs el detall inferior 2×, confirma vetes contínues, bisell net, text llegible i controls sencers. Les captures anteriors estan a `audit/plus-board-before/`.

`npm run check` ha passat: TypeScript, 34 proves unitàries en set fitxers i build de producció. Es conserva l’avís existent del bundle superior a 500 kB. Els primers dos intents de la prova SQL han detectat errors de la fixture —nom de columna d’identitat i tipus de l’identificador de pregunta— que s’han corregit abans del resultat PASS; no requereixen canvis al motor del joc.

La còpia anterior als canvis és `/home/pau/Documents/alcoholfabet-plus-board-before-20261009.tar.gz`, amb permisos `0600`. El frontend verificat és el local del port 5173; no s’ha publicat en un allotjament extern.
