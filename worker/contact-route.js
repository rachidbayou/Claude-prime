// Proposition de route POST /contact pour le Worker existant (séance 4).
// À intégrer dans le Worker, pas à publier tel quel : adapter les lignes marquées [À VÉRIFIER].
//
// Hypothèses (je n'ai pas le code du Worker) :
//  - stockage Cloudflare KV : espace de noms lié au Worker sous le nom CONTACTS
//    (wrangler.toml : [[kv_namespaces]] binding = "CONTACTS", id = "…") ;
//  - variable ALLOWED_ORIGIN = origine du site, sans slash final ;
//  - une fonction verifyTurnstile(token, ip, env) existe déjà.            [À VÉRIFIER]

const MAX_BODY_BYTES = 16 * 1024;            // taille maximale de la requête
const LIMITS = { name: 100, email: 254, message: 5000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// [À VÉRIFIER] remplacer par les helpers déjà présents dans le Worker.
// import { verifyTurnstile, corsHeaders } from './security.js';

function json(body, status, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
      'Vary': 'Origin',
      'Cache-Control': 'no-store'
    }
  });
}

export async function handleContact(request, env) {
  // Pré-vol CORS
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin'
      }
    });
  }
  if (request.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405, env);

  // Origine
  if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) {
    return json({ error: 'Origine non autorisée.' }, 403, env);
  }

  // Type et taille (en-tête, puis taille réelle)
  if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) {
    return json({ error: 'Format attendu : JSON.' }, 415, env);
  }
  const declared = Number(request.headers.get('Content-Length') || 0);
  if (declared > MAX_BODY_BYTES) return json({ error: 'Message trop volumineux.' }, 413, env);
  const raw = await request.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
    return json({ error: 'Message trop volumineux.' }, 413, env);
  }

  let data;
  try { data = JSON.parse(raw); } catch { return json({ error: 'JSON invalide.' }, 400, env); }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return json({ error: 'Requête invalide.' }, 400, env);
  }

  // Validation des champs
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  const email = typeof data.email === 'string' ? data.email.trim() : '';
  const message = typeof data.message === 'string' ? data.message.trim() : '';
  const token = typeof data.turnstileToken === 'string' ? data.turnstileToken : '';

  if (!name || name.length > LIMITS.name) return json({ error: 'Nom invalide.' }, 400, env);
  if (!email || email.length > LIMITS.email || !EMAIL_RE.test(email)) {
    return json({ error: 'Adresse e-mail invalide.' }, 400, env);
  }
  if (!message || message.length > LIMITS.message) return json({ error: 'Message invalide.' }, 400, env);
  if (!token) return json({ error: 'Contrôle anti-robot manquant.' }, 400, env);

  // Turnstile — [À VÉRIFIER] réutiliser la fonction existante et sa signature
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const ok = await verifyTurnstile(token, ip, env);
  if (!ok) return json({ error: 'Contrôle anti-robot refusé.' }, 403, env);

  // Enregistrement : contacts/AAAA-MM-JJ/identifiant.json (l'IP n'est pas stockée)
  const now = new Date();
  const id = crypto.randomUUID();
  const key = `contacts/${now.toISOString().slice(0, 10)}/${id}.json`;
  const record = { id, receivedAt: now.toISOString(), name, email, message };

  try {
    // Pas d'expiration : durée de conservation à définir. [À COMPLÉTER]
    // (KV accepte { expirationTtl: <secondes> } en 3e argument pour une suppression automatique.)
    await env.CONTACTS.put(key, JSON.stringify(record));
  } catch {
    return json({ error: 'Enregistrement impossible, réessayez plus tard.' }, 502, env);
  }

  return json({ id }, 201, env);
}

// Branchement dans le routeur existant :
//   if (url.pathname === '/contact') return handleContact(request, env);
//
