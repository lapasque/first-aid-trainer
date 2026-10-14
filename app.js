import { validateManifest, validateCatalog, createQuiz, createScenario, format } from "./domain.js";

const $ = id => document.getElementById(id);
let catalog;
let session;
let mode;
let selectedScenario;
let loading = false;

function setText(id, value) { $(id).textContent = value; }
function showView(view) {
  for (const id of ["home", "game", "result"]) $(id).hidden = id !== view;
}
function focusTitle(id) { $(id).focus(); }

async function fetchJson(path) {
  const response = await fetch(path);
  if (!response.ok) throw new Error(`Chargement de ${path} : HTTP ${response.status}.`);
  return response.json();
}

function sourceLink(sourceId, label) {
  const source = catalog.sources.find(item => item.id === sourceId);
  const link = document.createElement("a");
  link.href = source.url;
  link.textContent = label || source.title;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function renderCatalog() {
  const ui = catalog.ui;
  document.documentElement.lang = catalog.locale;
  document.title = `First Aid Trainer — ${catalog.country} / ${catalog.framework}`;
  setText("disclaimer", catalog.disclaimer);
  const labels = {
    "hero-eyebrow": "eyebrow", "hero-title": "title", "hero-description": "description",
    "review-tag": "review", "mode-heading": "modeHeading", "mode-subtitle": "modeSubtitle",
    "quiz-title": "quizTitle", "quiz-description": "quizDescription", "quiz-meta": "quizMeta",
    "start-quiz": "quizStart", "scenario-title": "scenarioTitle",
    "scenario-description": "scenarioDescription", "scenario-label": "scenarioLabel",
    "scenario-meta": "scenarioMeta", "start-scenario": "scenarioStart", "context-title": "contextTitle",
    "context-description": "contextDescription", "extension-note": "extensionNote",
    back: "back", "result-eyebrow": "resultEyebrow", "result-title": "resultTitle",
    "result-reminder": "resultReminder", replay: "replay", "home-button": "home",
    "sources-title": "sourcesTitle", "privacy-note": "privacy"
  };
  for (const [id, key] of Object.entries(labels)) setText(id, ui[key]);
  setText("country-tag", `${catalog.country} / ${catalog.framework}`);
  $("progress").setAttribute("aria-label", ui.progressLabel);
  $("scenario").replaceChildren(...catalog.scenarios.map(scenario => new Option(scenario.title, scenario.id)));
  $("sources").replaceChildren(...catalog.sources.map(source => {
    const item = document.createElement("li");
    item.append(sourceLink(source.id));
    return item;
  }));
  const checked = document.createElement("li");
  checked.textContent = format(ui.sourceChecked, { date: catalog.sourcesCheckedOn });
  $("sources").append(checked);
  showView("home");
}

async function loadCatalog(locale) {
  loading = true;
  $("locale").disabled = true;
  $("loading").hidden = false;
  $("content").hidden = true;
  $("load-error").hidden = true;
  try {
    catalog = validateCatalog(await fetchJson(`./data/${locale}.json`), locale);
    session = null;
    renderCatalog();
    $("content").hidden = false;
  } catch (error) {
    console.error("Échec du chargement du catalogue", error);
    setText("error-detail", error instanceof Error ? error.message : "Erreur de chargement inconnue.");
    $("load-error").hidden = false;
  } finally {
    loading = false;
    $("locale").disabled = false;
    $("loading").hidden = true;
  }
}

function startQuiz() {
  mode = "quiz";
  session = createQuiz(catalog.questions);
  showView("game");
  renderStep();
}

function startScenario() {
  mode = "scenario";
  selectedScenario = catalog.scenarios.find(scenario => scenario.id === $("scenario").value);
  session = createScenario(selectedScenario);
  showView("game");
  renderStep();
}

function makeAnswer(label, index, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "answer";
  const marker = document.createElement("span");
  marker.className = "answer-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.textContent = String.fromCharCode(65 + index);
  const text = document.createElement("span");
  text.textContent = label;
  button.append(marker, text);
  button.addEventListener("click", () => handler(index));
  return button;
}

function renderStep() {
  const ui = catalog.ui;
  $("feedback").hidden = true;
  $("feedback").replaceChildren();
  $("next").hidden = true;
  $("answers").replaceChildren();
  setText("game-mode", mode === "quiz" ? ui.quizMode : ui.scenarioMode);
  if (mode === "quiz") {
    const question = session.question;
    setText("progress-text", format(ui.quizProgress, { current: session.current, total: session.total }));
    $("progress").hidden = false;
    $("progress").max = session.total;
    $("progress").value = session.current - 1;
    setText("question-category", question.category);
    setText("game-title", question.prompt);
    setText("question-context", "");
    $("answers").append(...question.answers.map((answer, index) => makeAnswer(answer, index, answerQuiz)));
  } else {
    const node = session.node;
    setText("progress-text", format(ui.scenarioProgress, { count: session.total }));
    // A branch has no fixed number of steps, so avoid a misleading percentage.
    $("progress").hidden = true;
    setText("question-category", selectedScenario.title);
    setText("game-title", node.title);
    setText("question-context", node.context);
    if (node.type === "decision") {
      $("answers").append(...node.choices.map((choice, index) => makeAnswer(choice.label, index, answerScenario)));
    } else {
      setText("next", ui.next);
      $("next").hidden = false;
    }
  }
  focusTitle("game-title");
}

function showFeedback(correct, explanation, sourceId) {
  $("feedback").className = correct === false ? "feedback incorrect" : "feedback";
  const title = document.createElement("strong");
  title.textContent = correct === null ? catalog.ui.reflection : correct ? catalog.ui.correct : catalog.ui.incorrect;
  const paragraph = document.createElement("p");
  paragraph.textContent = explanation;
  $("feedback").replaceChildren(title, paragraph);
  if (sourceId) $("feedback").append(sourceLink(sourceId, catalog.ui.source));
  $("feedback").hidden = false;
}

function markAnswers(index, correctIndex) {
  [...$("answers").children].forEach((button, position) => {
    button.disabled = true;
    if (position === correctIndex) button.classList.add("correct");
    else if (position === index) button.classList.add("incorrect");
  });
}

function answerQuiz(index) {
  const correct = session.answer(index);
  markAnswers(index, session.question.correctIndex);
  showFeedback(correct, session.question.explanation, session.question.sourceId);
  $("progress").value = session.current;
  setText("next", session.last ? catalog.ui.finish : catalog.ui.next);
  $("next").hidden = false;
  $("next").focus();
}

function answerScenario(index) {
  const node = session.node;
  const choice = session.answer(index);
  markAnswers(index, node.choices.findIndex(item => item.correct));
  showFeedback(choice.correct, choice.feedback, node.sourceId);
  setText("progress-text", format(catalog.ui.scenarioProgress, { count: session.total }));
  setText("next", selectedScenario.nodes[choice.next].type === "end" ? catalog.ui.finish : catalog.ui.next);
  $("next").hidden = false;
  $("next").focus();
}

function showResult() {
  const values = { correct: session.correct, total: session.total };
  setText("result-score", format(catalog.ui.score, values));
  const summary = format(mode === "quiz" ? catalog.ui.quizSummary : catalog.ui.scenarioSummary, values);
  setText("result-summary", mode === "scenario" ? `${session.node.summary} ${summary}` : summary);
  showView("result");
  focusTitle("result-title");
}

$("start-quiz").addEventListener("click", startQuiz);
$("start-scenario").addEventListener("click", startScenario);
$("next").addEventListener("click", () => {
  if (session.advance()) renderStep();
  else showResult();
});
for (const id of ["back", "home-button"]) {
  $(id).addEventListener("click", () => {
    session = null;
    showView("home");
    $("start-quiz").focus();
  });
}
$("replay").addEventListener("click", () => mode === "quiz" ? startQuiz() : startScenario());
$("locale").addEventListener("change", () => {
  if (!loading) loadCatalog($("locale").value);
});
$("retry").addEventListener("click", () => window.location.reload());

async function initialize() {
  try {
    const manifest = validateManifest(await fetchJson("./data/locales.json"));
    $("locale").replaceChildren(...manifest.locales.map(locale => {
      const option = new Option(locale.label, locale.id);
      option.disabled = !locale.available;
      return option;
    }));
    $("locale").value = manifest.defaultLocale;
    await loadCatalog(manifest.defaultLocale);
  } catch (error) {
    console.error("Échec du chargement des référentiels", error);
    $("loading").hidden = true;
    setText("error-detail", error instanceof Error ? error.message : "Erreur de chargement inconnue.");
    $("load-error").hidden = false;
  }
}

initialize();
