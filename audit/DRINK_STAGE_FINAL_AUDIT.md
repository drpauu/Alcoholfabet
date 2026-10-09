# Brindis central d’Alcoholfabet

La petició posterior de l’usuari requereix un got gran, nítid i fluid al centre de la pantalla. La targeta i el tauler es conserven. Es substitueix el brindis petit de la targeta per una capa temporal de producció, amb un SVG que separa vidre, beguda, glaçons, reflexos i condensació. La penalització permanent i accessible continua a la targeta.

`DrinkCelebration` es munta amb un portal al `body`, fora de les transformacions de la càmera. `useGameMotion` espera el muntatge abans d’executar la coreografia de 2.400 ms. El JSON defineix tots els temps, inclòs el so del brindis a 620 ms i la sortida a 2.100 ms. Beure doble coordina dos gots que s’inclinen i es recuperen. Amb moviment reduït es conserva una presentació estàtica de 900 ms.

L’efecte rep el respondent de l’esdeveniment confirmat, no el jugador del torn següent. Un test cobreix específicament T&P. La recàrrega i les notificacions duplicades no tornen a muntar el brindis. Desconnexió, retorn al menú i canvi de partida el cancel·len.

Verificació executada: sis captures de baseline; `npm run check` amb TypeScript, 31 proves unitàries i build; 16 casos en Chromium a cinc mides i tres comprovacions de cicle de vida. Resultats, captures i vídeo a `acceptance/drink-stage/`. No s’han aplicat migracions, creat fixtures persistents ni modificat dades a Supabase. No queden accions manuals necessàries.

Backup: `/home/pau/Documents/alcoholfabet-drink-stage-before-20261009.tar.gz`, amb permisos 0600. Les modificacions preexistents de l’usuari s’han preservat. Els informes anteriors descriuen les revisions anteriors i es conserven.
