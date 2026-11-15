// Génère un fichier de licence en ligne de commande.
//   node tools/generer-licence.mjs --client "Nom" --ecole "Auto-École X" --appareil AE-XXXX-XXXX-XXXX [--expire 2027-12-31] [--cle cles/cle-privee.json] [--sortie licence.lic]
// --appareil "*" : licence valable sur tous les appareils.
import { webcrypto as crypto } from 'node:crypto'; import fs from 'node:fs';
const a = process.argv.slice(2); const arg = (k, d = '') => { const i = a.indexOf('--' + k); return i >= 0 ? a[i + 1] : d; };
const CHAMPS = ['produit', 'id', 'client', 'ecole', 'appareil', 'type', 'emise', 'expire'];
const canon = p => JSON.stringify(Object.fromEntries(CHAMPS.map(k => [k, String(p[k] ?? '')])));
const key = JSON.parse(fs.readFileSync(arg('cle', 'cles/cle-privee.json'), 'utf8'));
const today = new Date().toISOString().slice(0, 10);
const p = { produit: 'gestion-auto-ecole', id: 'LIC-' + today.replace(/-/g, '') + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), client: arg('client'), ecole: arg('ecole'), appareil: arg('appareil', '*'), type: arg('expire') ? 'abonnement' : 'definitive', emise: today, expire: arg('expire') };
if (!p.client || !p.appareil) { console.error('Paramètres requis : --client et --appareil'); process.exit(1); }
const k = await crypto.subtle.importKey('jwk', key.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
const sig = Buffer.from(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, k, new TextEncoder().encode(canon(p)))).toString('base64');
const out = arg('sortie', `licence-${(p.ecole || p.client).replace(/[^\w-]+/g, '_')}.lic`);
fs.writeFileSync(out, JSON.stringify({ format: 'licence-gestion-auto-ecole-1', licence: p, signature: sig }, null, 2));
console.log('Licence ' + p.id + ' écrite dans ' + out);
