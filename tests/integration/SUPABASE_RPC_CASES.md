# Casos d'integració Supabase

- `create_game` amb idempotency key repetida retorna la mateixa partida.
- `join_game_by_code` rebutja un rol ocupat.
- `start_game` rebutja si falta un jugador.
- `BEGIN_TURN` selecciona una pregunta APPROVED no utilitzada.
- `REVEAL_ANSWER` només funciona en persona.
- `CLAIM_TP` simultani deixa un sol claimant.
- El respondent online no pot executar JUDGE.
- El jutge contrari sí pot executar JUDGE.
- `JUDGE_CORRECT` aplica moviment i +1 sense encadenar.
- `JUDGE_INCORRECT` deixa posició intacta i registra drinkCount.
- `NEXT_TURN` alterna des del torn original, no des del claimant T&P.
- Arribar a META finalitza i insereix un sol match_result.
- `ABANDON_GAME` no crea match_result.
- `state_version` antiga falla.
- Un usuari no membre no pot executar RPC de la partida.
