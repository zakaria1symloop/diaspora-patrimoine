# Website Issues & Improvements

> Review of 2026-10-11. Rule for every item (D-098): a reported defect is an example — its fix applies to every page
> and component where the same problem exists, without waiting for a page-by-page list.

## 1. General

- **Navigation menu:** Remove the right-facing arrows from menu items that do not contain dropdown menus.

## 2. Homepage — `http://192.168.100.36:3000/`

### 2.1 Hero Section

- **Algerian flag:** Correct the Algerian flag displayed on the card labeled “À Alger”.
- **Clickable cards:** Make all cards in the hero section fully clickable, not just the “À Alger” card. Ensure the France card and all other cards navigate to their respective links.

### 2.2 Des biens pour différents budgets

#### Filter UI and Selection

- Improve the design and usability of the filter dropdowns, particularly the selection of filter values.
- Fix the sidebar filter so users can select the number of rooms (`pièces`) in an apartment, as they can already do through the dropdown filter.

#### Budget Validation

- **Prix total:** Prevent users from searching when the minimum price exceeds the maximum price. Display appropriate validation feedback and require users to correct the values before proceeding.
- Apply this validation consistently across the entire website, wherever minimum and maximum budget values are available.
- **Mensualité:** Fix the issue where the maximum value in the input field becomes empty when the slider reaches its maximum position.

#### Search Performance

- Do not trigger searches immediately whenever a filter changes.
- Allow users to configure all their desired filters and explicitly confirm or apply them before starting the search.
- Apply filters in a way that reduces unnecessary API requests and prevents excessive server load.

#### Property Cards and Favorites

- Make the entire property card clickable, rather than only its white background.
- When a user clicks the favorite (heart) icon while not logged in, prompt them to log in before allowing them to add the property to their favorites.

#### Mobile Carousel

- Fix the property cards carousel on mobile, where the number of pagination bullets exceeds the number of cards.
- Verify and fix the same issue across all carousels throughout the website.

### 2.3 Pourquoi acheter en Algérie en 2026

- Fix the play/pause icon, which currently does not perform any action.
- Ensure the associated functionality works correctly or remove the controls if they are not intended to be interactive.

## 3. Programmes — `http://localhost:3000/programmes`

### 3.1 Pagination

- Implement pagination for the programmes listing page.

### 3.2 Loading States

- Add skeleton loading states for programme cards while data is being fetched.
- Extend skeleton loading states to other components and sections that require API requests, not just the cards.
- Ensure loading placeholders match the layout of the content they replace to minimize layout shifts.

## 4. Property Details — `http://localhost:3000/biens/:id`

### 4.1 Map

- Fix the map display and layout on the property details page.

### 4.2 Email Sharing

- Fix the email sharing functionality associated with the **Partager** feature.
- Verify that the email sharing action works correctly across supported browsers and devices.

## 5. Footer

### Responsive Typography

- Fix the footer's responsive layout when increasing the text size.
- Ensure that larger text does not break the layout, cause overlapping elements, or create inconsistent spacing.
- Review responsive behavior across desktop, tablet, and mobile screen sizes.

## 6. General Requirements

- Ensure fixes are consistent across the entire website wherever the same components or functionality are reused.
- Verify all changes on desktop and mobile devices.
- Test filter validation, API request behavior, loading states, navigation, and interactive elements after implementation.
- Avoid introducing regressions in existing functionality or responsive layouts.
