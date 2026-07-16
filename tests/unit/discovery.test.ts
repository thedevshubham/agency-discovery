import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  candidateListSchema,
  normalizeAgencyName,
} from "../../src/discovery/types.js";

describe("agency candidate validation", () => {
  it("normalizes candidate URLs", () => {
    const [candidate] = candidateListSchema.parse([
      {
        name: " Example Agency ",
        websiteUrl: "www.example.com/?utm_source=test",
        sourceUrl: "directory.example/agency/example#profile",
        discoverySource: " directory ",
      },
    ]);

    assert.equal(candidate?.name, "Example Agency");
    assert.equal(candidate?.websiteUrl, "https://www.example.com");
    assert.equal(candidate?.sourceUrl, "https://directory.example/agency/example");
    assert.equal(candidate?.discoverySource, "directory");
  });

  it("rejects candidates without required provenance", () => {
    const result = candidateListSchema.safeParse([
      { name: "Example Agency", websiteUrl: "https://example.com" },
    ]);

    assert.equal(result.success, false);
  });
});

describe("agency name normalization", () => {
  it("normalizes punctuation, accents, ampersands, and spacing", () => {
    assert.equal(
      normalizeAgencyName("  Café & Code—Agency!  "),
      "cafe and code agency",
    );
  });
});
