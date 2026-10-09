# Ritme de les animacions i pantalla de durada

Les animacions principals tenen un 50% més de durada. El brindis passa de 2.400 a 3.600 ms, el gir de targeta de 280 a 420 ms, el pas de peça de 420 a 630 ms i la victòria de 2.300 a 3.450 ms. El JSON coordina també les pauses i els sons. Els totals de moviment i T&P es calculen des dels passos, de manera que els controls esperen que acabi la seqüència. El moviment reduït conserva el seu ritme breu i el brindis estàtic de 900 ms.

S’ha retirat el paràgraf d’estimació de la pantalla de durada i el seu text del contingut de producció. La frase tampoc apareix al build. Les sis proves de configuració passen en presencial i en línia a 390×844, 1024×768 i 1440×900. S’han inspeccionat les captures dels tres formats; no hi ha desbordament i funcionen Continuar i Enrere. S’ha utilitzat l’App real amb un fixture de sessió injectat només al navegador, sense crear sessions ni partides a Supabase.

El brindis de producció supera 16 casos en Chromium, incloent-hi les variants amb moviment reduït i les cinc mides de pantalla. La durada visible mesurada en motion normal és de 3.615–3.682 ms. Passen també desconnexió/reconnexió, retorn al menú i recàrrega, amb deduplicació i sense partícules o bloquejos residuals. Les captures i el vídeo són a `drink/`. Les comprovacions executen components, hook, runner i àudio de producció amb vistes locals confirmades de prova; no reexecuten partides reals amb Supabase.

TypeScript, les 31 proves unitàries i el build han passat. El backup anterior té permisos 0600 i les tres captures prèvies de configuració són a `audit/animation-tempo-before/`. Els informes anteriors es conserven. No s’han aplicat migracions ni calen accions manuals.
