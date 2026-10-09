# AGENTS.md — regles persistents Tecla&Pau

## Regles absolutes

- Llegeix `MASTER_PROMPT_CODEX_SOL_ULTRA.md` abans de canviar codi.
- No exposis secrets ni contrasenyes.
- No publiquis les fotografies originals.
- No enviïs la resposta correcta al respondent online.
- No permetis mutacions directes de torn, posició o marcador des del client.
- El marcador només canvia quan una partida arriba formalment a META.
- T&P es resol atòmicament al servidor.
- Mantén el català correcte a tota la UI.
- No regeneris avatars inconsistents.
- No utilitzis la referència composta com un únic background.
- No converteixis el producte en una UI SaaS.
- No introdueixis funcionalitats fora d'abast abans d'acabar els fluxos principals.

## Qualitat visual

- Utilitza `design/` i `motion/` com a font de veritat.
- Verifica 390x844, 1024x768 i 1440x900 després de canvis visuals amplis.
- Els efectes s'han d'orquestrar amb `motion/event-choreography.json`.
- Una simple transició d'opacitat no substitueix una animació especificada.
- Utilitza els avatars i peces inclosos.

## Supabase

- Project ref: `lhgyopkwstuyxolwfucq`.
- Utilitza MCP de Supabase quan sigui disponible.
- Canals Realtime privats.
- RLS a totes les taules exposades.
- PostgreSQL és la font de veritat.
- Broadcast només notifica; cada client recupera una vista segura.

## Disciplina de treball

- Audita abans de reescriure.
- Fes commit o backup abans de canvis amplis.
- Executa tests després de cada fase.
- No donis una tasca per acabada sense executar-la.
- Quan una eina externa bloquegi una tasca, documenta el bloqueig i continua la resta.
