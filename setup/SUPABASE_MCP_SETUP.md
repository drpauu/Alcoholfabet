# Connexió de Codex a Supabase

Projecte:

- Nom: `Tecla&Pau`
- Project ref: `lhgyopkwstuyxolwfucq`
- URL: `https://lhgyopkwstuyxolwfucq.supabase.co`

## MCP recomanat

Utilitza el servidor MCP oficial de Supabase limitat a aquest projecte i només als grups necessaris:

```text
https://mcp.supabase.com/mcp?project_ref=lhgyopkwstuyxolwfucq&features=docs%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions
```

Configuració Codex:

```powershell
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=lhgyopkwstuyxolwfucq&features=docs%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions"
codex mcp login supabase
codex mcp list
```

Després, dins de Codex, comprova `/mcp`.

## Principis de seguretat

- No afegeixis `service_role` al frontend.
- No introdueixis la contrasenya de base de dades al repositori.
- No habilitis accés a altres projectes de l'organització.
- Revisa les migracions destructives abans d'aplicar-les.
- El servidor MCP està limitat per `project_ref`.
- Per a una auditoria sense escriptures, afegeix temporalment `read_only=true`.

## Configuració Supabase esperada

- Data API: activada.
- Exposició automàtica de taules noves: desactivada.
- RLS automàtica: activada.
- Realtime public access: desactivat per als canals de producció.
- Canals del joc: privats.

## Variables frontend

Vite:

```env
VITE_SUPABASE_URL=https://lhgyopkwstuyxolwfucq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=SET_LOCALLY
```

Next.js:

```env
NEXT_PUBLIC_SUPABASE_URL=https://lhgyopkwstuyxolwfucq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=SET_LOCALLY
```

La publishable key es pot utilitzar al navegador quan les polítiques RLS són correctes, però no s'ha d'utilitzar com a credencial administrativa.
