# 09 — Model de dades

Vegeu `diagrams/erd.svg` i `supabase/migrations/`.

## Entitats

### couples

Identitat de la parella i àmbit del marcador.

### authorized_devices

Sessions anònimes autoritzades a entrar al joc privat.

### questions

Banc de preguntes i respostes. Sense `SELECT` directe per a clients normals.

### games

Snapshot autoritatiu de la partida:

- mode;
- estat;
- fase;
- torn;
- pregunta;
- posicions;
- versió;
- guanyador.

### game_members

Relació entre sessió i rol dins d'una partida.

### game_cells

Recorregut immutable de la partida.

### game_question_usage

Evita repetir preguntes i registra resultats.

### game_events

Traça d'accions, idempotència i telemetria bàsica.

### match_results

Resultats finalitzats. `game_id` únic. És la font del marcador.

## Marcador

No desar `pau_wins` i `tecla_wins` com comptadors mutables si es pot derivar de `match_results`.

RPC o vista:

- `pau_wins`.
- `tecla_wins`.
- `completed_games`.

## Restriccions clau

- `questions.answer_ca`: 1-5 paraules.
- `games.invite_code`: únic.
- `game_cells`: clau `(game_id, position)`.
- `game_question_usage`: una pregunta com a màxim una vegada per partida.
- `game_events.idempotency_key`: únic.
- `match_results.game_id`: únic.
- Un sol membre `PAU` i un sol membre `TECLA` per partida online.

## Telemetria mínima

En events o camps derivats:

- inici del torn;
- resolució;
- nombre de preguntes;
- encerts;
- durada de partida;
- reconnexions.

No crear un dashboard per defecte.
