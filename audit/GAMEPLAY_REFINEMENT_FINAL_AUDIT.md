# Revisió de beure, abandonament, durada i lectura

Revisió acabada el 9 d’octubre de 2026. Còpia prèvia privada: `/home/pau/Documents/tecla-pau-gameplay-before-20261009.tar.gz` (0600). La implementació, les proves i la neteja estan executades; no queda cap pas manual de Supabase.

El resultat incorrecte mostra un got amb beguda i el nom del respondent autoritatiu, també en reclamacions T&P i en caselles +1. Abandonar confirmat porta directament al menú, inclòs l’altre dispositiu i les recàrregues; un error de xarxa permet tornar a intentar-ho. Les noves partides estimen 30 segons per torn i generen 17/25/38/50 caselles per 20/30/45/60 minuts. El servidor conserva les partides antigues. La ruta llarga es pot inspeccionar per trams sense mutacions del client. El paisatge és més tènue, el text té més contrast i les preguntes llargues queden separades de l’avís en mòbils petits.

## Evidència executada

- `acceptance/gameplay-refinement/LOCAL_CHECK_REPORT.json`: TypeScript, 29 proves unitàries en set fitxers i build PASS. Log final: `CHECK_FINAL_LOG.txt`.
- `GAMEPLAY_E2E_REPORT.json`: tres proves reals PASS, amb Supabase Auth, RPC i Realtime privat. Inclou abandonament amb error recuperable, doble got, T&P amb respondent diferent del torn i recàrrega d’un apuntador abandonat.
- `COMPLETE_GAMES_E2E_REPORT.json`: dues partides completes PASS. L’informe declara els dos runs independents que combina i conserva els intents previs fallits. Verifica META, marcador únic, resposta oculta, +1, T&P simultani, reconnexió i tornar a jugar.
- `DURATION_SERVER_REPORT.json`: migració 0011 aplicada amb MCP; 51 durades suportades, cinc presets persistits, partida de 50 caselles completada amb 87 preguntes sense repetició, idempotència, esgotament atòmic i compatibilitat amb replay antic de 180 minuts. Fixtures SQL desfets dins de la transacció.
- `VISUAL_REPORT.json`: nou captures de portada i selectors als tres formats principals, amb mostreig del contrast i de la luminància. El paisatge perd aproximadament un 37% de luminància mitjana; els avatars queden fora del filtre.
- `SMALL_VIEWPORT_REPORT.json`: 30 captures presentacionals del CSS final als cinc formats, sense Auth/DB. Marge mínim pregunta–resposta/avís 4,8 px; controls mínims 48×48. Les 35 captures reals prèvies no s’han substituït després del retoc final dels mòbils baixos.
- `BUILD_SECURITY_REPORT.json` i `PREVIEW_REPORT.json`: paquet final verificat, sense secrets, fotografies originals ni preguntes crues; quatre fitxers d’avatars v2 preservats byte per byte i miralls idèntics; HTML/JS/CSS/icon servits idèntics al build, sense obrir cap sessió.
- `QA_CLEANUP_REPORT.json`: 18 usuaris, 13 partides i cinc resultats QA retirats. Preservades exactament les 14 partides, sis usuaris i dos resultats no enumerats presents a la comprovació; marcador legítim 1–1. Cap fixture d’aquesta revisió restant.

Els noms d’informe sense prefix són relatius a `acceptance/gameplay-refinement/`. `acceptance/FINAL_ACCEPTANCE_MATRIX.csv` conserva els 88 criteris previs i afegeix quatre criteris de la revisió: 91 PASS i un PARTIAL en total. Aquest recompte inclou evidència històrica; no representa una nova execució de tots els tests anteriors.

## Límits declarats

Els 30 segons són una estimació de durada, sense pas automàtic de torn. El banc finit de 130 preguntes no garanteix acabar qualsevol combinació extrema d’errors i reclamacions; l’esgotament conserva l’estat sense repetir preguntes ni modificar el marcador. Les partides existents mantenen la longitud anterior. La comprovació visual no declara certificació WCAG completa. La fluïdesa de totes les animacions en dispositius físics i Safari conserva la qualificació PARTIAL de l’auditoria anterior.
