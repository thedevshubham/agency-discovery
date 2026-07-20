import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseRequiredLimit } from "../../src/cli/arguments.js";
import { classifyCrawlUrl } from "../../src/crawl/classify-url.js";

describe("workflow arguments", () => {
  it("requires an explicit positive count or --all", () => {
    assert.equal(parseRequiredLimit("10", "example"), 10);
    assert.equal(parseRequiredLimit("--all", "example"), "all");
    assert.throws(() => parseRequiredLimit(undefined, "example"), /count is required/i);
    assert.throws(() => parseRequiredLimit("0", "example"), /invalid count/i);
    assert.throws(() => parseRequiredLimit("10jobs", "example"), /invalid count/i);
  });
});

describe("crawl URL classification", () => {
  it("recognizes Shopify directories, careers pages, and ordinary websites", () => {
    assert.equal(
      classifyCrawlUrl("https://www.shopify.com/in/partners/directory", "<html></html>"),
      "shopify-directory",
    );
    assert.equal(
      classifyCrawlUrl(
        "https://agency.example/careers",
        "<html><h1>Careers</h1></html>",
      ),
      "careers-page",
    );
    assert.equal(
      classifyCrawlUrl("https://agency.example", "<html><h1>Welcome</h1></html>"),
      "website",
    );
  });
});
