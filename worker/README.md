# Route /contact du Worker

Fichiers : `contact-route.js` (route), `turnstile.js` (vérification Siteverify).
À brancher dans le routeur du Worker : `if (url.pathname === '/contact') return handleContact(request, env);`

| Nom | Type | Rôle |
|---|---|---|
| `ALLOWED_ORIGIN` | variable | Origine du site, sans chemin ni barre finale (ex. `https://claude-prime.pages.dev`) |
| `TURNSTILE_SECRET_KEY` | secret | Clé secrète Turnstile (`npx wrangler secret put TURNSTILE_SECRET_KEY`) |
| `CONTACTS` | liaison KV | Espace KV où sont écrits les messages |

`wrangler.jsonc` (à fusionner, sans remplacer le reste) :

```jsonc
"kv_namespaces": [{ "binding": "CONTACTS", "id": "<id donné par wrangler kv namespace create>" }],
"keep_vars": true
```

Tests à faire après déploiement : envoi valide (201, objet présent dans KV), jeton absent (403), origine étrangère (403),
e-mail invalide (400), corps > 16 Kio (413), type non JSON (415), méthode GET (405). Aucun objet ne doit être créé en cas de refus.

Avant l'ouverture publique : ajouter une limitation de débit (règle Cloudflare sur `/contact`).
Ne jamais committer `.dev.vars` ni de clé.
