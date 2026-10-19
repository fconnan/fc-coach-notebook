# Déploiement sur Vercel

Guide pour mettre FC Tactics en ligne sur Vercel, avec ou sans les connexions cloud
(Google Drive / GitHub / GitLab).

---

## 1. Prérequis

- Un compte Vercel.
- Le projet poussé sur un dépôt Git (GitHub / GitLab / Bitbucket).
- (Optionnel, pour le cloud) un compte Google Cloud, GitHub et/ou GitLab pour créer
  les applications OAuth.

L'application est une app **SvelteKit**. L'adaptateur `@sveltejs/adapter-auto` détecte
automatiquement Vercel à la compilation et utilise `adapter-vercel` : aucune
configuration d'adaptateur n'est nécessaire.

---

## 2. Déploiement de base (sans cloud)

1. Sur Vercel : **Add New… → Project**, puis importez le dépôt Git.
2. Framework Preset : **SvelteKit** (détecté automatiquement).
   - Build Command : `vite build` (par défaut)
   - Output : géré par l'adaptateur (laisser par défaut)
3. Cliquez sur **Deploy**.

C'est tout : l'app fonctionne immédiatement. Les fonctionnalités **Appareil** et
**Téléchargement** (enregistrement/ouverture de fichiers `.json`) marchent sans aucune
configuration. Les options **Google Drive / GitHub / GitLab** restent **masquées** tant
que les variables d'environnement correspondantes ne sont pas définies.

---

## 3. Activer les connexions cloud (OAuth)

Le cloud utilise un vrai flux OAuth « Se connecter avec… ». Les secrets restent **côté
serveur** (fonctions serverless), les jetons sont stockés dans des **cookies httpOnly**,
et toutes les requêtes Drive/GitHub/GitLab sont **proxifiées par le serveur**.

### 3.1 Variables d'environnement

Dans Vercel : **Project → Settings → Environment Variables**. Ajoutez celles dont vous
avez besoin (un fournisseur peut être activé indépendamment des autres) :

| Variable | Fournisseur | Description |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` | Google | ID client OAuth (type « Application Web ») |
| `GOOGLE_CLIENT_SECRET` | Google | Secret client OAuth |
| `GITHUB_CLIENT_ID` | GitHub | Client ID de l'OAuth App |
| `GITHUB_CLIENT_SECRET` | GitHub | Client secret de l'OAuth App |
| `GITLAB_CLIENT_ID` | GitLab | Application ID |
| `GITLAB_CLIENT_SECRET` | GitLab | Secret |
| `GITLAB_HOST` | GitLab | *(optionnel)* instance auto-hébergée, défaut `https://gitlab.com` |
| `OAUTH_REDIRECT_BASE` | Tous | *(optionnel mais recommandé)* base fixe des URLs de redirection, ex. `https://votre-app.vercel.app` |

Définissez-les pour les environnements **Production** (et **Preview** si besoin), puis
**redéployez** pour qu'elles soient prises en compte.

> Astuce : `OAUTH_REDIRECT_BASE` force l'URL de redirection à pointer vers votre domaine
> stable. Sans elle, l'URL est déduite de la requête — ce qui pose problème sur les
> déploiements *preview* dont le domaine change à chaque fois (voir §5).

### 3.2 URLs de redirection (callbacks)

Pour chaque fournisseur, déclarez l'URL de redirection suivante
(`<provider>` = `google` | `github` | `gitlab`) :

```
Local : http://localhost:5174/api/oauth/<provider>/callback
Prod  : https://VOTRE-APP.vercel.app/api/oauth/<provider>/callback
```

### 3.3 Création des applications OAuth

**Google**
1. [Google Cloud Console](https://console.cloud.google.com) → créez/sélectionnez un projet.
2. **API et services → Bibliothèque** → activez **Google Drive API**.
3. **Écran de consentement OAuth** → type « Externe » → renseignez le nom de l'app et
   votre e-mail → ajoutez-vous comme **utilisateur test**.
4. **Identifiants → Créer des identifiants → ID client OAuth** → **Application Web**.
   - « URI de redirection autorisés » : les callbacks local **et** prod ci-dessus.
5. Copiez le **Client ID** et le **Client secret** dans Vercel.

**GitHub**
1. **Settings → Developer settings → OAuth Apps → New OAuth App**.
   - *Authorization callback URL* : le callback (créez deux apps, ou changez l'URL,
     pour gérer local et prod séparément).
2. Récupérez **Client ID** + **Client secret** → Vercel. Scope utilisé : `repo`.

**GitLab**
1. **User Settings → Applications** (ou au niveau groupe/instance).
   - *Redirect URI* : le callback. Type **confidentiel**. Scope : `api`.
2. Récupérez **Application ID** + **Secret** → Vercel.

### 3.4 Utilisation

Une fois déployé avec les variables : dans l'app, **Fichier → Connexions cloud…**,
cliquez sur **Se connecter avec …**. Pour GitHub/GitLab, choisissez ensuite le dépôt /
projet cible (liste récupérée via l'API). Pour Drive, rien d'autre à configurer.

---

## 4. Développement local

1. Copiez `.env.example` en `.env` et remplissez les variables voulues.
2. Lancez le serveur sur le **port fixe** attendu par les callbacks :
   ```bash
   npm run dev -- --port 5174 --strictPort
   ```
3. Ouvrez `http://localhost:5174`.

`.env` est ignoré par Git (`.gitignore`) : les secrets ne sont jamais versionnés.

---

## 5. Pièges et notes

- **Déploiements *preview*** : chaque preview a une URL différente
  (`...-git-branche-....vercel.app`). L'OAuth échouera si l'URL de redirection ne
  correspond pas. Solution : définir `OAUTH_REDIRECT_BASE` sur votre domaine de prod et
  tester l'OAuth sur la prod (ou un domaine fixe).
- **Google « application non vérifiée »** : tant que l'écran de consentement est en mode
  test, Google affiche un avertissement → *Paramètres avancés → Continuer*. Normal pour
  un usage personnel.
- **Sauvegarde « Appareil »** (File System Access API) : disponible en HTTPS sur les
  navigateurs Chromium ; repli automatique en téléchargement sur Firefox/Safari.
- **Aucune base de données** : l'état d'authentification tient dans des cookies
  httpOnly (sans état serveur), ce qui convient parfaitement au serverless.
- **Persistance locale** : le document en cours est auto-sauvegardé dans le navigateur
  (localStorage + IndexedDB pour le handle de fichier) et restauré au chargement / F5.

---

## 6. Checklist rapide

- [ ] Repo poussé sur Git et importé dans Vercel
- [ ] Premier déploiement OK (Appareil / Téléchargement fonctionnels)
- [ ] *(cloud)* Variables d'environnement définies dans Vercel
- [ ] *(cloud)* `OAUTH_REDIRECT_BASE` réglé sur le domaine de prod
- [ ] *(cloud)* URLs de redirection enregistrées chez Google / GitHub / GitLab
- [ ] Redéploiement après ajout des variables
- [ ] Test « Se connecter avec … » sur la prod
