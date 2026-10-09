# 07 — Arquitectura

Vegeu també `diagrams/architecture.svg`.

## Capes

### Presentació

React components:

- Pantalles.
- Tauler SVG.
- Targetes.
- Controls.
- Modals.
- Estats de connexió.

No contenen SQL ni lògica d'autorització.

### Domini

Funcions pures:

- Generació de tauler.
- Resolució de categoria.
- Regles +1.
- Durada.
- Transicions locals d'animació.
- Tipus i invariants.

### Aplicació

- Orquestració de fluxos.
- Hooks de partida.
- Màquina d'estats de UI.
- Adaptació de vistes servidor.
- Gestió d'àudio.

### Infraestructura

- Client Supabase.
- Auth anònima.
- RPCs.
- Realtime.
- Storage si cal.
- Persistència local només per preferències no crítiques.

### Servidor

Supabase/PostgreSQL:

- Font de veritat.
- Autorització.
- Preguntes.
- Estat de partida.
- Resultats.
- Idempotència.
- Reclamació T&P atòmica.

## Flux de mutació

1. Usuari prem una acció.
2. Client genera `idempotency_key`.
3. Envia acció amb `expected_state_version`.
4. RPC valida sessió, dispositiu, membre, rol, fase, versió i idempotència.
5. RPC persisteix estat i event.
6. Incrementa `state_version`.
7. Emet `GAME_UPDATED` o el client detecta canvi.
8. Tots dos clients criden `get_game_view`.
9. Cada client rep una vista filtrada.
10. La UI anima la diferència entre versió anterior i nova.

## Estructura recomanada

```text
src/
  app/
  components/
  content/
  domain/game/
  features/access/
  features/home/
  features/setup/
  features/lobby/
  features/board/
  features/question/
  features/result/
  features/reconnect/
  features/finished/
  services/supabase/
  services/realtime/
  services/audio/
  styles/
```

## Decisions

- PostgreSQL és font de veritat.
- Broadcast no conté secrets ni respostes.
- Presence només indica connexió.
- Cap marcador crític en `localStorage`.
- Preferències de so i moviment sí que poden ser locals.
- La ruta i preguntes usades es persisteixen.
