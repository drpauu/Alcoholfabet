# Supabase — Tecla&Pau

Consulta primer `SUPABASE_SETUP.md`.

## Migracions

1. `0001_schema.sql`
2. `0002_rls.sql`
3. `0003_read_functions.sql`
4. `0004_seed_questions.sql`
5. `0005_game_write_functions.sql`
6. `0006_realtime_authorization.sql`

Les funcions d'escriptura de `0005` són una implementació completa de referència. L'agent ha de revisar-les contra l'esquema real i executar proves concurrents abans de producció.

## Edge Function

`functions/verify-couple-access/index.ts`

Secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COUPLE_ACCESS_CODE_SHA256`
- `ALLOWED_ORIGINS`

La service-role key només existeix dins de l'Edge Function.

## Projecte

- Ref: `lhgyopkwstuyxolwfucq`
- URL: `https://lhgyopkwstuyxolwfucq.supabase.co`

## Realtime

- Canals: `game:<game_id>`.
- `private: true`.
- Desactiva Allow public access al Dashboard.
- Policies sobre `realtime.messages`.
- El Broadcast només conté id, versió i tipus d'esdeveniment.
