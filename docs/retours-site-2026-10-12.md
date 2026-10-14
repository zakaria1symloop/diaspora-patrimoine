# Website QA Issues and Improvements

> Reçu le 12/10/2026. Les points déjà traités le 11/10/2026 (`docs/retours-site-2026-10-11.md`, D-102 à D-104,
> branche `retours/site-public-2026-10-11`) n'ont pas été refaits ; les nouveaux (promoteurs, fiche promoteur, banques,
> dates du Café, partenaires, assistant) le sont par D-105, branche `retours/site-public-2026-10-12`.

This document consolidates the reported issues and requested improvements, grouped by shared functionality and page.

## General

- **Fix email sharing**
  - The email option for the **Partager** button is not working wherever it appears across the website.
  - Investigate and fix the shared implementation, then verify it on all pages.
- **Navigation menu arrows**
  - Remove right-pointing arrows from navigation items that do not open dropdowns.
- **Responsive footer typography**
  - Increasing the footer text size causes the layout to become unresponsive or display incorrectly.
  - Fix the responsive behavior at different text sizes and screen widths.
- **Carousel indicators on mobile**
  - Some mobile carousels show more pagination bullets than there are cards.
  - Audit and fix carousel indicators across the entire website.

## Home page — `/`

### Hero section

- **Correct the Algeria flag**
  - The flag shown on the card labeled **A ALGER** is incorrect.
- **Make all hero cards clickable**
  - The hero cards should each be fully clickable and navigate to their respective destinations.
  - Currently, only the **A ALGER** card appears to work; the France card does not.

### “Des biens pour différents budgets” section

- **Improve dropdown design**
  - Improve the design and usability of the value-selection dropdowns.
- **Fix apartment-room filtering in the sidebar**
  - The sidebar filter does not allow users to select the number of rooms in an apartment, although the dropdown does.
  - Make the behavior consistent across both controls.
- **Validate minimum and maximum total prices**
  - If the minimum price is greater than the maximum price, show a clear validation message.
  - Prevent the user from submitting the search until the values are corrected.
  - Apply this validation consistently across the entire website wherever the same price filters are used.
- **Fix the monthly-payment maximum slider**
  - When the monthly-payment slider reaches its maximum, the maximum-value input below becomes empty.
  - Keep the input populated and synchronized with the slider.
- **Wait for filter confirmation before searching**
  - Do not trigger searches for every filter change.
  - Let users configure their filters and explicitly confirm/apply them before starting the search, reducing unnecessary server requests.
- **Make property cards fully clickable**
  - Make the entire card clickable, not only its white-background area.
- **Require login for favorites**
  - When a logged-out user clicks the heart/favorite icon, prompt them to log in before adding the property to favorites.

### “Pourquoi acheter en Algérie en 2026” section

- **Fix play/pause control**
  - The play/pause icon currently does not do anything.
  - Implement the expected behavior or remove the control if it is not meant to be interactive.

## Programs page — `/programmes`

- **Add pagination**
  - Add pagination to the programs listing.
- **Add skeleton loading states**
  - Display skeleton placeholders while cards are loading.
  - Add appropriate loading states to other components and sections that depend on API requests, not only the program cards.

## Property details page — `/biens/:id`

- **Fix the map**
  - The map is displaying incorrectly or is broken on the property details page.
- **Fix email sharing**
  - The email option in the **Partager** feature is not working.

## Promoters page — `/promoteurs`

- **Improve promoter cards**
  - Redesign the promoter listing as visually appealing cards with images.
- **Add pagination**
  - Add pagination to make longer lists easier to navigate.
- **Add filters**
  - Provide filters to help users find relevant promoters.

## Promoter details page — `/promoteurs/:id`

- **Improve page design**
  - Add a relevant image and improve the layout and visual presentation.

## Financing page — `/financements`

- **Improve partner bank presentation**
  - Add images or logos to the **Banques partenaires** section to make it more visual and easier to scan.

## Café page — `/le-cafe`

- **Add filters to “Prochaines dates”**
  - Add filtering options so users can find relevant upcoming dates or locations more easily when the list becomes large.

## Partners page — `/nos-partenaires`

- **Improve promoter cards**
  - Display promoters in better-designed cards with images.
- **Add filters**
  - Add filters to help users browse and find relevant promoters.

## AI assistant page — `/assistant`

- **Organize AI assistant choices**
  - The assistant may offer more choices, but the options need a clear structure.
  - Group and present the choices in a way that remains easy to understand and navigate as the number of options grows.

## Suggested implementation order

1. **Functional bugs:** email sharing, property map, broken play/pause control, apartment-room filtering, slider value, and favorite login prompt.
2. **Search reliability and performance:** price validation, explicit filter submission, skeleton loading states, and pagination.
3. **Responsive and cross-site consistency:** mobile carousel indicators, footer typography, and navigation arrows.
4. **UI improvements:** hero cards and flag, dropdowns, promoter cards, bank logos, and AI assistant option organization.
