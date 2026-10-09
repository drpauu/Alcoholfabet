# Auditoria abans del redisseny integral

Executada l’app existent contra Supabase real, sense mocks. 34 captures a `audit/art-redesign-before/`; cap error JavaScript. `npm run check`: TypeScript, 18 unitàries i build passen. Còpia de fonts, assets i documentació: `/home/pau/Documents/tecla-pau-app-before-art-redesign-20261009.tar.gz`, permisos 600; exclou dependències reproduïbles, build i `.env.local`.

| Àrea | Decisió | Motiu |
|---|---|---|
| Paisatge i avatars | Conservar | Obra aprovada i identitat consistent |
| Backend, sessions, vistes segures | Conservar | Fluxos provats i regles al servidor |
| Coordinades i contractes de motion | Conservar/refactoritzar | Moviment funcional; cap teletransport |
| Base i caselles del tauler | Substituir | Cinta plana, símbols infantils, absència d’objecte físic complet |
| Peces | Substituir | Mateixa forma de peó i inicials, volum digital brillant |
| Botons, targetes, HUD i panells | Substituir | Materials massa llisos, validació amb pes desigual, contrast d’estil amb el paisatge |
| Icones i efectes | Substituir/refactoritzar | Unificar traç, pigment i matèria; conservar la seqüència confirmada |
| Composició responsive | Refactoritzar | Conservar llegibilitat i absència de scroll; integrar el tauler físic i reduir buits |

El paisatge s’ha inspeccionat en els dos formats. La direcció de llum s’adapta al sol del fons a la dreta i al rebot càlid de la taula. El detall del sistema queda definit a `docs/ART_SYSTEM.md` abans de propagar-lo.
