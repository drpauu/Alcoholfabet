# 08 — Màquina d'estats

Vegeu `diagrams/state_machine.svg`.

## Fases

- `LOBBY`
- `READY`
- `TURN_INTRO`
- `QUESTION`
- `TP_OPEN`
- `TP_CLAIMED`
- `ANSWER_REVEALED`
- `JUDGING`
- `RESULT`
- `MOVING`
- `BETWEEN_TURNS`
- `FINISHED`

## Transicions normals

```text
LOBBY -> READY -> TURN_INTRO
TURN_INTRO -> QUESTION
QUESTION -> JUDGING                 online normal
QUESTION -> ANSWER_REVEALED         presencial normal
ANSWER_REVEALED -> JUDGING
JUDGING -> RESULT
RESULT -> MOVING                    si hi ha moviment
RESULT -> BETWEEN_TURNS             si no hi ha moviment
MOVING -> BETWEEN_TURNS
BETWEEN_TURNS -> TURN_INTRO
qualsevol fase activa -> FINISHED   només quan s'arriba a META
```

## T&P

```text
TURN_INTRO -> TP_OPEN
TP_OPEN -> TP_CLAIMED
TP_CLAIMED -> JUDGING               online
TP_CLAIMED -> ANSWER_REVEALED       presencial
```

## Invariants

- Només hi ha una fase activa.
- `current_question_id` existeix en fases de pregunta i resolució.
- `tp_claimant` només existeix després d'una reclamació acceptada.
- `winner` només existeix en `FINISHED`.
- No es pot jutjar una pregunta dues vegades.
- No es pot avançar una peça des del client.
- No es pot passar de torn abans de resoldre el resultat.
- `state_version` augmenta en cada mutació acceptada.

## Accions

- `BEGIN_TURN`
- `REVEAL_ANSWER`
- `CLAIM_TP`
- `JUDGE_CORRECT`
- `JUDGE_INCORRECT`
- `NEXT_TURN`
- `ABANDON_GAME`

Cada acció defineix fases d'origen vàlides i permisos per rol.
