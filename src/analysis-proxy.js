export const HOUSING_BACKEND_URL = 'https://web-app-housing.onrender.com/api/analysis';
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});

// Fixed upstream: never proxy arbitrary URLs, credentials, or browser headers.
export async function proxyAnalysis(request, fetchImpl = fetch, backendUrl = HOUSING_BACKEND_URL) {
  let input;
  try {
    const raw = await request.text();
    if (raw.length > 8192) return json({ error: 'Analysis request is too large.' }, 413);
    input = JSON.parse(raw);
  } catch {
    return json({ error: 'Enter a property address to analyze.' }, 400);
  }
  if (!input || typeof input.address !== 'string' || !input.address.trim() || input.address.length > 500) {
    return json({ error: 'Enter a valid property address.' }, 400);
  }
  const radius = Number(input.neighborhood_radius_miles ?? 1);
  const age = Number(input.neighborhood_max_age_days ?? 180);
  if (!Number.isFinite(radius) || radius < 0.1 || radius > 5 || !Number.isInteger(age) || age < 1 || age > 365 ||
      (input.force_refresh != null && typeof input.force_refresh !== 'boolean')) {
    return json({ error: 'Choose a radius between 0.1 and 5 miles and a listing age between 1 and 365 days.' }, 400);
  }
  const body = { address: input.address.trim(), period: '10', period_unit: 'year',
    neighborhood_radius_miles: radius, neighborhood_max_age_days: age, force_refresh: input.force_refresh === true };
  try {
    const response = await fetchImpl(backendUrl, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(120000), cache: 'no-store',
    });
    const payload = await response.json();
    if (!response.ok) return json({ error: payload.error || 'Property data could not be refreshed.' }, response.status >= 500 ? 502 : 400);
    if (!payload?.subject || !payload?.market) return json({ error: 'The data service returned an incomplete analysis.' }, 502);
    return json({ ...payload, data_freshness: {
      ...payload.data_freshness,
      received_at: new Date().toISOString(),
      cache_status: payload.data_freshness?.cache_status || response.headers.get('X-Analysis-Cache')?.toLowerCase() || 'unknown',
      metadata_available: Boolean(payload.data_freshness?.retrieved_at),
      refresh_requested: body.force_refresh,
    } });
  } catch {
    return json({ error: 'The data service could not be reached. The displayed data has not been refreshed. Please try again.' }, 502);
  }
}
