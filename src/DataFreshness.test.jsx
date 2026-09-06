import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import DataFreshness from './DataFreshness';
const data = { subject: { address: '123 Test St', valuationAsOf: 'Aug 2026', marketAsOf: 'Jul 2026', listingLookupStatus: 'error', listingLookupError: 'Listing provider unavailable' }, warnings: ['Listing provider unavailable'], freshness: {} };
const render = (props = {}) => renderToStaticMarkup(<DataFreshness dashboard={data} mode="snapshot" radius={1} maxAge={180} {...props} />);

describe('visible source freshness', () => {
  it('labels the bundled sample and shows failed initial refreshes', () => {
    const markup = render({ error: 'Could not reach provider' });
    expect(markup).toContain('Bundled sample');
    expect(markup).toContain('Snapshot dated Aug 2026');
    expect(markup).toContain('Refresh failed:');
    expect(markup).toContain('Could not reach provider');
    expect(markup).toContain('Listing provider unavailable');
  });
  it('discloses unknown freshness for a legacy response', () => {
    expect(render({ mode: 'api' })).toContain('does not report cache age');
  });
  it('identifies stale Zillow fallback and source retrieval separately', () => {
    const markup = render({ mode: 'api', dashboard: { ...data, freshness: { metadataAvailable: true, cacheStatus: 'hit', cacheAgeSeconds: 120,
      retrievedAt: '2026-09-06T19:00:00Z', receivedAt: '2026-09-06T19:02:00Z',
      marketSources: { sfr: { latest_date: '2026-06-30', fetched_at: '2026-08-06T12:00:00Z', stale: true } },
    } } });
    expect(markup).toContain('Server-cached analysis');
    expect(markup).toContain('120 seconds old');
    expect(markup).toContain('Stale fallback after failed refresh');
    expect(markup).toContain('2026-06-30');
  });
});
