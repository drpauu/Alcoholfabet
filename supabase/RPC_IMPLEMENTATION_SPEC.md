# RPC implementation specification

`0001`-`0003` provide the schema, RLS and safe reads. The implementation agent must add reviewed write RPCs. Do not expose direct table mutations.

## Common envelope

Every mutating RPC receives:

- `p_game_id uuid` when applicable.
- `p_expected_state_version bigint`.
- `p_idempotency_key uuid`.
- typed action payload.

Every function:

1. requires `auth.uid()`;
2. verifies authorized device;
3. verifies game membership and role;
4. checks whether `idempotency_key` already exists;
5. locks the game row `FOR UPDATE`;
6. compares `state_version`;
7. validates status and phase;
8. applies the mutation;
9. inserts `game_events`;
10. increments `state_version` exactly once;
11. returns `get_game_view` for the caller.

## create_game

Inputs:

- mode;
- target minutes;
- creator role (`PAU`, `TECLA`, or `IN_PERSON_CONTROLLER`);
- starting player;
- idempotency key.

Server responsibilities:

- calculate finish position;
- generate invite code without ambiguous characters;
- generate deterministic board cells;
- insert game and member in one transaction;
- status `LOBBY` for online, `READY` for in-person;
- never trust a client-provided board.

## join_game_by_code

- Normalize code.
- Lock game.
- Require `LOBBY` and `ONLINE`.
- Require requested role `PAU` or `TECLA`.
- Reject occupied role.
- Insert member idempotently.

## start_game

- In online mode require both PAU and TECLA members.
- Set `ACTIVE`, `TURN_INTRO`, timestamps and first target cell.
- Select an approved question only when beginning the first turn.

## apply_game_action

Actions:

- `BEGIN_TURN`.
- `REVEAL_ANSWER`.
- `CLAIM_TP`.
- `JUDGE_CORRECT`.
- `JUDGE_INCORRECT`.
- `NEXT_TURN`.
- `ABANDON_GAME`.

### BEGIN_TURN

- Determine next cell.
- Determine pool.
- Select an unused APPROVED question.
- Insert usage.
- Set `responding_player`.
- Phase `TP_OPEN` for TP, otherwise `QUESTION`.

### REVEAL_ANSWER

- Only in-person controller.
- Phase `QUESTION` or `TP_CLAIMED`.
- Set `ANSWER_REVEALED`.

### CLAIM_TP

- Only role matching claimant.
- Phase must be `TP_OPEN`.
- `tp_claimant` must be null.
- Update atomically; exactly one winner.
- Set `responding_player` and phase `TP_CLAIMED`.

### JUDGE_CORRECT

- Validate judge permission.
- Move respondent to target cell.
- If target has `PLUS_ONE`, also move one additional cell without chaining.
- Update usage result.
- If position reaches finish, call internal finish logic.
- Otherwise set `RESULT` and include movement metadata in event payload.

### JUDGE_INCORRECT

- Validate judge permission.
- Position unchanged.
- Event payload contains drink count 1 or 2.
- Update usage result.
- Set `RESULT`.

### NEXT_TURN

- Clear question, target, claimant and respondent.
- Switch current turn based on original turn, not TP claimant.
- Increment turn number.
- Set `TURN_INTRO`.

### ABANDON_GAME

- Set `ABANDONED`.
- Never insert a match result.

## finish_game internal

Inside same transaction:

- require game was ACTIVE;
- validate winner reached finish;
- set FINISHED, FINISHED phase, winner, finished_at;
- insert match_results with unique game_id;
- no double score on retry.
