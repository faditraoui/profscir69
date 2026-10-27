# Fiches de renseignements — plateforme enseignants

Node.js (≥ 20.6) + Express + SQLite (fichier unique `data/app.db`).

## Installation
1. `npm install`
2. `cp .env.example .env` puis renseignez `ADMIN_USER` et `ADMIN_PASSWORD` (mot de passe d'au moins 12 caractères conseillé).
3. `npm start` — au premier démarrage le compte administrateur est créé (mot de passe haché avec bcrypt). **Supprimez ensuite `ADMIN_PASSWORD` de `.env`**. Le mot de passe se change depuis l'espace administrateur.

## Utilisation
- Administrateur : `https://votre-domaine/admin` (aucun lien depuis les pages enseignants).
- Enseignant : l'administrateur crée l'enseignant, copie le lien individuel `/t/<jeton>` et le transmet. Le lien s'affiche une seule fois (seul son hachage SHA-256 est stocké) ; « Nouveau lien » en génère un autre et invalide l'ancien. Le lien reste utilisable jusqu'à expiration ou révocation (brouillon, modification, renvoi).

## Déploiement
- Placez l'application derrière un proxy HTTPS (Nginx, Caddy…) ; `NODE_ENV=production` active cookies `Secure` et HSTS.
- Gardez le processus actif (systemd, pm2…). Hébergement avec disque persistant requis (le fichier SQLite doit survivre aux redémarrages).

## Sauvegarde / restauration
- `npm run backup` crée une copie cohérente dans `backups/` (à planifier avec cron).
- Restauration : arrêter le serveur, remplacer `data/app.db` par la copie, redémarrer.

## Sécurité
Authentification et autorisations côté serveur ; sessions par cookie HttpOnly SameSite=Strict ; en-tête obligatoire contre le CSRF ; limitation des tentatives de connexion ; requêtes SQL préparées ; échappement HTML ; CSP stricte ; neutralisation des formules dans l'export CSV ; journal d'audit (table `audit`).

## Limites connues
- Export CSV (s'ouvre dans Excel) ; pas de fichier `.xlsx` natif. PDF : « Imprimer » → « Enregistrer au format PDF ».
- Pas de tests automatisés fournis.
