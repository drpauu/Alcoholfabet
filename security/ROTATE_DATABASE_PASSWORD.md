# Acció de seguretat obligatòria

La contrasenya de projecte/base de dades compartida durant la conversa s'ha de considerar exposada.

Abans de producció:

1. Canvia-la al Dashboard de Supabase.
2. Actualitza només els entorns que realment la necessitin.
3. No la copiïs al repositori, prompts, `.env.example`, captures o documentació.
4. Utilitza OAuth del MCP de Supabase, publishable key per al client i secrets de servidor per a Edge Functions.

Aquest paquet no conté la contrasenya ni cap `service_role` key.
