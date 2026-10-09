# Regla per a l'agent

No acabis la sessió amb frases com:

- "He preparat el pla".
- "A continuació implementaria".
- "Pots executar aquestes migracions".
- "Aquí tens un exemple".

El resultat esperat és codi modificat i verificat.

Quan una operació necessita OAuth, aprovació de migració o un secret:

1. Demana només aquella acció concreta.
2. Continua totes les tasques que no depenen del bloqueig.
3. Torna a la tasca bloquejada quan hi hagi accés.
4. No marquis-la com a completada sense verificació.
