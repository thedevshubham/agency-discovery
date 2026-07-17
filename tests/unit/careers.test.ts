import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extractCareersUrl,
  isCareersPage,
} from "../../src/services/careers.js";

describe("careers link extraction", () => {
  it("resolves a relative careers URL", () => {
    const html = `<footer><a href="/careers/">Careers</a></footer>`;

    assert.equal(
      extractCareersUrl(html, "https://agency.example"),
      "https://agency.example/careers",
    );
  });

  it("finds an external ATS jobs page", () => {
    const html = `
      <a href="https://jobs.lever.co/example-agency">View open positions</a>
    `;

    assert.equal(
      extractCareersUrl(html, "https://agency.example"),
      "https://jobs.lever.co/example-agency",
    );
  });

  it("prefers a strong careers link over a generic team link", () => {
    const html = `
      <a href="/team">Join our team</a>
      <a href="/company/careers">Careers</a>
    `;

    assert.equal(
      extractCareersUrl(html, "https://agency.example"),
      "https://agency.example/company/careers",
    );
  });

  it("ignores unrelated links", () => {
    const html = `<a href="/services">Our services</a>`;

    assert.equal(extractCareersUrl(html, "https://agency.example"), null);
  });
});

describe("careers page validation", () => {
  it("accepts a careers URL", () => {
    assert.equal(
      isCareersPage("<html><title>Agency</title></html>", "https://agency.example/careers"),
      true,
    );
  });

  it("accepts a page with a careers heading", () => {
    assert.equal(
      isCareersPage(
        "<html><h1>Join our team</h1></html>",
        "https://agency.example/company/people",
      ),
      true,
    );
  });

  it("rejects a missing path redirected to the homepage", () => {
    assert.equal(
      isCareersPage(
        "<html><title>Example Agency</title><h1>Our services</h1></html>",
        "https://agency.example",
      ),
      false,
    );
  });
});
