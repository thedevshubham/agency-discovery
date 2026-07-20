import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractSkills } from "../../src/matching/skills.js";
import { scoreJobForResume } from "../../src/matching/score.js";

describe("job matching", () => {
  const resume =
    "Web and Shopify developer experienced with TypeScript, JavaScript, Node.js, React, CSS and Playwright.";

  it("extracts canonical skills without substring false positives", () => {
    assert.deepEqual(extractSkills("React, Node.js, TypeScript"), [
      "TypeScript",
      "Node.js",
      "React",
    ]);
    assert.deepEqual(extractSkills("Worked on reactive systems"), []);
  });

  it("ranks a relevant role above an unrelated role", () => {
    const relevant = scoreJobForResume(resume, {
      title: "Shopify Developer",
      description: "Build Shopify themes using JavaScript and CSS.",
    });
    const unrelated = scoreJobForResume(resume, {
      title: "HR Executive",
      description: "Recruitment and employee engagement.",
    });

    assert.equal(relevant.score, 100);
    assert.ok(relevant.score > unrelated.score);
    assert.deepEqual(relevant.matchedTerms, [
      "shopify",
      "JavaScript",
      "Shopify",
      "CSS",
    ]);
  });

  it("does not overrate generic role words or sparse job data", () => {
    const sparseRelevant = scoreJobForResume(resume, {
      title: "Web Developer",
    });
    const unrelated = scoreJobForResume(resume, {
      title: "Business Development Executive",
    });

    assert.equal(sparseRelevant.score, 70);
    assert.equal(unrelated.score, 0);
  });
});
