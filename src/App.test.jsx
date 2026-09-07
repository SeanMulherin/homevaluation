import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('initial dashboard', () => {
  it('server-renders the bundled White House analysis immediately', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('Insert the full address of the house of interest...');
    expect(markup).toContain('https://seanmulherin.github.io/papers.html');
    expect(markup).toContain('Valuation summary');
    expect(markup).toContain('Washington, DC SFR benchmark');
    expect(markup).not.toContain('id="comparables"');
    expect(markup).toContain('Comparable deal assessment');
    expect(markup).toContain('Comp-supported value');
    expect(markup).not.toContain('Loading property analysis');
    expect(markup).not.toContain('Wilmington, NC');
    expect(markup).not.toContain('1818 Cross Staff Pl');
  });
});

it('shows the six factor figures and explains the bundled missing-data limits', () => {
  const markup = renderToStaticMarkup(<App />);
  for (const title of ['square footage', 'bedrooms', 'bathrooms', 'acres', 'year built', 'listing status']) {
    expect(markup).toContain(`Price vs. ${title}`);
  }
  expect(markup).toContain('Leave-one-out RMSE');
  expect(markup).toContain('Neighborhood listings are not available in this response');
  expect(markup).toContain('<h2>Neighborhood Pricing Model</h2>');
  expect(markup).not.toContain('data-freshness__heading');
  expect(markup).toContain('Not reported');
  expect(markup).not.toContain('returned neighborhood listings');
  expect(markup).not.toContain('Excluded before modeling:');
  expect(markup).not.toContain('NaN');
  expect(markup).not.toContain('Infinity');
});
