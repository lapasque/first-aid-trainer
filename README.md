# First Aid Trainer

Application statique de révision : **QCM Express / Refresh rapide** et
**Mini-scénario / Cas concret**. HTML, CSS et JavaScript natif, sans dépendance
d'exécution et sans compilation.

**Site : https://lapasque.github.io/first-aid-trainer/**

## Périmètre et limites

- France / SST par défaut, catalogue pilote **non validé par un formateur SST**.
- 8 questions ; chaque session tire 5 questions distinctes, sans chronomètre.
- 2 scénarios fictifs à embranchements, avec des étapes de réflexion selon les choix.
- Correction, explication et référence après chaque réponse.
- Bilan de l'exercice, possibilité de rejouer ou de changer de mode.
- Navigation au clavier, annonces des corrections et mise en page responsive.
- Aucun compte, cookie applicatif, analytics ou stockage des réponses.
  GitHub Pages applique ses propres conditions et pratiques de journalisation.

Les exercices portent uniquement sur **la protection, l'alerte et la prévention**.
Ils ne décrivent pas les gestes techniques et ne constituent pas une prise en
charge complète d'une victime. Ils ne remplacent ni la formation SST, ni le MAC,
ni les consignes de l'entreprise et ne délivrent aucun certificat.

**En urgence réelle, ne pas utiliser le jeu : contacter les secours adaptés
(en France : 15, 18 ou 112) et suivre leurs instructions.**

Les contenus sont originaux. Les liens INRS et Service-Public ont été consultés
le 14 octobre 2026. Leur présence ne signifie pas que ces organismes approuvent
l'application. Avant un usage pédagogique organisé, faire vérifier chaque
question et scénario par un formateur compétent et vérifier les sources en vigueur.

## Développement local

Servir le dossier par HTTP, et non en ouvrant directement le fichier HTML :
les modules JavaScript et le chargement JSON nécessitent un serveur.

Avec Python installé, depuis le dossier du dépôt :

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

Ouvrir `http://127.0.0.1:8080/`. Aucun `npm install` n'est nécessaire.

## Tests

Ouvrir `http://127.0.0.1:8080/tests/` pour exécuter les tests autonomes dans
le navigateur. Ils vérifient les catalogues, références, transitions, cycles,
scores, réponses uniques et **tous les chemins des scénarios**.

Avec Node.js 22 ou supérieur, la même suite fonctionne en ligne de commande :

```powershell
npm test
```

Un workflow GitHub Actions exécute ces tests à chaque push et pull request.
Ils valident les données et le moteur, **pas la conformité médicale ou SST**.
La vérification manuelle du rendu et des interactions reste nécessaire.

## Organisation

| Fichier | Rôle |
| --- | --- |
| `index.html`, `styles.css` | Structure accessible et présentation |
| `app.js` | Chargement, vues, interactions et erreurs visibles |
| `domain.js` | Validation des catalogues et moteurs de jeu testables |
| `data/locales.json` | Référentiels disponibles et langue par défaut |
| `data/fr-FR.json` | Métadonnées, textes, sources, QCM et arbres de scénarios |
| `tests/` | Suite portable navigateur / Node.js |
| `.nojekyll` | Publication statique sans transformation Jekyll |

## Ajouter un pays ou un référentiel

1. Créer `data/<locale>.json` (ex. `en-GB.json`) selon la structure française.
   Une locale suit le format `xx-YY`.
2. Adapter **le fond**, pas seulement la langue : rôle des intervenants, numéros
   d'urgence, cadre réglementaire, organisation et sources locales.
3. Traduire tous les libellés `ui`, les questions, explications et scénarios.
   Les textes du shell HTML avant chargement / en cas d'échec et certains libellés
   décoratifs sont actuellement français : les adapter également pour un lancement
   destiné à un autre public.
4. Faire vérifier les contenus par une personne compétente dans le pays concerné.
   Maintenir `reviewStatus: "draft"` tant que ce travail n'est pas réalisé.
   Si le catalogue passe à `"reviewed"`, mettre à jour également les avertissements
   et `ui.review`, sans suggérer une certification de l'application.
5. Ajouter la locale au manifeste avec `available: true`. Une entrée
   indisponible est affichée mais ne déclenche aucun chargement.
6. Passer les tests : la suite charge automatiquement tous les catalogues
   disponibles du manifeste.

Royaume-Uni / FAW et États-Unis / OSHA sont **des emplacements désactivés**,
et non des catalogues ou garanties de conformité.

### Contrat JSON (version 1)

Métadonnées : `locale`, `country`, `framework`, `version: 1`, `reviewStatus`,
`sourcesCheckedOn`, `emergencyNumbers`, `disclaimer`, `ui`, `sources`,
`questions`, `scenarios`.

- Source : `id` unique, `title`, `url` HTTPS.
- Question : `id` unique, `category`, `prompt`, `answers` (au moins deux),
  `correctIndex` (index à partir de zéro), `explanation`, `sourceId`.
- Scénario : `id` unique, `title`, `start` (identifiant d'une décision de départ), `nodes`.
  - `decision` : `title`, `context`, `sourceId`, `choices`.
    Chaque choix a `label`, `correct`, `feedback`, `next`.
    Une seule réponse attendue par décision.
  - `info` : `title`, `context`, `next` ; aucune incidence sur le score.
  - `end` : `summary`.
- Tous les nœuds doivent être accessibles depuis le départ ; les cycles,
  transitions absentes et scénarios sans fin sont refusés.
- QCM : réponses attendues / 5. Scénario : choix attendus / décisions
  effectivement rencontrées. Les étapes `info` ne comptent pas dans le score.
  Aucun pourcentage de progression n'est affiché pour un arbre.

Les placeholders UI sont `{current}`, `{total}`, `{count}`, `{correct}` et
`{date}` selon le libellé. Une valeur manquante provoque une erreur explicite.
Le catalogue est validé avant de rendre les jeux disponibles. Les contenus sont
injectés comme texte, jamais comme HTML.

## Publication GitHub Pages

Dans **Settings → Pages**, sélectionner **Deploy from a branch**, branche
**main**, dossier **/(root)**. Le site utilise uniquement des chemins relatifs
pour fonctionner sous `/first-aid-trainer/`. Un push sur `main` publie la mise
à jour ; vérifier le déploiement Pages avant de partager l'URL.
