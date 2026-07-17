import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { extractOfficialWebsiteFromShopifyProfile } from "../../src/discovery/sources/shopify-profile.js";

describe("Shopify partner profile parser", () => {
  it("extracts the external website from contact information", () => {
    const html = `
      <div class="flex flex-col gap-y-1">
        <p>Contact information</p>
        <div>
          <a href="https://www.example-agency.com/?utm_source=sref" rel="nofollow">
            example-agency.com
          </a>
        </div>
      </div>
    `;

    assert.equal(
      extractOfficialWebsiteFromShopifyProfile(html),
      "https://www.example-agency.com",
    );
  });

  it("ignores Shopify links", () => {
    const html = `
      <div><p>Contact information</p>
        <a href="https://www.shopify.com/partners/directory">Shopify</a>
      </div>
    `;

    assert.equal(extractOfficialWebsiteFromShopifyProfile(html), null);
  });

  it("falls back to an external nofollow link", () => {
    const html = `
      <a href="https://shopify.com">Shopify</a>
      <a href="https://agency.example/about" rel="external nofollow">Agency</a>
    `;

    assert.equal(
      extractOfficialWebsiteFromShopifyProfile(html),
      "https://agency.example/about",
    );
  });
});
