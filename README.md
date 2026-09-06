# Housing Market Lab

An interactive successor to the Flask housing valuation app. It uses the same core concepts - a RentCast AVM and comparable set alongside Zillow market history - in a responsive analytical dashboard.

The initial Sites deployment ships with the Wilmington sample snapshot used to validate the original app. The interface clearly labels this mode so sample values are not presented as a live appraisal.

## Local development

```bash
npm install
npm run dev
```

## Validation

```bash
npm test
npm run build
```

## Neighborhood regression

The price model uses unweighted ordinary least squares with an intercept on the
returned RentCast comparable listings. It is a selected nearby listing set, not a
neighborhood census. Price means asking / last listed price; inactive does not
mean sold. Radius, status and property-type filters apply to the model and all
factor figures together. The subject is excluded from fitting; exact repeated
property IDs or full addresses are deduplicated while apartment units are retained.

Selectable factors: square footage, bedrooms, bathrooms, acres (lot square feet /
43,560), year built, active vs. inactive, and optionally distance. Initial selection
uses factors with variation, at least eight observations and 80% coverage. All six
primary figures remain visible even when a factor cannot be fitted. Missing data
remain null; unknown status is not encoded as inactive. The legacy size-based
views retain their separate eligible set; regression preserves listings missing
square footage for models and plots that do not need it.

The model uses complete observations, requires at least eight homes and three
residual degrees of freedom, and reports omitted constant or collinear factors.
Centered/scaled reorthogonalized QR solves the fit. Coefficients are transformed
back to dollars per original unit. Adjusted R² and leave-one-out RMSE describe
fit and prediction error, not appraisal certainty. Leave-one-out error uses PRESS
with the selected factors held fixed; numerical tests compare it to explicit refits.

Figures are native Recharts scatterplots: listed price (USD) against each factor,
shared y-axis limits, filled active circles, open inactive circles, unknown-status
triangles and a subject diamond. Conditional model lines hold the other predictors
at training means, not the subject's values. Each chart shows factor-specific
missing counts. Source rows and coefficient details are expandable. Subject markers
use reported characteristics and the listing price, falling back to a clearly
labeled AVM/benchmark estimate or a user-entered price. Missing subject factors
prevent prediction, and extrapolation is flagged. The existing heuristic scenario
controls remain explicitly separate.

Chart map: six relationship scatterplots (price × sqft/beds/baths/acres/year/status),
plus optional distance, in `NeighborhoodRegression.jsx`. Context colors reuse the
site's green/neutral roots and a red subject diamond; shapes provide non-color
separation. QA covers calculations, source mapping, server rendering and production
compilation; browser visual/interaction testing is not part of these checks.

Price/status definitions: [RentCast valuation schema](https://developers.rentcast.io/reference/property-valuation-schema)
and [listing schema](https://developers.rentcast.io/reference/property-listings-schema).
