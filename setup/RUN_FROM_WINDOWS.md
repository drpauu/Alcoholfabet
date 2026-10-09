# Execució des de Windows

## Si tens el ZIP al costat del repositori

```powershell
Expand-Archive -Path .\tecla_pau_codex_sol_ultra_mega_pack.zip -DestinationPath .\tecla-pau-spec
Copy-Item -Path .\tecla-pau-spec\* -Destination .\EL_TEU_REPOSITORI -Recurse -Force
Set-Location .\EL_TEU_REPOSITORI
```

Connecta Supabase:

```powershell
.\setup\connect-supabase-codex.ps1
```

Obre Codex des de l'arrel del repositori i selecciona Sol Ultra des de l'entorn disponible.

Enganxa el contingut de:

```text
PASTE_THIS_IN_CODEX.txt
```

## Variables locals

Copia `.env.example` a `.env.local` o al fitxer que utilitzi l'stack existent i completa només la publishable key.

No hi copiïs la contrasenya de base de dades ni la service-role key.
