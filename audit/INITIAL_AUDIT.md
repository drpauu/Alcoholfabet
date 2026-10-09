# Auditoria inicial

El repositori rebut conté un paquet de fonts de veritat i starters, sense package.json, servidor frontend, rutes, aplicació React ni repositori Git. Per tant no existeix cap partida executable de base. S'ha executat el laboratori original amb Chromium real i capturat a 390×844, 1024×768 i 1440×900 (audit/baseline).

Còpia íntegra abans de modificar: /home/pau/Documents/tecla-pau-app-before-implementation.tar.gz.

| Àrea | Decisió | Motiu |
|---|---|---|
| Assets de producció, tokens i copy | Conservar | Fonts aprovades; no es publiquen fotografies privades |
| Durades, pools i resolució pura | Conservar/refactoritzar | Regles correctes, generador necessita garantir restriccions |
| Exemple React de motion | Substituir implementació | Peça teletransportada, flip prematur i deduplicació massa ampla |
| SQL esquema/seed | Conservar/reforçar | 130 preguntes aprovades; reforçar permisos i transaccions |
| SQL RPC/vista | Refactoritzar | Validació de dispositiu i idempotència incompletes |
| UI de joc | Construir | No existeix encara |

MCP verificat sobre lhgyopkwstuyxolwfucq: esquema public inicialment buit, sense migracions ni Edge Functions.
