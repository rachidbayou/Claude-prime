// Écriture d'un objet dans OVH Object Storage (API S3), signature AWS SigV4 via WebCrypto.
// Aucune dépendance. Variables attendues dans le Worker :
//   OVH_S3_ENDPOINT  ex. https://s3.gra.io.cloud.ovh.net   [À VÉRIFIER : région de votre bucket]
//   OVH_S3_REGION    ex. gra                                 [À VÉRIFIER]
//   OVH_S3_BUCKET    nom du bucket
//   OVH_S3_ACCESS_KEY, OVH_S3_SECRET_KEY : à enregistrer comme SECRETS (wrangler secret put), jamais dans le code ni côté navigateur.

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha256Hex = async (data) => hex(await crypto.subtle.digest('SHA-256', data));

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}

export async function signPut({ endpoint, region, bucket, key, body, contentType, accessKey, secretKey, now = new Date() }) {
  const host = new URL(endpoint).host;
  const path = '/' + bucket + '/' + key.split('/').map(encodeURIComponent).join('/');
  const amzDate = now.toISOString().replace(/[-:]|\.\d{3}/g, '');   // 20261109T101500Z
  const day = amzDate.slice(0, 8);
  const payloadHash = await sha256Hex(enc.encode(body));

  const headers = { 'content-type': contentType, host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join('');
  const signedHeaders = names.join(';');
  const canonicalRequest = ['PUT', path, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');

  const scope = `${day}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, await sha256Hex(enc.encode(canonicalRequest))].join('\n');

  let k = await hmac(enc.encode('AWS4' + secretKey), day);
  k = await hmac(k, region);
  k = await hmac(k, 's3');
  k = await hmac(k, 'aws4_request');
  const signature = hex(await hmac(k, stringToSign));

  return {
    url: endpoint.replace(/\/$/, '') + path,
    headers: {
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      Authorization: `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
    }
  };
}

export async function putObject(env, key, body, contentType = 'application/json') {
  const { url, headers } = await signPut({
    endpoint: env.OVH_S3_ENDPOINT, region: env.OVH_S3_REGION, bucket: env.OVH_S3_BUCKET,
    key, body, contentType, accessKey: env.OVH_S3_ACCESS_KEY, secretKey: env.OVH_S3_SECRET_KEY
  });
  const res = await fetch(url, { method: 'PUT', headers, body });
  if (!res.ok) throw new Error(`Stockage : HTTP ${res.status}`);   // ne jamais journaliser le contenu du message
}
