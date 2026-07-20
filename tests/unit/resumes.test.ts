import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractedResumeSchema, normalizeResumeText } from "../../src/resumes/types.js";

describe("resume text", () => {
  it("normalizes whitespace while preserving meaningful lines", () => {
    assert.equal(
      normalizeResumeText("  Shubham   Bhatt \n\n\n TypeScript\tNode.js  "),
      "Shubham Bhatt\nTypeScript Node.js",
    );
  });

  it("rejects PDFs with too little extractable text", () => {
    const result = extractedResumeSchema.safeParse({
      text: "short text",
      pageCount: 1,
    });

    assert.equal(result.success, false);
  });
});
