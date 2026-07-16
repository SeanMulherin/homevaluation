import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('initial dashboard', () => {
  it('server-renders a neutral loading state without Wilmington fallback data', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('1600 Pennsylvania Avenue NW, Washington, DC 20500');
    expect(markup).toContain('Loading property analysis');
    expect(markup).not.toContain('White House property profile');
    expect(markup).not.toContain('Wilmington, NC');
    expect(markup).not.toContain('1818 Cross Staff Pl');
  });
});
