# 17 — Estats d'error

## Xarxa

- Sense connexió: bloquejar controls i reconnectar.
- Timeout: oferir `Torna-ho a provar` només si l'acció és idempotent.
- Backend pausat o no disponible: missatge clar, sense perdre estat local visible.

## Partida

- Codi inexistent: `No hem trobat aquesta partida.`
- Codi caducat o partida començada: `Aquesta partida ja no admet participants.`
- Rol ocupat: `Aquest lloc ja està ocupat.`
- Estat antic: refetch automàtic i `La partida s'ha actualitzat.`
- Preguntes exhaurides: no avançar fase; mostrar error recuperable i registrar-lo.

## Accés privat

- Codi incorrecte: `El codi no és correcte.`
- Massa intents: aplicar limitació de velocitat a l'Edge Function.
- Dispositiu revocat: tornar a pantalla d'accés.

## UI

- Asset no disponible: fallback gràfic coherent.
- So bloquejat: continuar silenciosament.
- Wake Lock no disponible: ignorar sense error.
- Orientació no detectable: continuar amb el layout que càpiga millor.

## Regla

No mostrar traces SQL, IDs sensibles, secrets ni missatges interns a l'usuari.
