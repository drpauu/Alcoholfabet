# Estratègia per millorar una aplicació existent

## No fer

- No començar un projecte nou sense inspeccionar l'actual.
- No eliminar integració Supabase que funciona.
- No substituir tota la lògica per mocks per poder ensenyar una UI bonica.
- No afegir motion abans de separar estat confirmat i estat visual.

## Auditoria inicial

1. Executa build i tests.
2. Identifica rutes i fases del joc.
3. Localitza components visuals.
4. Localitza la capa Supabase.
5. Comprova si la resposta correcta arriba al respondent.
6. Comprova marcador i idempotència.
7. Captura screenshots de tots els breakpoints.

## Classificació

### Conservar

- Regles correctes.
- Esquema segur.
- Funcions idempotents.
- Fluxos E2E que passen.

### Refactoritzar

- Components que barregen dades i presentació.
- Estats amb molts booleans.
- Subscripcions Realtime duplicades.
- Estils no tokenitzats.

### Substituir

- Dashboard o cards genèriques.
- Tauler rectangular sense profunditat.
- Fitxes que teletransporten.
- Avatars inconsistents.
- Efectes basats només en fade.
- Respostes amagades al client incorrecte.

## Ordre recomanat

1. Congela contractes de dades.
2. Integra design tokens.
3. Construeix `GameScene` i tauler SVG.
4. Substitueix targeta i HUD.
5. Integra assets.
6. Afegeix orchestrator d'efectes.
7. Connecta efectes a versions confirmades.
8. Executa visual regression.
9. Repara responsive.
10. Revalida seguretat i online.
