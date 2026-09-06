import { describe, expect, it, vi } from 'vitest';
import {
  dashboardDataFromApi,
  fetchAddressAnalysis,
  readCachedDashboard,
  writeCachedDashboard,
  zillowListingUrl,
} from './api';

const payload = {
  subject: {
    formatted_address: '1600 Pennsylvania Avenue NW, Washington, DC 20500',
    city: 'Washington',
    state: 'DC',
    bedrooms: 6,
    bathrooms: 35,
    square_footage: 55000,
    lot_size: 784080,
    year_built: 1800,
    listing_status: 'Active',
    listing_price: 99000000,
    listed_date: '2026-07-15T00:00:00.000Z',
    days_on_market: 22,
  },
  valuation: { price: 100000000, price_range_low: 90000000, price_range_high: 110000000, source: 'RentCast AVM', as_of: '2026-07-15' },
  market: {
    location: 'Washington, DC',
    latest_value: 600000,
    sfr_latest_value: 650000,
    latest_date: '2026-06-30',
    primary_label: 'Single-family homes',
    sfr_series: [{ date: '2026-05-31', value: 640000 }, { date: '2026-06-30', value: 650000 }],
    bedroom_series: [],
  },
  comparables: [{ formatted_address: '1 First St, Washington, DC 20001', status: 'Active', price: 900000, square_footage: 2000, bedrooms: 3, bathrooms: 2, distance: 1.2, correlation: 0.94 }],
  warnings: [],
};

describe('address analysis adapter', () => {
  it('maps API data into every dashboard dataset', () => {
    const result = dashboardDataFromApi(payload, 'fallback address');
    expect(result.subject.address).toContain('Pennsylvania');
    expect(result.subject.marketBenchmark).toBe(650000);
    expect(result.subject.listingPrice).toBe(99000000);
    expect(result.subject.listingStatus).toBe('Active');
    expect(result.market.history).toHaveLength(2);
    expect(result.market.hasBedroomSeries).toBe(false);
    expect(result.market.history[0].bedroom).toBeNull();
    expect(result.comparables[0].location).toBe('Washington, DC 20001');
    expect(result.comparables[0].zillowUrl).toBe(zillowListingUrl(payload.comparables[0].formatted_address));
  });

  it('adds Zillow links only to active comparable listings', () => {
    const result = dashboardDataFromApi({
      ...payload,
      comparables: [
        payload.comparables[0],
        { ...payload.comparables[0], formatted_address: '2 Second St, Washington, DC 20001', status: 'Inactive' },
      ],
    }, 'fallback address');

    expect(result.comparables[0].zillowUrl).toContain('zillow.com/homes/');
    expect(result.comparables[1].zillowUrl).toBeNull();
  });

  it('keeps a distinct bedroom series when Zillow provides one', () => {
    const result = dashboardDataFromApi({
      ...payload,
      market: {
        ...payload.market,
        primary_label: '4 bedroom homes',
        bedroom_series: [{ date: '2026-05-31', value: 700000 }, { date: '2026-06-30', value: 710000 }],
      },
    }, 'fallback address');

    expect(result.market.hasBedroomSeries).toBe(true);
    expect(result.market.history.map((point) => point.bedroom)).toEqual([700000, 710000]);
  });

  it('posts the requested address to the backend', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, json: async () => payload });
    await fetchAddressAnalysis('1600 Pennsylvania Avenue NW, Washington, DC 20500', fetchImpl);
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body).address).toContain('Pennsylvania');
  });

  it('stores and restores dashboard data for instant repeat loads', () => {
    const values = new Map();
    const storage = {
      getItem: (key) => values.get(key) || null,
      setItem: (key, value) => values.set(key, value),
    };
    const dashboard = dashboardDataFromApi(payload, 'fallback address');

    writeCachedDashboard('1600 Pennsylvania Avenue NW, Washington, DC 20500', dashboard, storage);

    expect(readCachedDashboard('  1600  Pennsylvania Avenue NW, Washington, DC 20500 ', storage)).toEqual(dashboard);
  });
});

describe('regression source fields', () => {
  it('preserves acreage, construction year, property identity and missing values', () => {
    const data = dashboardDataFromApi({
      subject: { bedrooms: null, square_footage: null, bathrooms: '', lot_size: null, year_built: null },
      comparables: [
        { id: 'unit-1', formatted_address: '1 Main St, Apt 1', price: 500000, square_footage: 1500, bedrooms: 0, bathrooms: null, lot_size: 43560, year_built: 1998, property_type: 'Condo' },
        { price: 500000, square_footage: 1500, bedrooms: '', bathrooms: '', lot_size: null, year_built: null },
      ],
    }, 'Subject');
    expect(data.comparables[0]).toMatchObject({ id: 'unit-1', fullAddress: '1 Main St, Apt 1', acres: 1, yearBuilt: 1998, beds: 0, baths: null, propertyType: 'Condo' });
    expect(data.comparables[1]).toMatchObject({ acres: null, yearBuilt: null, beds: null, baths: null });
    expect(data.subject.regressionFacts).toMatchObject({ sqft: null, beds: null, baths: null, acres: null, yearBuilt: null, status: 'Unknown' });
  });
});

it('retains non-sqft listings for other factor plots and rejects boolean observations', () => {
  const data = dashboardDataFromApi({ comparables: [
    { price: 500000, square_footage: null, bedrooms: 3, year_built: 1990 },
    { price: true, square_footage: true, bedrooms: 3 },
  ] }, 'Subject');
  expect(data.regressionComparables).toHaveLength(2);
  expect(data.regressionComparables[0]).toMatchObject({ price: 500000, sqft: null, beds: 3, yearBuilt: 1990 });
  expect(data.regressionComparables[1]).toMatchObject({ price: null, sqft: null });
  expect(data.comparables).toHaveLength(0);
});

it('expires browser data after an hour and rejects undated cache records', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  writeCachedDashboard('test', { subject: {} }, storage);
  expect(readCachedDashboard('test', storage)).toEqual({ subject: {} });
  expect(readCachedDashboard('test', storage, Date.now() + 3600001)).toBeNull();
  const key = [...values.keys()][0];
  values.set(key, JSON.stringify({ dashboard: { subject: {} } }));
  expect(readCachedDashboard('test', storage)).toBeNull();
});

it('separates neighborhood listings from AVM comparables and preserves source dates', () => {
  const data = dashboardDataFromApi({ ...payload,
    subject: { ...payload.subject, listing_lookup_status: 'error', listing_lookup_error: 'unavailable' },
    neighborhood: { status: 'ok', radius_miles: 1, property_type: 'Single Family', listings: [{ id: 'nearby', price: 850000, square_footage: 2500, last_seen_date: '2026-09-06T12:00:00Z' }] },
    data_freshness: { retrieved_at: '2026-09-06T13:00:00Z', cache_age_seconds: 300, cache_status: 'hit' },
    market: { ...payload.market, sources: { sfr: { stale: true, latest_date: '2026-06-30' } } },
  }, 'Subject');
  expect(data.neighborhood.listings[0]).toMatchObject({ id: 'nearby', sqft: 2500, lastSeenDate: '2026-09-06T12:00:00Z' });
  expect(data.comparables).toHaveLength(1);
  expect(data.freshness).toMatchObject({ cacheStatus: 'hit', cacheAgeSeconds: 300, marketSources: { sfr: { stale: true, latest_date: '2026-06-30' } } });
  expect(data.subject.listingLookupStatus).toBe('error');
});

it('preserves absent valuation ranges and does not turn a market month into a request timestamp', () => {
  const data = dashboardDataFromApi({ subject: {}, valuation: { price: 450000, source: 'Zillow market benchmark', as_of: '2026-07-31' } }, 'Subject');
  expect(data.subject.low).toBeNull();
  expect(data.subject.high).toBeNull();
  expect(data.freshness.valuationRequestedAt).toBeNull();
});

it('does not extend an old server analysis by saving it in the browser again', () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  writeCachedDashboard('test', { freshness: { retrievedAt: new Date(Date.now() - 3600001).toISOString() } }, storage);
  expect(readCachedDashboard('test', storage)).toBeNull();
});
