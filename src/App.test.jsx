import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import App from './App';

describe('initial dashboard', () => {
  it('server-renders only the White House default while analysis loads', () => {
    const markup = renderToStaticMarkup(<App />);

    expect(markup).toContain('1600 Pennsylvania Avenue NW, Washington, DC 20500');
    expect(markup).toContain('Loading the White House analysis');
    expect(markup).not.toContain('Wilmington, NC');
    expect(markup).not.toContain('1818 Cross Staff Pl');
  });
});
