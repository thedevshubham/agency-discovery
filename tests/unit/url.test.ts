import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  getCanonicalDomain,
  haveSameCanonicalDomain,
  normalizeHostname,
} from "../../src/utils/domain.js";
import {
  isTrackingParameter,
  normalizeUrl,
  parseHttpUrl,
} from "../../src/utils/url.js";

describe("parseHttpUrl", () => {
  it("adds HTTPS when the scheme is missing", () => {
    assert.equal(parseHttpUrl("example.com/about")?.href, "https://example.com/about");
  });

  it("accepts HTTP and HTTPS URLs", () => {
    assert.equal(parseHttpUrl("http://example.com")?.protocol, "http:");
    assert.equal(parseHttpUrl("https://example.com")?.protocol, "https:");
  });

  it("rejects empty, malformed, non-web, and credentialed URLs", () => {
    assert.equal(parseHttpUrl(""), null);
    assert.equal(parseHttpUrl("not a domain"), null);
    assert.equal(parseHttpUrl("mailto:hello@example.com"), null);
    assert.equal(parseHttpUrl("https://user:secret@example.com"), null);
  });
});

describe("normalizeUrl", () => {
  it("removes fragments and known tracking parameters", () => {
    assert.equal(
      normalizeUrl(
        "https://Example.com/work/?utm_source=google&project=shopify&FBCLID=123#results",
      ),
      "https://example.com/work?project=shopify",
    );
  });

  it("preserves meaningful parameters and sorts them", () => {
    assert.equal(
      normalizeUrl("https://example.com/search?z=last&q=shopify"),
      "https://example.com/search?q=shopify&z=last",
    );
  });

  it("removes a root or trailing path slash", () => {
    assert.equal(normalizeUrl("https://example.com/"), "https://example.com");
    assert.equal(normalizeUrl("https://example.com/about/"), "https://example.com/about");
  });

  it("returns null for invalid input", () => {
    assert.equal(normalizeUrl("this is not a URL"), null);
  });
});

describe("tracking parameters", () => {
  it("matches UTM parameters case-insensitively", () => {
    assert.equal(isTrackingParameter("utm_campaign"), true);
    assert.equal(isTrackingParameter("UTM_Source"), true);
    assert.equal(isTrackingParameter("campaign"), false);
  });
});

describe("canonical domains", () => {
  it("normalizes casing, trailing dots, and common www hostnames", () => {
    assert.equal(normalizeHostname("WWW2.Example.COM."), "example.com");
  });

  it("extracts the registrable domain from URLs and subdomains", () => {
    assert.equal(getCanonicalDomain("https://jobs.agency.example.co.uk/openings"), "example.co.uk");
  });

  it("handles localhost and IP addresses for local development", () => {
    assert.equal(getCanonicalDomain("http://localhost:3000"), "localhost");
    assert.equal(getCanonicalDomain("http://127.0.0.1:3000"), "127.0.0.1");
  });

  it("recognizes equivalent agency URLs", () => {
    assert.equal(
      haveSameCanonicalDomain(
        "https://www.example.com",
        "http://careers.example.com/jobs",
      ),
      true,
    );
    assert.equal(
      haveSameCanonicalDomain("https://example.com", "https://example.org"),
      false,
    );
  });

  it("does not match invalid URLs", () => {
    assert.equal(haveSameCanonicalDomain("invalid url", "https://example.com"), false);
  });
});
