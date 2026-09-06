import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import fixture from './test-fixtures/analysis-contract.synthetic.json';
import { proxyAnalysis } from './analysis-proxy';
import { dashboardDataFromApi } from './api';
import { factorAvailability, fitNeighborhoodModel, neighborhoodHomes, predictHome } from './regression';
import NeighborhoodRegression from './NeighborhoodRegression';

// Fabricated input emitted by the Flask endpoint with mocked provider responses.
// Verifies the Python -> same-origin route -> adapter -> model contract, not live freshness.
it('carries the backend neighborhood and source dates into a fitted model', async () => {
  const result = await proxyAnalysis(new Request('http://localhost/api/analysis', { method: 'POST', body: JSON.stringify({ address: fixture.subject.formatted_address }) }), async () => new Response(JSON.stringify(fixture)));
  const dashboard = dashboardDataFromApi(await result.json(), 'Subject');
  expect(dashboard.neighborhood.listings).toHaveLength(24);
  expect(dashboard.freshness.metadataAvailable).toBe(true);
  expect(dashboard.freshness.valuationRequestedAt).toBe(fixture.valuation.retrieved_at);
  const { rows } = neighborhoodHomes(dashboard.neighborhood.listings, dashboard.subject);
  const selected = factorAvailability(rows).filter(f => f.defaultSelected).map(f => f.key);
  const model = fitNeighborhoodModel(rows, selected);
  expect(model.ok).toBe(true);
  expect(model.n).toBe(24);
  expect(Number.isFinite(predictHome(model, dashboard.subject.regressionFacts).value)).toBe(true);
  const markup = renderToStaticMarkup(<NeighborhoodRegression subject={dashboard.subject} comparables={rows} source={dashboard.neighborhood} />);
  expect(markup).toContain('24 / 24');
  expect(markup).toContain('Last seen active');
  expect(markup).toContain('scroll horizontally');
  expect(markup).not.toContain('NaN');
});

it('retains nearby homes when the subject type is unknown and never plots a city benchmark as its price', () => {
  const dashboard = dashboardDataFromApi(fixture, 'Subject');
  const subject = { ...dashboard.subject, propertyType: 'Unknown', valuationSource: 'Zillow market benchmark', listingPrice: null };
  const markup = renderToStaticMarkup(<NeighborhoodRegression subject={subject} comparables={dashboard.neighborhood.listings} source={{ ...dashboard.neighborhood, property_type: null }} />);
  expect(markup).toContain('24 / 24');
  expect(markup).toContain('Subject AVM estimate: <strong>Unavailable');
});
