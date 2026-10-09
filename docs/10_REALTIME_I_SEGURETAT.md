# 10 — Realtime i seguretat

## Model de confiança

El navegador no és de confiança. Pot demanar una acció, però no decideix el resultat.

## Autenticació

- Supabase Anonymous Auth.
- Cada dispositiu obté `auth.uid()`.
- L'accés al joc requereix un codi privat validat en Edge Function.
- La funció crea o actualitza `authorized_devices`.
- El secret o hash només existeix al servidor.

## RLS

Activa RLS a totes les taules exposades.

Clients normals:

- poden llegir només partides on són membres;
- poden llegir caselles i events de la seva partida;
- poden llegir el marcador de la seva parella si estan autoritzats;
- no poden llegir `questions` directament;
- no poden inserir `match_results`;
- no poden actualitzar posicions, torns o guanyador directament;
- no poden autoritzar dispositius.

## RPCs

Les funcions `SECURITY DEFINER` han de:

- fixar `search_path`;
- validar `auth.uid()`;
- validar dispositiu autoritzat;
- validar membre i rol;
- validar fase i estat;
- validar `expected_state_version`;
- comprovar `idempotency_key`;
- fer la mutació dins d'una transacció;
- escriure event;
- retornar vista segura.

## Realtime

Canal privat:

```text
game:<game_id>
```

- Presence: connexió d'en Pau i la Tecla.
- Broadcast: només avisos com `GAME_UPDATED`, sense resposta correcta.
- En rebre avís, cridar `get_game_view`.
- Ignorar versions antigues.

## Reconnexió

1. Bloquejar accions.
2. Restablir auth.
3. Reobrir canal privat.
4. Tornar a publicar Presence.
5. Recuperar `get_game_view`.
6. Comparar `state_version`.
7. No reproduir una mutació antiga.
8. Rehabilitar controls.

## Resposta correcta

El servidor calcula:

- qui respon;
- qui jutja;
- si el mode és presencial;
- si la resposta s'ha revelat;
- si és una T&P reclamada.

Només inclou `answerCa` quan la sessió té permís.

## T&P atòmic

`CLAIM_TP` ha de bloquejar o actualitzar condicionalment la fila de partida:

- només si fase = `TP_OPEN`;
- només si `tp_claimant IS NULL`;
- incrementa versió;
- la segona petició rep conflicte o l'estat actual.

## Finalització idempotent

Dins d'una sola transacció:

1. Verificar `ACTIVE`.
2. Verificar posició >= META.
3. Marcar `FINISHED`.
4. Assignar `winner` i `finished_at`.
5. Inserir `match_results` amb `ON CONFLICT(game_id) DO NOTHING` o equivalent.
6. Escriure event.
7. Incrementar versió.
