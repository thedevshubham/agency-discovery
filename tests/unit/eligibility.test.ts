import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLikelyJobPageUrl,
  isRelevantJobRole,
} from "../../src/matching/eligibility.js";

describe("matched job eligibility", () => {
  it("keeps frontend development roles and rejects unrelated roles", () => {
    assert.equal(isRelevantJobRole("Frontend Developer (React)"), true);
    assert.equal(isRelevantJobRole("Senior Shopify Developer"), true);
    assert.equal(isRelevantJobRole("Web Developer"), true);
    assert.equal(isRelevantJobRole("Senior Backend Engineer"), false);
    assert.equal(isRelevantJobRole("Senior Shopify Designer"), false);
  });

  it("rejects generic contact pages as job destinations", () => {
    assert.equal(isLikelyJobPageUrl("https://example.com/pages/contact"), false);
    assert.equal(isLikelyJobPageUrl("https://example.com/contact-us/"), false);
    assert.equal(isLikelyJobPageUrl("https://example.com/careers/frontend"), true);
  });
});
