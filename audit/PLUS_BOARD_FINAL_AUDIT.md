# Auditoria final — +1 i fusta del tauler

S’han conservat el motor de joc autoritatiu, les respostes filtrades, la identitat en línia, els canals privats, el marcador i la coreografia. El servidor ja resolia el +1 amb dues caselles per encert i penalització doble sense moviment per error; la nova regressió SQL verifica també una sola pregunta, pas de torn, T&P, idempotència i Meta. Les dades QA es desfan íntegrament.

S’ha substituït la capa raster ampliada sobre la fusta per vetes SVG i s’ha separat el filtre d’ombra de la cara del tauler. No s’han canviat la ruta ni els punts de moviment. Les normes i el resultat d’encert expliciten que el segon pas no requereix pregunta; una resposta desconeguda es valida com a incorrecta.

Han passat TypeScript, 34 unitàries, build, sis grups de comprovacions SQL contra el projecte real i 12 casos visuals amb vistes locals. S’han revisat les mides requerides i el detall de la vora inferior a densitat 2×. Vegeu [l’evidència i els límits](../acceptance/plus-board/README.md). No cal cap migració ni acció manual al Dashboard per aquesta revisió.
