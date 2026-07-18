import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseGenericJobsPage } from "../../src/jobs/generic-parser.js";
import {
  createCanonicalJobKey,
  normalizeJobTitle,
} from "../../src/jobs/types.js";

describe("generic job parser", () => {
  it("extracts a descriptive job link", () => {
    const jobs = parseGenericJobsPage(
      `<a href="/careers/web-developer">Web Developer 0-2 years Experience Indore Apply Now</a>`,
      "https://agency.example/careers",
    );

    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.title, "Web Developer");
    assert.equal(jobs[0]?.jobUrl, "https://agency.example/careers/web-developer");
  });

  it("uses a nearby heading for a generic Apply button", () => {
    const jobs = parseGenericJobsPage(
      `
        <section class="job-card">
          <h4>Shopify Developer</h4>
          <p>2 years experience with Shopify, HTML, CSS and JavaScript</p>
          <a href="#">Apply</a>
        </section>
      `,
      "https://agency.example/careers",
    );

    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.title, "Shopify Developer");
    assert.equal(
      jobs[0]?.jobUrl,
      "https://agency.example/careers?job=shopify-developer",
    );
  });

  it("ignores generic careers navigation links", () => {
    const jobs = parseGenericJobsPage(
      `<a href="#open-positions">Explore open positions</a>`,
      "https://agency.example/careers",
    );

    assert.deepEqual(jobs, []);
  });
});

describe("job identity", () => {
  it("normalizes job titles", () => {
    assert.equal(normalizeJobTitle(" Senior Node.js Developer "), "senior node js developer");
  });

  it("creates stable keys and separates different roles", () => {
    const first = createCanonicalJobKey(1, {
      title: "Developer",
      jobUrl: "https://agency.example/careers#developer",
      source: "generic",
    });
    const repeated = createCanonicalJobKey(1, {
      title: "Developer",
      jobUrl: "https://agency.example/careers#developer",
      source: "generic",
    });
    const different = createCanonicalJobKey(1, {
      title: "Designer",
      jobUrl: "https://agency.example/careers#designer",
      source: "generic",
    });

    assert.equal(first, repeated);
    assert.notEqual(first, different);
  });
});
