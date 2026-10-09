# 16 — Contractes API

## Patró de resposta

Totes les RPCs retornen errors estables, no missatges arbitraris.

Exemple d'èxit:

```json
{
  "ok": true,
  "view": { "game": {}, "viewer": {}, "board": [], "question": null },
  "event": { "type": "GAME_UPDATED", "stateVersion": 12 }
}
```

Exemple d'error:

```json
{
  "ok": false,
  "error": {
    "code": "STALE_STATE",
    "messageCa": "La partida ha canviat. S'està actualitzant…",
    "currentStateVersion": 13
  }
}
```

## create_game

Entrada:

```json
{
  "mode": "ONLINE",
  "targetMinutes": 30,
  "creatorRole": "PAU",
  "startingPlayer": "PAU",
  "idempotencyKey": "uuid"
}
```

Sortida: vista segura, codi d'invitació i enllaç.

## join_game_by_code

Entrada:

```json
{
  "inviteCode": "T7K9P2",
  "role": "TECLA",
  "idempotencyKey": "uuid"
}
```

## apply_game_action

Entrada comuna:

```json
{
  "gameId": "uuid",
  "expectedStateVersion": 8,
  "idempotencyKey": "uuid",
  "action": { "type": "JUDGE_CORRECT" }
}
```

## get_game_view

Retorna:

- `game`: snapshot no sensible.
- `viewer`: rol de la sessió.
- `board`: recorregut.
- `question`: resposta només si està autoritzada.
- `capabilities`: botons que la UI pot habilitar.

La UI pot usar `capabilities`, però el servidor ha de tornar a validar l'acció.

## Codis d'error recomanats

- `NOT_AUTHENTICATED`.
- `DEVICE_NOT_AUTHORIZED`.
- `NOT_GAME_MEMBER`.
- `ROLE_ALREADY_TAKEN`.
- `GAME_NOT_JOINABLE`.
- `INVALID_PHASE`.
- `ACTION_NOT_ALLOWED`.
- `STALE_STATE`.
- `DUPLICATE_ACTION`.
- `QUESTION_POOL_EMPTY`.
- `GAME_ALREADY_FINISHED`.
- `CONNECTION_REQUIRED`.
