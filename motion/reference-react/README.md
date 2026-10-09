# Implementació React de referència

Aquests fitxers mostren patrons concrets per integrar els efectes sense lligar el producte a una llibreria d'animació concreta.

Principis:

- Web Animations API per a transformacions simples.
- CSS per a aparença.
- `GameEventOrchestrator` deduplica per `stateVersion`.
- `AudioManager` es desbloqueja després de la primera interacció.
- Les animacions només s'executen després d'un estat confirmat pel servidor.

Codex pot adaptar aquests components al projecte actual. No ha de copiar-los cegament si ja hi ha una arquitectura millor.
