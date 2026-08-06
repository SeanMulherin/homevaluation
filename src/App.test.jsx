import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('initial dashboard', () => {
  it('server-renders the bundled White House analysis immediately', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('1600 Pennsylvania Avenue NW, Washington, DC 20500');
    expect(markup).toContain('Valuation summary');
    expect(markup).toContain('Washington, DC SFR benchmark');
    expect(markup).not.toContain('Loading property analysis');
    expect(markup).not.toContain('Wilmington, NC');
    expect(markup).not.toContain('1818 Cross Staff Pl');
  });
});
