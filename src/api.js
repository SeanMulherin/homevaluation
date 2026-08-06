export const ANALYSIS_API_URL = 'https://web-app-housing.onrender.com/api/analysis';
const ANALYSIS_CACHE_PREFIX = 'housing-market-lab:analysis:v1:';

const safeNumber = (value, fallback = 0) => {
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

export function readCachedDashboard(address, storage) {
  try {
    const value = browserStorage(storage)?.getItem(analysisCacheKey(address));
    if (!value) return null;
    return JSON.parse(value)?.dashboard || null;
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
  const comparables = (payload.comparables || [])
    .filter((comparable) => comparable.price != null && comparable.square_footage != null)
    .map((comparable, index) => {
      const comparableAddress = comparable.formatted_address || comparable.address_line_1 || `Comparable ${index + 1}`;
      const status = comparable.status || 'Unknown';
      return {
        address: comparableAddress.split(',')[0],
        fullAddress: comparableAddress,
        location: locationFromAddress(comparableAddress),
        status,
        zillowUrl: status.toLowerCase() === 'active' ? zillowListingUrl(comparableAddress) : null,
        price: safeNumber(comparable.price),
        beds: safeNumber(comparable.bedrooms),
        baths: safeNumber(comparable.bathrooms),
        sqft: safeNumber(comparable.square_footage),
        distance: safeNumber(comparable.distance),
        fit: safeNumber(comparable.correlation),
      };
    });

  const squareFeet = safeNumber(rawSubject.square_footage, 2000);
  const lotSqft = safeNumber(rawSubject.lot_size);
  return {
    subject: {
      address,
      city: rawSubject.city || market.location?.split(',')[0] || '',
      state: rawSubject.state || market.location?.split(',')[1]?.trim() || '',
      zip: rawSubject.zip_code || '',
      propertyType: rawSubject.property_type || 'Single Family',
      estimate,
      low: safeNumber(valuation.price_range_low, estimate),
      high: safeNumber(valuation.price_range_high, estimate),
      beds: safeNumber(rawSubject.bedrooms, 3),
      baths: safeNumber(rawSubject.bathrooms, 2),
      squareFeet,
      lotSqft,
      acres: lotSqft ? lotSqft / 43560 : 0.15,
      yearBuilt: safeNumber(rawSubject.year_built, 1990),
      lastSalePrice: safeNumber(rawSubject.last_sale_price),
      lastSaleDate: rawSubject.last_sale_date || 'Not available',
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
    comparables,
    warnings: payload.warnings || [],
  };
}

export async function fetchAddressAnalysis(address, fetchImpl = fetch) {
  const response = await fetchImpl(ANALYSIS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address,
      period: '10',
      period_unit: 'year',
    }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Address analysis could not be loaded.');
  return dashboardDataFromApi(payload, address);
}
