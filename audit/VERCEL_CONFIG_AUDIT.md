# Connexió del desplegament Vercel

El 9 d’octubre de 2026 s’ha comprovat `https://www.alcoholfabet.cat/` amb HTTP i Chromium. El lloc respon 200 i mostra «Cal configurar la connexió al joc.» als tres formats requerits. No fa cap petició a Supabase. El bundle publicat `/assets/index-BiG3EiZN.js` no conté cap host de projecte Supabase ni un valor de publishable key. El frontend queda sense client configurat; el codi només crea el client quan disposa de `VITE_SUPABASE_URL` i `VITE_SUPABASE_PUBLISHABLE_KEY`. Aquest diagnòstic no determina quina de les dues variables manca al Dashboard, perquè el build pot eliminar també l’altra referència.

La configuració local és present a `.env.local`, exclòs de Git. No hi ha projecte Vercel vinculat, credencial de CLI ni connexió Vercel confirmada en aquest entorn. S’ha localitzat la integració disponible i s’ha proposat connectar-la. El canvi de variables del desplegament i el Redeploy continuen pendents d’accés al compte o d’acció de l’usuari; no s’ha modificat el lloc publicat.

S’ha afegit una validació a `vite.config.ts` que rebutja una compilació sense les variables requerides i n’indica els noms, sense imprimir els valors. La prova real `env VITE_SUPABASE_URL= VITE_SUPABASE_PUBLISHABLE_KEY= npm run build` falla expressament amb codi 1 abans de publicar un build invàlid. Amb la configuració local correcta, `npm run check` passa: TypeScript, 34 proves unitàries en set fitxers i build. El bundle local conté el host esperat, una publishable key i la RPC d’identitat en línia. Es conserva l’avís existent de mida del bundle.

Les captures de l’error publicat són a `audit/vercel-config-before/`. La còpia anterior als canvis és `/home/pau/Documents/alcoholfabet-vercel-config-before-20261009.tar.gz`, amb permisos `0600` i sense secrets. Les instruccions de configuració són a [README.md](../README.md#desplegar-a-vercel).

Fonts verificades: [variables de Vercel](https://vercel.com/docs/environment-variables/managing-environment-variables), que requereixen un desplegament nou després d’un canvi, i [variables de Vite](https://vite.dev/guide/env-and-mode), incorporades durant la compilació.
