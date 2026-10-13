# Minløn

Lønberegner for daghold — PWA, offline-first, ingen backend. Alle satser indtastes under
Indstillinger og gemmes kun i telefonens localStorage; der står ingen beløb i koden.

Cloudflare Workers: build command `bash build.sh`, deploy command `npx wrangler deploy`
(config i `wrangler.jsonc` — publicerer kun `dist/`).
