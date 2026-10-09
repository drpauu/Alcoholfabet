# Brindis central — revisió visual executada

S’han inspeccionat les captures del got senzill a 390×844, 1024×768 i 1440×900, el brindis doble de la Tecla a 390×844 i el got doble estàtic d’en Pau a 390×844 amb moviment reduït. El got és gran, transparent i definit; la beguda d’ambre, els glaçons i els reflexos mantenen l’estil càlid del joc. El nom blau o rosa i «ha de beure» destaquen sobre la partida enfosquida. La penalització doble apareix amb dos gots i «Beu doble · ×2».

La composició completa queda al centre exacte del viewport. El vidre ocupa 248–319 px d’alçada segons variant i mida abans de la inclinació. No s’amplia cap bitmap. La geometria del tauler es conserva i els controls esperen que acabi l’efecte.

`BROWSER_REPORT.json` registra 16 casos executats en Chromium: got senzill i doble en 360×800, 390×844, 430×932, 1024×768 i 1440×900; les variants de moviment reduït en les tres mides principals. S’hi comproven centre, mida, SVG, nom, penalització, moviment del got i del líquid, deu partícules, absència de scroll, deduplicació i neteja. Les tres comprovacions addicionals cobreixen desconnexió/reconnexió, retorn al menú i hidratació/recàrrega d’un RESULT confirmat.

El navegador executa els components, el hook, el runner, el gestor d’àudio i l’orquestrador de producció amb vistes confirmades locals de prova. No s’ha executat una nova partida amb Supabase ni s’han creat usuaris. Els registres de cues verifiquen la selecció i la deduplicació dels sons, no la seva qualitat audible. El vídeo `videos/double-tecla-390x844.webm` conserva la reproducció real del brindis doble en aquest navegador. Les proves no certifiquen el rendiment de dispositius físics o Safari.

Les sis captures prèvies es conserven a `audit/drink-stage-before/`. El backup anterior als canvis té permisos 0600. Les proves de TypeScript, build i 31 tests unitaris han passat.
