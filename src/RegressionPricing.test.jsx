import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import RegressionPricing, { regressionPriceComparison } from './RegressionPricing';
import { dashboardDataFromApi } from './api';
import { factorAvailability, fitNeighborhoodModel, predictHome } from './regression';
import fixture from './test-fixtures/analysis-contract.synthetic.json';
const render = (props = {}) => renderToStaticMarkup(<RegressionPricing model={{ ok: true, n: 24, looRmse: 60000 }} prediction={{ value: 500000, missing: [], outside: [] }} comparisonPrice={450000} comparisonLabel="Subject asking price" priceOverride="" onPriceChange={() => {}} {...props} />);
it('measures asking-price premiums and discounts against the model denominator', () => {
  expect(regressionPriceComparison(500000, 450000)).toEqual({ difference: -50000, percent: -10, direction: 'below' });
  expect(regressionPriceComparison(500000, 550000)).toEqual({ difference: 50000, percent: 10, direction: 'above' });
  expect(regressionPriceComparison(500000, 500000)).toEqual({ difference: 0, percent: 0, direction: 'equal' });
  for (const value of [null, 0, -1, NaN, Infinity]) {
    expect(regressionPriceComparison(value, 500000)).toBeNull();
    expect(regressionPriceComparison(500000, value)).toBeNull();
  }
});
it('uses an entered price ahead of the observed asking price and flags error-scale gaps', () => {
  const html = render({ priceOverride: '550000' });
  expect(html).toContain('Entered price');
  expect(html).toContain('10% above');
  expect(html).toContain('$50,000');
  expect(html).toContain('This difference is inconclusive');
});
it('shows signed dollar and percentage gaps', () => {
  expect(render()).toContain('−$50,000');
  expect(render()).toContain('−10%');
  expect(render({ comparisonPrice: 550000 })).toContain('+$50,000');
  expect(render({ comparisonPrice: 550000 })).toContain('+10%');
});
it('uses a clearly labeled AVM fallback without inventing a comparison price', () => {
  const avm = render({ comparisonPrice: 480000, comparisonLabel: 'Subject AVM estimate' });
  expect(avm).toContain('RentCast address-level estimate');
  expect(avm).toContain('−4%');
  const html = render({ comparisonPrice: null });
  expect(html).toContain('$500,000');
  expect(html).toContain('Not provided');
  expect(html).not.toContain('Potentially undervalued');
  expect(html).not.toContain('Potentially overvalued');
});
it('withholds assessments for unfitted models, missing subject facts, and nonpositive predictions', () => {
  for (const props of [
    { model: { ok: false, reason: 'Insufficient observations' } },
    { prediction: { value: null, missing: ['Bedrooms'], outside: [] } },
    { prediction: { value: -500, missing: [], outside: [] } },
  ]) {
    const html = render(props);
    expect(html).not.toContain('Potentially undervalued');
    expect(html).not.toContain('Potentially overvalued');
    expect(html).not.toContain('NaN');
    expect(html).toContain('Unavailable');
  }
});
it('uses the actual fitted subject prediction and flags extrapolation', () => {
  const dashboard = dashboardDataFromApi(fixture, 'Subject');
  const rows = dashboard.neighborhood.listings;
  const selected = factorAvailability(rows).filter(f => f.defaultSelected).map(f => f.key);
  const model = fitNeighborhoodModel(rows, selected);
  const prediction = predictHome(model, dashboard.subject.regressionFacts);
  expect(model.ok).toBe(true);
  const html = render({ model, prediction: { ...prediction, outside: ['Square footage'] }, comparisonPrice: prediction.value * 0.9 });
  expect(html).toContain('10% below');
  expect(html).toContain('extrapolates beyond the observed range');
});
