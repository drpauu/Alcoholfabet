# 15 — Desplegament i operació

## Variables del frontend

Exemple:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

La clau pública anònima és acceptable al frontend; les polítiques RLS són la protecció real.

## Secrets del servidor

Configurar al gestor de secrets de Supabase:

```text
SUPABASE_SERVICE_ROLE_KEY
COUPLE_ACCESS_CODE_SHA256
```

No guardar-los al repositori.

## Passos

1. Crear o seleccionar projecte Supabase.
2. Activar Anonymous Sign-ins.
3. Aplicar migracions en ordre.
4. Desplegar Edge Function `verify-couple-access`.
5. Configurar secrets.
6. Revisar RLS.
7. Configurar Realtime privat.
8. Importar preguntes aprovades.
9. Executar tests d'integració.
10. Construir frontend.
11. Publicar en hosting estàtic.
12. Configurar domini.

## Supabase Free

Si el projecte es pausa per inactivitat, cal reactivar-lo abans de jugar. L'app ha de mostrar un error comprensible si el backend no està disponible.

## Operacions administratives

Documentar:

- com afegir preguntes;
- com arxivar una pregunta;
- com consultar resultats;
- com revocar un dispositiu;
- com abandonar manualment una partida bloquejada;
- com corregir un resultat només mitjançant una migració o operació administrativa auditable.

## Observabilitat mínima

- Errors de client sense dades sensibles.
- Errors d'Edge Functions.
- Events de partida.
- Sense enregistrar respostes parlades.
- Sense dades personals addicionals.
