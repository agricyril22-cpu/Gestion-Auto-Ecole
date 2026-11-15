// Crée la paire de clés qui signe les licences.
//   node tools/creer-cles.mjs           (refuse d'écraser une clé existante)
//   node tools/creer-cles.mjs --force   (ATTENTION : les licences déjà délivrées ne fonctionneront plus)
// La clé PRIVÉE est écrite dans cles/cle-privee.json : gardez-la secrète, ne la mettez jamais sur GitHub.
// La clé PUBLIQUE est écrite dans src/licence-cle.js : elle est intégrée à l'application.
import { webcrypto as crypto } from 'node:crypto';
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const priv = path.join(root, 'cles', 'cle-privee.json');
if (fs.existsSync(priv) && !process.argv.includes('--force')) { console.error('Une clé privée existe déjà : ' + priv + '\nAjoutez --force pour la remplacer (les licences existantes deviendront invalides).'); process.exit(1); }
const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const pj = await crypto.subtle.exportKey('jwk', kp.privateKey), pub = await crypto.subtle.exportKey('jwk', kp.publicKey);
const kid = 'K' + Date.now().toString(36).toUpperCase();
fs.mkdirSync(path.dirname(priv), { recursive: true });
fs.writeFileSync(priv, JSON.stringify({ usage: 'Clé privée de signature des licences Gestion Auto-École — NE PAS PARTAGER', kid, cree: new Date().toISOString().slice(0, 10), jwk: pj }, null, 2));
fs.writeFileSync(path.join(root, 'src', 'licence-cle.js'), `/* Clé publique de vérification des licences (générée par tools/creer-cles.mjs, identifiant ${kid}) */\nconst LICENCE_CLE_PUBLIQUE = ${JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y })};\n`);
console.log('Clé privée : ' + priv + '\nClé publique : src/licence-cle.js (' + kid + ')');
