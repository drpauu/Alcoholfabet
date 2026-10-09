#!/usr/bin/env sh
set -eu
MCP_URL='https://mcp.supabase.com/mcp?project_ref=lhgyopkwstuyxolwfucq&features=docs%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions'
codex mcp add supabase --url "$MCP_URL"
codex mcp login supabase
codex mcp list
printf '%s\n' 'Fet. Obre Codex i comprova /mcp.'
