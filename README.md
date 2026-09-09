# Home and Neighborhood Valuation Model

An interactive housing analysis application that combines a RentCast valuation and nearby listings with Zillow market history. The interface fits a selectable ordinary least squares price model, compares the subject property with nearby homes, and displays factor-specific figures.

## Public website

The frontend is published with GitHub Pages at:

https://seanmulherin.github.io/homevaluation/

GitHub Actions builds the React application from this repository. The browser sends analysis requests directly to the separately hosted housing API at `https://web-app-housing.onrender.com/api/analysis`; no ChatGPT Sites runtime or proxy is used.

## Local development

The existing Vinext development server remains available:

```bash
npm install
npm run dev
```

To build the same static files deployed to GitHub Pages:

```bash
npm run build:github
```

## Validation

```bash
npm test
npm run build:github
```

## Neighborhood regression

The price model uses unweighted ordinary least squares with an intercept on the returned RentCast comparable listings. It is a selected nearby listing set rather than a neighborhood census. Price means asking or last listed price; inactive does not mean sold. Radius and property-type filters apply to the model and its factor figures together. The subject is excluded from fitting; exact repeated property IDs or full addresses are deduplicated while apartment units are retained.

Selectable factors include square footage, bedrooms, bathrooms, acres, year built, active versus inactive status, and distance. The model uses complete observations, requires at least eight homes and three residual degrees of freedom, and reports constant or collinear factors that cannot be estimated. Adjusted R² and leave-one-out RMSE describe model fit and prediction error rather than appraisal certainty.

Figures are native Recharts scatterplots of listed price against each factor. They use shared price-axis limits and distinguish active, inactive, unknown-status, and subject-home observations. Conditional model lines hold other predictors at their training means.
