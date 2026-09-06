export const ANALYSIS_API_URL = '/api/analysis';
export const DASHBOARD_CACHE_TTL_MS = 60 * 60 * 1000;
const ANALYSIS_CACHE_PREFIX = 'housing-market-lab:analysis:v5:';

// Display defaults are not observations: keep missing fields null for regression.
const observedNumber = (value) => {
  if (value == null || typeof value === 'boolean' || String(value).trim() === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const safeNumber = (value, fallback = 0) => {
  if (value == null || String(value).trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const locationFromAddress = (address) => {
  const parts = String(address || '').split(',').map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts.slice(1).join(', ') : '';
};

export const zillowListingUrl = (address) => (
  `https://www.zillow.com/homes/${encodeURIComponent(String(address || '').trim())}_rb/`
);

const displayMonth = (value) => {
  if (!value) return 'Not available';
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
};

const analysisCacheKey = (address) => (
  `${ANALYSIS_CACHE_PREFIX}${String(address || '').trim().toLowerCase().replace(/\s+/g, ' ')}`
);

const browserStorage = (storage) => {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
};

export function readCachedDashboard(address, storage, now = Date.now()) {
  try {
    const value = browserStorage(storage)?.getItem(analysisCacheKey(address));
    if (!value) return null;
    const record = JSON.parse(value);
    const timestamp = Date.parse(record?.cachedAt);
    if (!Number.isFinite(timestamp) || timestamp > now || now - timestamp >= DASHBOARD_CACHE_TTL_MS) return null;
    const generated = record.dashboard?.freshness?.retrievedAt;
    if (generated && (!Number.isFinite(Date.parse(generated)) || now - Date.parse(generated) >= DASHBOARD_CACHE_TTL_MS)) return null;
    return record.dashboard || null;
  } catch {
    return null;
  }
}

export function writeCachedDashboard(address, dashboard, storage) {
  try {
    browserStorage(storage)?.setItem(
      analysisCacheKey(address),
      JSON.stringify({ cachedAt: new Date().toISOString(), dashboard }),
    );
  } catch {
    // Browser storage is an optional performance enhancement.
  }
}

export function dashboardDataFromApi(payload, requestedAddress) {
  const rawSubject = payload.subject || {};
  const valuation = payload.valuation || {};
  const market = payload.market || {};
  const address = rawSubject.formatted_address || requestedAddress;
  const estimate = safeNumber(valuation.price || market.latest_value);
  const marketBenchmark = safeNumber(market.sfr_latest_value || market.latest_value);
  const citySeries = market.sfr_series || [];
  const bedroomSeries = market.bedroom_series || [];
  const hasBedroomSeries = bedroomSeries.length > 0;
  const bedroomByDate = new Map(bedroomSeries.map((point) => [point.date, safeNumber(point.value)]));
  const history = citySeries.map((point) => ({
    date: new Date(`${point.date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    iso: point.date.slice(0, 7),
    city: safeNumber(point.value),
    bedroom: hasBedroomSeries ? bedroomByDate.get(point.date) ?? null : null,
  }));
  const normalizeComparable = (comparable, index) => {
      const comparableAddress = comparable.formatted_address || comparable.address_line_1 || `Comparable ${index + 1}`;
      const status = comparable.status || 'Unknown';
      return {
        id: comparable.id || null,
        address: comparableAddress.split(',')[0],
        fullAddress: comparableAddress,
        location: locationFromAddress(comparableAddress),
        status,
        zillowUrl: status.toLowerCase() === 'active' ? zillowListingUrl(comparableAddress) : null,
        price: observedNumber(comparable.price),
        beds: observedNumber(comparable.bedrooms),
        baths: observedNumber(comparable.bathrooms),
        sqft: observedNumber(comparable.square_footage),
        acres: observedNumber(comparable.lot_size) == null ? null : observedNumber(comparable.lot_size) / 43560,
        yearBuilt: observedNumber(comparable.year_built),
        propertyType: comparable.property_type || 'Unknown',
        lastSeenDate: comparable.last_seen_date || null,
        listedDate: comparable.listed_date || null,
        distance: observedNumber(comparable.distance),
        fit: safeNumber(comparable.correlation),
      };
    };
  const regressionComparables = (payload.comparables || []).map(normalizeComparable);
  const neighborhood = payload.neighborhood ? {
    ...payload.neighborhood,
    listings: (payload.neighborhood.listings || []).map(normalizeComparable),
  } : null;

  // The older size-based views need sqft; regression and factor plots retain every row.
  const comparables = regressionComparables.filter((home) => home.price > 0 && home.sqft > 0);
  const squareFeet = observedNumber(rawSubject.square_footage);
  const lotSqft = safeNumber(rawSubject.lot_size);
  return {
    subject: {
      id: rawSubject.id || null,
      address,
      regressionFacts: {
        sqft: observedNumber(rawSubject.square_footage),
        beds: observedNumber(rawSubject.bedrooms),
        baths: observedNumber(rawSubject.bathrooms),
        acres: observedNumber(rawSubject.lot_size) == null ? null : observedNumber(rawSubject.lot_size) / 43560,
        yearBuilt: observedNumber(rawSubject.year_built),
        status: rawSubject.listing_status || 'Unknown',
        distance: 0,
      },
      city: rawSubject.city || market.location?.split(',')[0] || '',
      state: rawSubject.state || market.location?.split(',')[1]?.trim() || '',
      zip: rawSubject.zip_code || '',
      propertyType: rawSubject.property_type || 'Unknown',
      estimate,
      low: observedNumber(valuation.price_range_low),
      high: observedNumber(valuation.price_range_high),
      beds: observedNumber(rawSubject.bedrooms),
      baths: observedNumber(rawSubject.bathrooms),
      squareFeet,
      lotSqft,
      acres: lotSqft > 0 ? lotSqft / 43560 : null,
      yearBuilt: observedNumber(rawSubject.year_built),
      lastSalePrice: safeNumber(rawSubject.last_sale_price),
      lastSaleDate: rawSubject.last_sale_date || 'Not available',
      listingStatus: rawSubject.listing_status || null,
      listingLookupStatus: rawSubject.listing_lookup_status || 'unavailable',
      listingLookupError: rawSubject.listing_lookup_error || null,
      listingPrice: safeNumber(rawSubject.listing_price),
      listedDate: displayMonth(rawSubject.listed_date),
      listingLastSeenDate: displayMonth(rawSubject.listing_last_seen_date),
      daysOnMarket: safeNumber(rawSubject.days_on_market),
      marketBenchmark,
      marketAsOf: displayMonth(market.latest_date),
      valuationAsOf: displayMonth(valuation.as_of),
      valuationSource: valuation.source || 'Market benchmark',
    },
    market: {
      location: market.location || [rawSubject.city, rawSubject.state].filter(Boolean).join(', '),
      primaryLabel: market.primary_label || 'Single-family homes',
      hasBedroomSeries,
      history,
    },
    freshness: {
      retrievedAt: payload.data_freshness?.retrieved_at || null,
      receivedAt: payload.data_freshness?.received_at || null,
      cacheStatus: payload.data_freshness?.cache_status || 'unknown',
      cacheAgeSeconds: payload.data_freshness?.cache_age_seconds ?? null,
      cacheTtlSeconds: payload.data_freshness?.cache_ttl_seconds ?? null,
      metadataAvailable: payload.data_freshness?.metadata_available ?? Boolean(payload.data_freshness?.retrieved_at),
      refreshRequested: payload.data_freshness?.refresh_requested || false,
      valuationRequestedAt: valuation.retrieved_at || null,
      marketSources: market.sources || null,
    },
    neighborhood,
    comparables,
    regressionComparables,
    warnings: payload.warnings || [],
  };
}

export async function fetchAddressAnalysis(address, fetchImpl = fetch, options = {}) {
  const response = await fetchImpl(ANALYSIS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      period: '10',
      period_unit: 'year',
      force_refresh: options.forceRefresh === true,
      neighborhood_radius_miles: options.radiusMiles ?? 1,
      neighborhood_max_age_days: options.maxAgeDays ?? 180,
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Address analysis could not be loaded.');
  return dashboardDataFromApi(payload, address);
}
