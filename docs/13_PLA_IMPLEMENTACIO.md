# 13 — Pla d'implementació

## Fase 0 — Auditar

- Inspeccionar repositori.
- Executar app.
- Identificar integracions existents.
- Crear còpia de seguretat.
- Confirmar variables i Supabase.

## Fase 1 — Base visual

- Tokens.
- Tipografies.
- Fons.
- Avatars.
- Peces.
- Tauler SVG.
- Pantalles estàtiques.
- Responsive.

Sortida: totes les pantalles navegables amb dades locals tipades.

## Fase 2 — Domini i presencial

- Tipus.
- Generador de recorregut.
- Màquina d'estats.
- Preguntes.
- T&P presencial.
- +1.
- Final.

Sortida: partida presencial completa.

## Fase 3 — Supabase

- Auth anònima.
- Esquema.
- RLS.
- Seed.
- Accés privat.
- RPCs.
- Marcador.

Sortida: persistència segura.

## Fase 4 — Online

- Crear/unir-se.
- Rols.
- Presence.
- Broadcast.
- Vistes filtrades.
- T&P atòmic.
- Reconnexió.

Sortida: partida online completa amb dos navegadors.

## Fase 5 — Acabats

- Animacions.
- Sons.
- Hàptica.
- Reduced motion.
- Wake Lock opcional.

## Fase 6 — QA

- Unit.
- Integració.
- E2E.
- Responsive.
- Seguretat.
- Build.
- README.

## Política de canvis

Quan una fase està aprovada:

- no regenerar avatars;
- no canviar paleta;
- no reescriure tauler sense necessitat;
- no substituir Supabase;
- no alterar regles per simplificar la implementació.
