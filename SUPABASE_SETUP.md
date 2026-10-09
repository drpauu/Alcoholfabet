# Supabase — Alcoholfabet

La configuració, les migracions aplicades, els contractes RPC, les proves reals i les accions de Dashboard pendents estan documentades a [supabase/SUPABASE_SETUP.md](supabase/SUPABASE_SETUP.md).

Anonymous Sign-Ins ja està activat i verificat al projecte `lhgyopkwstuyxolwfucq`. L’esquema, RLS, RPCs, preguntes, entrada pública i canals Realtime privats s’han aplicat i verificat.

Les migracions `0012_alcoholfabet_public_access.sql` i `0013_online_player_identity.sql` estan aplicades. `get_access_context()` dona entrada directa al menú i al mode presencial a qualsevol sessió anònima autenticada. En línia, `identify_online_player()` assigna el rol segons un dels dos codis privats; `create_game()` i `join_game_by_code()` exigeixen aquell rol al servidor. Els dos codis estan configurats, desats com a hashes en un esquema privat i absents del frontend. El codi de sala connecta els dispositius després d’identificar-los. Les partides anteriors i el marcador privat històric continuen preservats. No hi ha cap pas manual pendent per a la configuració del backend d’aquesta revisió.
