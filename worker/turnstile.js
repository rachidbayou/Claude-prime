// Vérification Turnstile côté serveur (Siteverify), selon la séance 4.
// Contrôle : success, hostname (celui de ALLOWED_ORIGIN) et action.
// Un jeton déjà utilisé ou expiré est refusé par Siteverify lui-même.
// Secret attendu : TURNSTILE_SECRET_KEY (wrangler secret put, jamais dans le code ni côté navigateur).

export async function verifyTurnstile(token, ip, env, expectedAction = 'contact') {
  const body = new URLSearchParams({ secret: env.TURNSTILE_SECRET_KEY, response: token });
  if (ip) body.set('remoteip', ip);

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
  if (!res.ok) throw new Error(`Siteverify : HTTP ${res.status}`);   // service indisponible : l'appelant répond 502
  const out = await res.json();

  return out.success === true
    && out.hostname === new URL(env.ALLOWED_ORIGIN).hostname
    && out.action === expectedAction;
}
