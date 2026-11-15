// Prépare la fabrication des installateurs à partir du secret AE_INSTALL_PASSWORD.
//  - electron/build/install-password.nsh : mot de passe demandé par l'installateur Windows
//  - electron/install.json : empreinte (SHA-256) vérifiée au premier lancement sur macOS et Linux
// Ces deux fichiers ne sont jamais enregistrés dans le dépôt.
import { createHash } from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const root = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const nsh = path.join(root, 'electron', 'build', 'install-password.nsh'), js = path.join(root, 'electron', 'install.json');
const pwd = process.env.AE_INSTALL_PASSWORD || '';
if (!pwd) { for (const f of [nsh, js]) fs.rmSync(f, { force: true }); console.log('::warning::Aucun secret AE_INSTALL_PASSWORD : les installateurs ne demanderont pas de mot de passe.'); process.exit(0); }
const nsisEsc = s => s.replace(/\$/g, '$$$$').replace(/"/g, '$\\"');
fs.writeFileSync(nsh, '﻿!define AE_PWD "' + nsisEsc(pwd) + '"\n');
fs.writeFileSync(js, JSON.stringify({ hash: createHash('sha256').update('autoecole-install:' + pwd).digest('hex') }));
console.log('Mot de passe d’installation pris en compte (' + pwd.length + ' caractères).');
