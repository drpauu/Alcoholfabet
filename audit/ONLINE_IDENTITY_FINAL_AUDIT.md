# Auditoria final — identitat en línia

El menú i el mode presencial continuen accessibles sense codi. La migració 0013 assigna PAU o TECLA a partir dels dos codis configurats i exigeix aquella identitat al servidor per crear o entrar en una partida en línia. El codi de sala té una funció separada: unir els dispositius a la mateixa partida. L’estat, les posicions i el marcador continuen gestionats pel motor autoritatiu existent.

L’auditoria inicial ha verificat Anonymous Auth activat i una entrada real correcta amb una sessió nova. El bloqueig d’entrada descrit per l’usuari no s’ha reproduït amb aquesta sessió. Ara es comprova la validesa del compte emmagatzemat, es recuperen les credencials rebutjades per Auth i es mostren els errors d’inici amb l’opció de reintentar. Una fallada temporal de xarxa conserva la sessió existent.

La implementació i la configuració del servidor s’han executat i verificat. Han passat 34 unitàries, TypeScript, el build, cinc comprovacions dedicades amb dos contexts reals i dues suites SQL transaccionals. Les captures cobreixen els tres formats requerits. No hi ha credencials noves al repositori ni al paquet públic. Els informes i els límits de les comprovacions són a [acceptance/online-identity/README.md](../acceptance/online-identity/README.md).

La migració remota aplicada és `online_player_identity`, versió `20261009161414`. La configuració dels dos codis està completada; no queda cap pas manual al Dashboard per aquest canvi. La neteja limitada als identificadors QA ha eliminat sis usuaris anònims i dues partides abandonades, mantenint les dades no llistades i els codis. No s’ha publicat el frontend en un allotjament extern.
