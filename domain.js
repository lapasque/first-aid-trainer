export const QUIZ_SIZE = 5;

export const UI_KEYS = [
  "eyebrow", "title", "description", "review", "modeHeading", "modeSubtitle",
  "quizTitle", "quizDescription", "quizMeta", "quizStart", "scenarioTitle",
  "scenarioDescription", "scenarioLabel", "scenarioMeta", "scenarioStart",
  "contextTitle", "contextDescription", "extensionNote", "back", "quizMode",
  "scenarioMode", "quizProgress", "scenarioProgress", "correct", "incorrect",
  "reflection", "next", "finish", "source", "resultEyebrow", "resultTitle",
  "score", "quizSummary", "scenarioSummary", "resultReminder", "replay", "home",
  "sourcesTitle", "privacy", "sourceChecked", "progressLabel"
];

function requireValue(condition, message) {
  if (!condition) throw new Error(message);
}

function text(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function uniqueIds(items, name) {
  requireValue(Array.isArray(items) && items.length > 0, `${name} : liste vide ou invalide.`);
  const ids = new Set();
  for (const item of items) {
    requireValue(record(item) && text(item.id) && !ids.has(item.id), `${name} : identifiant manquant ou dupliqué.`);
    ids.add(item.id);
  }
  return ids;
}

export function validateManifest(manifest) {
  requireValue(record(manifest), "Manifest invalide.");
  const ids = uniqueIds(manifest.locales, "Référentiels");
  for (const locale of manifest.locales) {
    requireValue(/^[a-z]{2}-[A-Z]{2}$/.test(locale.id) && text(locale.label) &&
      typeof locale.available === "boolean", "Référentiel invalide.");
  }
  requireValue(ids.has(manifest.defaultLocale) &&
    manifest.locales.some(locale => locale.id === manifest.defaultLocale && locale.available),
  "Référentiel par défaut indisponible.");
  return manifest;
}

export function validateCatalog(catalog, expectedLocale) {
  requireValue(record(catalog) && catalog.version === 1 && catalog.locale === expectedLocale,
    "Version ou langue du catalogue invalide.");
  for (const key of ["country", "framework", "disclaimer", "sourcesCheckedOn"]) {
    requireValue(text(catalog[key]), `Métadonnée manquante : ${key}.`);
  }
  requireValue(catalog.reviewStatus === "draft" || catalog.reviewStatus === "reviewed",
    "Statut de validation invalide.");
  requireValue(Array.isArray(catalog.emergencyNumbers) && catalog.emergencyNumbers.length > 0 &&
    catalog.emergencyNumbers.every(text), "Numéros d’urgence invalides.");
  requireValue(record(catalog.ui), "Libellés manquants.");
  for (const key of UI_KEYS) requireValue(text(catalog.ui[key]), `Libellé manquant : ${key}.`);
  const sourceIds = uniqueIds(catalog.sources, "Sources");
  for (const source of catalog.sources) {
    requireValue(text(source.title) && typeof source.url === "string" &&
      /^https:\/\/[^\s]+$/.test(source.url), "Source invalide : URL HTTPS requise.");
    const url = new URL(source.url);
    requireValue(url.protocol === "https:" && !url.username && !url.password, "URL de source invalide.");
  }
  uniqueIds(catalog.questions, "Questions");
  requireValue(catalog.questions.length >= QUIZ_SIZE, `Au moins ${QUIZ_SIZE} questions sont nécessaires.`);
  for (const question of catalog.questions) {
    requireValue(text(question.prompt) && text(question.category) && text(question.explanation) &&
      sourceIds.has(question.sourceId), `Question ${question.id} : contenu ou source invalide.`);
    requireValue(Array.isArray(question.answers) && question.answers.length >= 2 &&
      question.answers.every(text) && Number.isInteger(question.correctIndex) &&
      question.correctIndex >= 0 && question.correctIndex < question.answers.length,
    `Question ${question.id} : réponses invalides.`);
  }
  uniqueIds(catalog.scenarios, "Scénarios");
  for (const scenario of catalog.scenarios) validateScenario(scenario, sourceIds);
  return catalog;
}

function validateScenario(scenario, sourceIds) {
  requireValue(text(scenario.title) && record(scenario.nodes) &&
    Object.hasOwn(scenario.nodes, scenario.start) &&
    scenario.nodes[scenario.start]?.type === "decision", `Scénario ${scenario.id} : départ invalide.`);
  const visited = new Set();
  const active = new Set();
  let endCount = 0;
  function visit(id) {
    requireValue(Object.hasOwn(scenario.nodes, id), `Scénario ${scenario.id} : nœud absent (${id}).`);
    requireValue(!active.has(id), `Scénario ${scenario.id} : boucle détectée.`);
    if (visited.has(id)) return;
    const node = scenario.nodes[id];
    requireValue(record(node), `Nœud ${id} invalide.`);
    active.add(id);
    if (node.type === "end") {
      requireValue(text(node.summary), `Bilan ${id} manquant.`);
      endCount += 1;
    } else {
      requireValue(text(node.title) && text(node.context), `Nœud ${id} : contenu manquant.`);
      if (node.type === "decision") {
        requireValue(sourceIds.has(node.sourceId) && Array.isArray(node.choices) &&
          node.choices.length >= 2 && node.choices.every(record) &&
          node.choices.some(choice => choice.correct === true),
        `Décision ${id} invalide.`);
        for (const choice of node.choices) {
          requireValue(text(choice.label) && text(choice.feedback) && text(choice.next) &&
            typeof choice.correct === "boolean", `Choix ${id} invalide.`);
          visit(choice.next);
        }
      } else {
        requireValue(node.type === "info" && text(node.next), `Type ou transition ${id} invalide.`);
        visit(node.next);
      }
    }
    active.delete(id);
    visited.add(id);
  }
  visit(scenario.start);
  requireValue(endCount > 0 && visited.size === Object.keys(scenario.nodes).length,
    `Scénario ${scenario.id} : fin absente ou nœuds inaccessibles.`);
}

export function pickQuestions(questions, count = QUIZ_SIZE, random = Math.random) {
  requireValue(Number.isInteger(count) && count > 0 && count <= questions.length, "Taille de QCM invalide.");
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const sample = random();
    requireValue(Number.isFinite(sample) && sample >= 0 && sample < 1, "Tirage aléatoire invalide.");
    const j = Math.floor(sample * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, count);
}

export function format(template, values) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    requireValue(Object.hasOwn(values, key), `Valeur de libellé manquante : ${key}.`);
    return String(values[key]);
  });
}

export function createQuiz(questions, random = Math.random) {
  const selected = pickQuestions(questions, QUIZ_SIZE, random);
  let index = 0;
  let answered = false;
  let correct = 0;
  return {
    get question() { return selected[index]; },
    get current() { return index + 1; },
    get total() { return selected.length; },
    get correct() { return correct; },
    get last() { return index === selected.length - 1; },
    answer(answerIndex) {
      requireValue(!answered && this.question, "Cette question a déjà reçu une réponse.");
      requireValue(Number.isInteger(answerIndex) && answerIndex >= 0 &&
        answerIndex < this.question.answers.length, "Réponse invalide.");
      answered = true;
      const isCorrect = answerIndex === this.question.correctIndex;
      if (isCorrect) correct += 1;
      return isCorrect;
    },
    advance() {
      requireValue(answered, "Répondez avant de continuer.");
      index += 1;
      answered = false;
      return index < selected.length;
    }
  };
}

export function createScenario(scenario) {
  let nodeId = scenario.start;
  let nextId = null;
  let correct = 0;
  let total = 0;
  return {
    get node() { return scenario.nodes[nodeId]; },
    get correct() { return correct; },
    get total() { return total; },
    answer(index) {
      requireValue(this.node.type === "decision" && nextId === null, "Décision déjà prise ou indisponible.");
      requireValue(Number.isInteger(index) && index >= 0 && index < this.node.choices.length, "Choix invalide.");
      const choice = this.node.choices[index];
      total += 1;
      if (choice.correct) correct += 1;
      nextId = choice.next;
      return choice;
    },
    advance() {
      const target = this.node.type === "info" ? this.node.next : nextId;
      requireValue(this.node.type !== "end" && target !== null, "Aucune transition disponible.");
      nodeId = target;
      nextId = null;
      return this.node.type !== "end";
    }
  };
}
