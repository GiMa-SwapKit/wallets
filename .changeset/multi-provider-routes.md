---
"@swapkit/ui": minor
---

Surface every provider in a multi-hop quote rather than just the first.

- The collapsed quote card now face-piles the provider logos and renders the full path label (`1inch → Chainflip`, truncated to `A → … → Z` for 4+ providers) instead of only `providers[0]`.
- The priority badge (Recommended / Cheapest / Fastest) moves to a corner ribbon on the top-right of the card and dialog rows, freeing the inline row for the path label and amount on mobile too.
- The fee details accordion now leads with a vertical per-leg timeline (sell asset → provider → … → buy asset) for multi-hop routes; single-hop routes show the fees breakdown only, unchanged.
- The route-select dialog mirrors the collapsed card: stacked logos, path label, corner ribbon, and the title becomes "Select route".
