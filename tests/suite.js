import {
  validateManifest, validateCatalog, pickQuestions, createQuiz, createScenario, format
} from "../domain.js";

function assert(condition, message = "Assertion failed") {
  if (!condition) throw new Error(message);
}

function throws(action) {
  let failed = false;
  try { action(); } catch { failed = true; }
  assert(failed, "Expected an explicit error");
}

export function runTests(manifest, catalogs) {
  const results = [];
  function test(name, action) {
    try {
      action();
      results.push({ name, pass: true });
    } catch (error) {
      results.push({ name, pass: false, error: error.message });
    }
  }
  test("Manifest: valid default and locale entries", () => validateManifest(manifest));
  test("Manifest: unavailable default is rejected", () => {
    const copy = structuredClone(manifest);
    copy.defaultLocale = "zz-ZZ";
    throws(() => validateManifest(copy));
  });
  test("Manifest: path traversal locale is rejected", () => {
    const copy = structuredClone(manifest);
    copy.locales[0].id = "../private";
    throws(() => validateManifest(copy));
  });
  test("Manifest: every available catalog was loaded", () => {
    assert(catalogs.length === manifest.locales.filter(locale => locale.available).length);
    for (const locale of manifest.locales.filter(item => item.available)) {
      assert(catalogs.some(catalog => catalog.locale === locale.id));
    }
  });
  for (const catalog of catalogs) {
    const prefix = `${catalog.locale}: `;
    const changed = change => {
      const copy = structuredClone(catalog);
      change(copy);
      throws(() => validateCatalog(copy, catalog.locale));
    };
    test(prefix + "valid catalog", () => validateCatalog(catalog, catalog.locale));
    test(prefix + "locale mismatch is rejected", () => throws(() => validateCatalog(catalog, "zz-ZZ")));
    test(prefix + "duplicate question IDs are rejected", () => changed(copy => {
      copy.questions[1].id = copy.questions[0].id;
    }));
    test(prefix + "out-of-range correction is rejected", () => changed(copy => {
      copy.questions[0].correctIndex = copy.questions[0].answers.length;
    }));
    test(prefix + "missing source is rejected", () => changed(copy => {
      copy.questions[0].sourceId = "missing";
    }));
    test(prefix + "unsafe source protocol is rejected", () => changed(copy => {
      copy.sources[0].url = "javascript:alert(1)";
    }));
    test(prefix + "missing UI label is rejected", () => changed(copy => {
      delete copy.ui.next;
    }));
    test(prefix + "less than five questions is rejected", () => changed(copy => {
      copy.questions = copy.questions.slice(0, 4);
    }));
    test(prefix + "five distinct questions without mutating input", () => {
      const before = JSON.stringify(catalog.questions);
      for (const value of [0, 0.25, 0.75, 0.999]) {
        const selected = pickQuestions(catalog.questions, 5, () => value);
        assert(selected.length === 5 && new Set(selected.map(item => item.id)).size === 5);
      }
      assert(before === JSON.stringify(catalog.questions));
    });
    test(prefix + "invalid sample/count is rejected", () => {
      throws(() => pickQuestions(catalog.questions, 0));
      throws(() => pickQuestions(catalog.questions, 100));
      throws(() => pickQuestions(catalog.questions, 5, () => 1));
    });
    test(prefix + "quiz: five correct answers and a single final advance", () => {
      const quiz = createQuiz(catalog.questions, () => 0.5);
      for (let index = 0; index < 5; index += 1) {
        assert(quiz.current === index + 1);
        assert(quiz.answer(quiz.question.correctIndex));
        assert(quiz.advance() === (index < 4));
      }
      assert(quiz.correct === 5 && quiz.total === 5);
      throws(() => quiz.advance());
      throws(() => quiz.answer(0));
    });
    test(prefix + "quiz: wrong answers produce zero score", () => {
      const quiz = createQuiz(catalog.questions);
      for (let index = 0; index < 5; index += 1) {
        assert(!quiz.answer((quiz.question.correctIndex + 1) % quiz.question.answers.length));
        quiz.advance();
      }
      assert(quiz.correct === 0);
    });
    test(prefix + "quiz: invalid, skipped and duplicate answers are rejected", () => {
      const quiz = createQuiz(catalog.questions);
      throws(() => quiz.advance());
      throws(() => quiz.answer(-1));
      throws(() => quiz.answer(0.5));
      quiz.answer(quiz.question.correctIndex);
      throws(() => quiz.answer(quiz.question.correctIndex));
      assert(quiz.correct === 1);
    });
    for (const scenario of catalog.scenarios) {
      const scenarioPrefix = prefix + scenario.id + ": ";
      test(scenarioPrefix + "every branch reaches a scored end", () => {
        let pathCount = 0;
        function paths(nodeId, choices, correct, total) {
          const node = scenario.nodes[nodeId];
          if (node.type === "end") {
            const engine = createScenario(scenario);
            let choiceIndex = 0;
            let steps = 0;
            while (engine.node.type !== "end") {
              assert(steps++ < Object.keys(scenario.nodes).length, "Path did not terminate");
              if (engine.node.type === "decision") engine.answer(choices[choiceIndex++]);
              engine.advance();
            }
            assert(engine.correct === correct && engine.total === total);
            assert(engine.node.summary === node.summary);
            throws(() => engine.advance());
            pathCount += 1;
          } else if (node.type === "info") {
            paths(node.next, choices, correct, total);
          } else {
            node.choices.forEach((choice, index) =>
              paths(choice.next, [...choices, index], correct + Number(choice.correct), total + 1));
          }
        }
        paths(scenario.start, [], 0, 0);
        assert(pathCount > 1);
      });
      test(scenarioPrefix + "missing targets are rejected", () => changed(copy => {
        copy.scenarios.find(item => item.id === scenario.id).nodes[scenario.start].choices[0].next = "missing";
      }));
      test(scenarioPrefix + "a terminal starting node is rejected", () => changed(copy => {
        const changedScenario = copy.scenarios.find(item => item.id === scenario.id);
        changedScenario.start = Object.keys(changedScenario.nodes).find(id => changedScenario.nodes[id].type === "end");
      }));
      test(scenarioPrefix + "cycles are rejected", () => changed(copy => {
        copy.scenarios.find(item => item.id === scenario.id).nodes[scenario.start].choices[0].next = scenario.start;
      }));
      test(scenarioPrefix + "unreachable nodes are rejected", () => changed(copy => {
        copy.scenarios.find(item => item.id === scenario.id).nodes.unreachable = { type: "end", summary: "Unused" };
      }));
      test(scenarioPrefix + "two correct choices are rejected", () => changed(copy => {
        copy.scenarios.find(item => item.id === scenario.id).nodes[scenario.start].choices.forEach(choice => {
          choice.correct = true;
        });
      }));
      test(scenarioPrefix + "skip, invalid and duplicate choices are rejected", () => {
        const engine = createScenario(scenario);
        throws(() => engine.advance());
        throws(() => engine.answer(-1));
        throws(() => engine.answer(0.5));
        engine.answer(0);
        throws(() => engine.answer(0));
        assert(engine.total === 1);
      });
    }
  }
  test("UI placeholders: zero score is preserved", () => {
    assert(format("{correct} / {total}", { correct: 0, total: 5 }) === "0 / 5");
  });
  test("UI placeholders: missing values are rejected", () => throws(() => format("{missing}", {})));
  return results;
}
