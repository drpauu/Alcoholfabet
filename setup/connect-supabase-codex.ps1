$ErrorActionPreference = "Stop"

$McpUrl = "https://mcp.supabase.com/mcp?project_ref=lhgyopkwstuyxolwfucq&features=docs%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions"

Write-Host "Afegint el MCP oficial de Supabase a Codex..."
codex mcp add supabase --url $McpUrl

Write-Host "Obrint autenticacio OAuth de Supabase..."
codex mcp login supabase

Write-Host "Servidors MCP configurats:"
codex mcp list

Write-Host "Fet. Obre Codex i comprova /mcp."
