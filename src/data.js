export const subject = {
  address: '1623 Landfall Dr, Wilmington, NC 28405',
  city: 'Wilmington',
  state: 'NC',
  zip: '28405',
  estimate: 786000,
  low: 650000,
  high: 922000,
  beds: 3,
  baths: 2.5,
  squareFeet: 2474,
  lotSqft: 7405,
  acres: 0.17,
  yearBuilt: 1990,
  lastSalePrice: 480000,
  lastSaleDate: 'May 19, 2014',
  marketBenchmark: 434345,
  marketAsOf: 'Apr 2026',
  valuationAsOf: 'May 29, 2026',
};

export const comparables = [
  { address: '1818 Cross Staff Pl', status: 'Inactive', price: 1100000, beds: 3, baths: 2.5, sqft: 2645, distance: 0.85, fit: 0.97 },
  { address: '904 Bedminister Ln', status: 'Inactive', price: 749000, beds: 3, baths: 2.5, sqft: 2426, distance: 1.54, fit: 0.97 },
  { address: '1905 Staunton Ct', status: 'Inactive', price: 679900, beds: 3, baths: 2.5, sqft: 1990, distance: 0.42, fit: 0.96 },
  { address: '1905 Staunton Ct, Lot 46', status: 'Inactive', price: 679900, beds: 3, baths: 2.5, sqft: 1990, distance: 0.42, fit: 0.96 },
  { address: '1208 Clipper Ln', status: 'Inactive', price: 599900, beds: 3, baths: 2.5, sqft: 1965, distance: 1.18, fit: 0.95 },
  { address: '1208 Clipper Ln, Lot 15', status: 'Inactive', price: 599900, beds: 3, baths: 2.5, sqft: 1965, distance: 1.18, fit: 0.95 },
  { address: '1921 Prestwick Ln', status: 'Active', price: 945000, beds: 3, baths: 2, sqft: 2068, distance: 0.41, fit: 0.94 },
  { address: '1846 Glen Eagles Ln', status: 'Active', price: 785000, beds: 3, baths: 2, sqft: 2058, distance: 0.48, fit: 0.94 },
  { address: '1305 Portside Dr', status: 'Active', price: 585000, beds: 3, baths: 2.5, sqft: 1771, distance: 1.13, fit: 0.94 },
  { address: '1336 S Moorings Dr', status: 'Active', price: 964000, beds: 3, baths: 3, sqft: 2573, distance: 1.51, fit: 0.94 },
  { address: '1957 Prestwick Ln', status: 'Inactive', price: 710000, beds: 3, baths: 2, sqft: 1941, distance: 0.42, fit: 0.93 },
  { address: '1913 Prestwick Ln', status: 'Inactive', price: 749000, beds: 3, baths: 2, sqft: 1931, distance: 0.44, fit: 0.93 },
  { address: '1913 Prestwick Ln, Lot 5R', status: 'Inactive', price: 799000, beds: 3, baths: 2, sqft: 1931, distance: 0.44, fit: 0.93 },
  { address: '1943 Prestwick Ln', status: 'Inactive', price: 779000, beds: 3, baths: 2, sqft: 1885, distance: 0.36, fit: 0.93 },
  { address: '1310 Regatta Dr', status: 'Inactive', price: 839000, beds: 3, baths: 2, sqft: 1917, distance: 0.51, fit: 0.93 },
];

function monthLabel(date) {
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

export function buildMarketHistory() {
  const points = [];
  const start = new Date(2016, 3, 1);
  for (let index = 0; index <= 120; index += 1) {
    const date = new Date(start.getFullYear(), start.getMonth() + index, 1);
    const progress = index / 120;
    const pandemicLift = index < 50 ? 0 : 124000 / (1 + Math.exp(-(index - 70) / 7));
    const cooling = index < 91 ? 0 : (index - 91) * 930;
    const seasonality = Math.sin(index / 6) * 3600;
    const city = 225000 + progress * 118000 + pandemicLift - cooling + seasonality;
    const bedroom = city * 1.085 + 8500 + Math.cos(index / 8) * 3200;
    points.push({
      date: monthLabel(date),
      iso: date.toISOString().slice(0, 7),
      city: Math.round(city),
      bedroom: Math.round(bedroom),
    });
  }
  const scale = subject.marketBenchmark / points.at(-1).city;
  return points.map((point) => ({
    ...point,
    city: Math.round(point.city * scale),
    bedroom: Math.round(point.bedroom * scale),
  }));
}

export const marketHistory = buildMarketHistory();
