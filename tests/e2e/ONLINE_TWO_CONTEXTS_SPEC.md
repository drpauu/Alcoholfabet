# E2E — dos contexts online

## Contextos

- Context A: sessió anònima d'en Pau.
- Context B: sessió anònima de la Tecla.

## Flux

1. Autoritza els dos dispositius.
2. En Pau crea partida online.
3. La Tecla entra amb codi.
4. Presence mostra els dos connectats.
5. Inicia partida.
6. Comença torn d'en Pau.
7. Context A rep pregunta sense resposta.
8. Context B rep pregunta amb resposta i controls.
9. Context B marca correcte.
10. Els dos contexts recuperen nova vista.
11. Els dos veuen el mateix moviment una sola vegada.
12. Prova error.
13. Prova +1.
14. Obre T&P i prem els dos botons amb menys de 50 ms de diferència.
15. Només una RPC és acceptada.
16. Recarrega Context A durant la partida.
17. Recupera exactament fase i posicions.
18. Talla xarxa de Context B, valida overlay i bloqueig.
19. Recupera xarxa i comprova que no es repeteix moviment.
20. Arriba a META.
21. `match_results` conté una fila.
22. Recarrega final; el marcador no torna a incrementar.
23. Crea una altra partida i abandona-la; marcador intacte.

## Assertions de seguretat

- `answerCa` no apareix en cap resposta de xarxa del respondent.
- `answerCa` no apareix al DOM del respondent.
- Un tercer context no membre no pot subscriure's a `game:<id>`.
- UPDATE directe a `games` falla.
- INSERT directe a `match_results` falla.
