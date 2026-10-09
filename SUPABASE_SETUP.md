# Supabase — Alcoholfabet

La configuració, les migracions aplicades, els contractes RPC, les proves reals i les accions de Dashboard pendents estan documentades a [supabase/SUPABASE_SETUP.md](supabase/SUPABASE_SETUP.md).

Anonymous Sign-Ins ja està activat i verificat al projecte `lhgyopkwstuyxolwfucq`. L’esquema, RLS, RPCs, preguntes, entrada pública i canals Realtime privats s’han aplicat i verificat.

La migració `0012_alcoholfabet_public_access.sql` està aplicada. `get_access_context()` dona entrada directa a qualsevol sessió anònima autenticada; `create_game()` crea en el context públic `alcoholfabet`. No cal configurar ni introduir un codi privat. Les partides anteriors i el marcador privat històric continuen preservats en el seu context. Els codis de sala en línia serveixen només per connectar els dos dispositius. No hi ha cap pas manual pendent per aquesta revisió.
