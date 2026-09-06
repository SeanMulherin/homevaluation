import { describe, expect, it, vi } from 'vitest';
import { proxyAnalysis, HOUSING_BACKEND_URL } from './analysis-proxy';
const request = (body) => new Request('http://localhost:3000/api/analysis', { method: 'POST', body: JSON.stringify(body) });

describe('same-origin analysis route', () => {
  it('forwards only supported fields to the fixed backend, without browser-origin headers', async () => {
    const upstream = vi.fn().mockResolvedValue(new Response(JSON.stringify({ subject: { address: 'a' }, market: {}, data_freshness: { retrieved_at: '2026-09-06T19:00:00Z', cache_status: 'miss' } })));
    const result = await proxyAnalysis(request({ address: ' 123 Test St ', force_refresh: true, neighborhood_radius_miles: 2, target: 'http://evil.invalid', api_key: 'untrusted' }), upstream);
    expect(result.status).toBe(200);
    expect(upstream.mock.calls[0][0]).toBe(HOUSING_BACKEND_URL);
    expect(upstream.mock.calls[0][1].headers).not.toHaveProperty('Origin');
    expect(JSON.parse(upstream.mock.calls[0][1].body)).toEqual({ address: '123 Test St', period: '10', period_unit: 'year', force_refresh: true, neighborhood_radius_miles: 2, neighborhood_max_age_days: 180 });
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect((await result.json()).data_freshness).toMatchObject({ metadata_available: true, refresh_requested: true });
  });
  it('does not claim source freshness when the older backend only reports a cache header', async () => {
    const result = await proxyAnalysis(request({ address: '123 Test St', force_refresh: true }), async () => new Response(JSON.stringify({ subject: {}, market: {} }), { headers: { 'X-Analysis-Cache': 'HIT' } }));
    const body = await result.json();
    expect(body.data_freshness).toMatchObject({ cache_status: 'hit', metadata_available: false });
    expect(body.data_freshness.retrieved_at).toBeUndefined();
  });
  it('rejects invalid requests without contacting the backend', async () => {
    const upstream = vi.fn();
    for (const body of [{}, { address: 'a', force_refresh: 'true' }, { address: 'a', neighborhood_radius_miles: 10 }, { address: 'a', neighborhood_max_age_days: -2 }]) {
      expect((await proxyAnalysis(request(body), upstream)).status).toBe(400);
    }
    expect(upstream).not.toHaveBeenCalled();
  });
  it('returns a visible refresh failure for unavailable or malformed upstream responses', async () => {
    for (const upstream of [async () => { throw new Error('network'); }, async () => new Response('<html>unavailable</html>'), async () => new Response('{}')]) {
      const result = await proxyAnalysis(request({ address: 'a' }), upstream);
      expect(result.status).toBe(502);
      expect((await result.json()).error).toBeTruthy();
    }
  });
});
