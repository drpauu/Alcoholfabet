# 14 — Proves i acceptació

## Unitàries

- Durada → longitud.
- Distribució de categories.
- Restriccions +1.
- No encadenar +1.
- Canvi de torn.
- Selecció de pila.
- T&P.
- Arribada a META.
- No repetir pregunta.
- Validació de 1-5 paraules.

## Integració Supabase

- Accés privat.
- Anonymous Auth.
- Crear partida.
- Unir-se.
- Evitar rol duplicat.
- RLS.
- Vista d'en Pau.
- Vista de la Tecla.
- Resposta absent per al respondent.
- Reclamació T&P concurrent.
- Versió antiga rebutjada.
- Idempotència.
- Finalització única.
- Abandonament sense resultat.

## E2E

Dos contexts de navegador:

- Context A: en Pau.
- Context B: la Tecla.

Flux:

1. En Pau crea.
2. La Tecla entra.
3. Presence confirma tots dos.
4. Comença.
5. Es valida una pregunta normal.
6. Es valida error.
7. Es resol T&P.
8. Es resol +1.
9. Un dispositiu recarrega.
10. Un dispositiu perd i recupera xarxa.
11. S'arriba a META.
12. Marcador suma una vegada.
13. Recarregar no torna a sumar.

## Responsive

Validar:

- 360×800.
- 390×844.
- 430×932.
- 768×1024.
- 1024×768.
- 1366×768.
- 1440×900.

## Seguretat

- Cap secret al bundle.
- Cap `service_role` al client.
- `questions` no és consultable directament.
- `match_results` no és inserible pel client.
- Posicions no són actualitzables directament.
- Realtime privat.
- Resposta no és present al JSON del respondent.

## Acceptació visual

- Sitges recognoscible.
- Sense càmera.
- Sense llibreta amb `Sitges`.
- Avatars consistents.
- Pau blau, Tecla rosa.
- Targetes amb aparença de paper.
- Tauler amb profunditat.
- No sembla SaaS.
- Mòbil jugable sense scroll normal.

## Definition of Done

- Build passa.
- Tests crítics passen.
- No hi ha errors importants de consola.
- Fluxos complets.
- Català revisat.
- Documentació actualitzada.
