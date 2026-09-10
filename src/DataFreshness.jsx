import { useEffect, useState } from 'react';

export function sourceDate(value) {
  if (value == null || value === '') return 'Not reported';
  const date = new Date(typeof value === 'number' ? value * 1000 : value);
  return Number.isNaN(date.getTime()) ? 'Not reported' : new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }).format(date) + ' UTC';
}

export function NeighborhoodScopeControls({ loading, radius, maxAge, onScopeChange }) {
  return <div className="neighborhood-scope-controls" aria-label="Neighborhood comparison settings">
    <label>Neighborhood radius
      <select value={radius} disabled={loading} onChange={(event) => onScopeChange(Number(event.target.value), maxAge)}>
        <option value="0.5">0.5 mile</option><option value="1">1 mile</option><option value="2">2 miles</option><option value="5">5 miles</option>
      </select>
    </label>
    <label>Last seen on market
      <select value={maxAge} disabled={loading} onChange={(event) => onScopeChange(radius, Number(event.target.value))}>
        <option value="30">Within 30 days</option><option value="90">Within 90 days</option><option value="180">Within 180 days</option><option value="365">Within 365 days</option>
      </select>
    </label>
  </div>;
}

export default function DataFreshness({ dashboard, mode, loading, error }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(timer); }, []);
  const freshness = dashboard.freshness || {};
  const fetched = Date.parse(freshness.retrievedAt || freshness.receivedAt);
  const age = Number.isFinite(fetched) ? Math.max(0, (now - fetched) / 1000) : null;
  const expired = age != null && age >= (freshness.cacheTtlSeconds || 3600);
  const sourceRows = Object.entries(freshness.marketSources || {}).filter(([, source]) => source);
  return <section className="data-freshness" aria-label="Data sources and freshness">
    <p className="data-source-summary">Prices and home facts: RentCast. City history: Zillow’s monthly index. Zillow and Redfin listing pages are separate sources.</p>
    {error && <p className="data-freshness__error" role="alert">Refresh failed: {error} Displayed results remain for {dashboard.subject.address}.</p>}
    {mode !== 'snapshot' && !freshness.metadataAvailable && <p className="data-freshness__warning">This backend does not report cache age or confirm a fresh source lookup. The response may be cached.</p>}
    {expired && !loading && <p className="data-freshness__warning">This analysis is older than its refresh interval. Refresh before relying on current listing status.</p>}
    <details><summary>Source dates and retrieval details</summary>
      <dl><div><dt>Analysis cache</dt><dd>{freshness.cacheStatus || 'Not reported'}{freshness.cacheAgeSeconds != null ? ` · ${Math.round(freshness.cacheAgeSeconds)} seconds old when served` : ' · age not reported'}</dd></div>
        <div><dt>AVM requested</dt><dd>{sourceDate(freshness.valuationRequestedAt)}; request time is not a property-record update date.</dd></div>
        <div><dt>Subject listing lookup</dt><dd>{dashboard.subject.listingLookupStatus}{dashboard.subject.listingLookupError ? `: ${dashboard.subject.listingLookupError}` : ''}</dd></div>
        {sourceRows.map(([key, source]) => <div key={key}><dt>Zillow {key === 'sfr' ? 'single-family' : 'bedroom'} index</dt><dd>Data month: {source.latest_date || 'Not reported'} · File fetched: {sourceDate(source.fetched_at)}{source.stale ? ' · Stale fallback after failed refresh' : ''}{source.refresh_error ? ` · ${source.refresh_error}` : ''}</dd></div>)}
        {!sourceRows.length && <div><dt>Zillow data month</dt><dd>{dashboard.subject.marketAsOf}; download timestamp not reported.</dd></div>}
      </dl>
    </details>
    {sourceRows.some(([, source]) => source.stale) && <p className="data-freshness__warning">Zillow could not be refreshed. The market history uses a previously downloaded file; its date is shown above.</p>}
    {dashboard.warnings?.length > 0 && <ul className="data-freshness__warnings">{dashboard.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>}
  </section>;
}
