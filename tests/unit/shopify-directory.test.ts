import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { parseShopifyDirectoryPage } from "../../src/discovery/sources/shopify-directory.js";

const LISTING_HTML = `
  <html>
    <body>
      <p>Showing 1 - 2 of 5,114 partners</p>
      <article data-component-name="listing-profile-card">
        <a href="/partners/directory/partner/example-one">
          <h3>Example One</h3>
        </a>
      </article>
      <article name="listing-profile-card">
        <a href="https://www.shopify.com/partners/directory/partner/example-two">
          <h3> Example Two </h3>
        </a>
      </article>
    </body>
  </html>
`;

describe("Shopify Partner Directory parser", () => {
  it("extracts partner names and absolute Shopify profile URLs", () => {
    const result = parseShopifyDirectoryPage(LISTING_HTML);

    assert.deepEqual(
      result.candidates.map(({ name, sourceUrl }) => ({ name, sourceUrl })),
      [
        {
          name: "Example One",
          sourceUrl:
            "https://www.shopify.com/partners/directory/partner/example-one",
        },
        {
          name: "Example Two",
          sourceUrl:
            "https://www.shopify.com/partners/directory/partner/example-two",
        },
      ],
    );
  });

  it("extracts the dynamic partner count", () => {
    assert.equal(parseShopifyDirectoryPage(LISTING_HTML).totalPartners, 5114);
  });

  it("returns no candidates when listing cards are absent", () => {
    assert.deepEqual(
      parseShopifyDirectoryPage("<html><body>No results</body></html>"),
      { candidates: [], totalPartners: null },
    );
  });
});
