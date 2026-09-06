// Ordinary least squares in dollars. No AVM estimates or display defaults enter training.
export const FACTORS = [
  { key: 'sqft', label: 'Square footage', axis: 'Living area (sqft)', unit: 'per 100 sqft', increment: 100 },
  { key: 'beds', label: 'Bedrooms', axis: 'Bedrooms', unit: 'per bedroom', increment: 1 },
  { key: 'baths', label: 'Bathrooms', axis: 'Bathrooms', unit: 'per bathroom', increment: 1 },
  { key: 'acres', label: 'Acres', axis: 'Lot size (acres)', unit: 'per 0.1 acre', increment: 0.1 },
  { key: 'yearBuilt', label: 'Year built', axis: 'Year built', unit: 'per 10 years newer', increment: 10 },
  { key: 'active', label: 'Listing status', axis: 'Listing status', unit: 'active vs. inactive', increment: 1 },
  { key: 'distance', label: 'Distance', axis: 'Distance from subject (mi)', unit: 'per mile', increment: 1 },
];

export function factorValue(home, key) {
  if (key === 'active') {
    const status = String(home.status || '').trim().toLowerCase();
    return status === 'active' ? 1 : status === 'inactive' ? 0 : null;
  }
  const value = home[key];
  if (!Number.isFinite(value)) return null;
  if (['sqft', 'acres', 'yearBuilt'].includes(key) ? value <= 0 : value < 0) return null;
  return value;
}

// Keep apartment/unit text: multiple homes can share the same street address.
const addressKey = (value) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
export function neighborhoodHomes(comparables, subject = {}) {
  const rows = [];
  const ids = new Map();
  const addresses = new Map();
  const subjectAddress = addressKey(subject.fullAddress || subject.address);
  const excluded = { subject: 0, duplicates: 0, price: 0 };
  for (const home of comparables) {
    const address = addressKey(home.fullAddress || home.address);
    if ((subject.id && home.id === subject.id) || (subjectAddress && address === subjectAddress)) {
      excluded.subject += 1;
      continue;
    }
    if (!Number.isFinite(home.price) || home.price <= 0) {
      excluded.price += 1;
      continue;
    }
    const prior = (home.id && ids.get(home.id)) ?? (address && addresses.get(address));
    if (Number.isInteger(prior)) {
      excluded.duplicates += 1;
      // Retain the latest observation when timestamps exist; otherwise the first.
      if ((Date.parse(home.lastSeenDate) || 0) > (Date.parse(rows[prior].lastSeenDate) || 0)) rows[prior] = home;
      if (home.id) ids.set(home.id, prior);
      if (address) addresses.set(address, prior);
      continue;
    }
    if (home.id) ids.set(home.id, rows.length);
    if (address) addresses.set(address, rows.length);
    rows.push(home);
  }
  return { rows, excluded };
}

export function factorAvailability(rows) {
  return FACTORS.map((factor) => {
    const values = rows.map((row) => factorValue(row, factor.key)).filter((value) => value != null);
    const distinct = new Set(values).size;
    const reason = !values.length ? 'Not reported' : distinct < 2 ? 'No variation' : null;
    return { ...factor, count: values.length, reason, defaultSelected: !reason && factor.key !== 'distance' && values.length >= 8 && values.length >= rows.length * 0.8 };
  });
}

const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);
const mean = (a) => a.reduce((sum, value) => sum + value, 0) / a.length;

export function fitNeighborhoodModel(rows, selectedKeys) {
  const availability = factorAvailability(rows);
  const selected = availability.filter((factor) => selectedKeys.includes(factor.key));
  const omitted = selected.filter((factor) => factor.reason).map(({ key, label, reason }) => ({ key, label, reason }));
  const candidates = selected.filter((factor) => !factor.reason);
  const training = rows.filter((home) => Number.isFinite(home.price) && home.price > 0 && candidates.every(({ key }) => factorValue(home, key) != null));
  const result = { ok: false, rows: training, n: training.length, missingCount: rows.length - training.length, omitted, factors: [], coefficients: [] };
  if (!candidates.length) return { ...result, reason: 'Select at least one factor with reported values that vary across homes.' };
  if (training.length < 8) return { ...result, reason: `Only ${training.length} complete homes. At least 8 are required; deselect sparse factors or broaden the listing filter.` };

  const n = training.length;
  const q = [Array(n).fill(1 / Math.sqrt(n))];
  const r = [[Math.sqrt(n)]];
  const factors = [];
  // Reorthogonalized, centered/scaled QR avoids unstable normal-equation inversion.
  for (const factor of candidates) {
    const values = training.map((home) => factorValue(home, factor.key));
    const center = mean(values);
    const scale = Math.sqrt(mean(values.map((value) => (value - center) ** 2)));
    if (scale <= Number.EPSILON * Math.max(1, Math.abs(center)) * 100) {
      omitted.push({ ...factor, reason: 'No variation in complete homes' });
      continue;
    }
    const residual = values.map((value) => (value - center) / scale);
    const projections = Array(q.length).fill(0);
    for (let pass = 0; pass < 2; pass += 1) {
      q.forEach((column, j) => {
        const projection = dot(column, residual);
        projections[j] += projection;
        residual.forEach((_, i) => { residual[i] -= projection * column[i]; });
      });
    }
    const norm = Math.sqrt(dot(residual, residual));
    if (norm < Math.sqrt(n) * 1e-8) {
      omitted.push({ ...factor, reason: 'Redundant with other selected factors' });
      continue;
    }
    const k = q.length;
    r.forEach((row, j) => { row[k] = projections[j]; });
    r.push([...Array(k).fill(0), norm]);
    q.push(residual.map((value) => value / norm));
    factors.push({ ...factor, center, scale, min: Math.min(...values), max: Math.max(...values) });
  }
  const p = q.length;
  if (!factors.length) return { ...result, reason: 'Selected factors do not vary in the complete homes.' };
  if (n - p < 3) return { ...result, factors, reason: `${n} complete homes cannot support ${factors.length} factors with an intercept and at least 3 residual degrees of freedom. Select fewer factors.` };

  const y = training.map((home) => home.price);
  const beta = q.map((column) => dot(column, y));
  for (let j = p - 1; j >= 0; j -= 1) {
    for (let k = j + 1; k < p; k += 1) beta[j] -= r[j][k] * beta[k];
    beta[j] /= r[j][j];
  }
  const coefficients = factors.map((factor, i) => ({ ...factor, value: beta[i + 1] / factor.scale }));
  const intercept = beta[0] - coefficients.reduce((sum, factor) => sum + factor.center * factor.value, 0);
  const predictions = training.map((home) => intercept + coefficients.reduce((sum, factor) => sum + factor.value * factorValue(home, factor.key), 0));
  const residuals = y.map((value, i) => value - predictions[i]);
  const sse = dot(residuals, residuals);
  const yMean = mean(y);
  const sst = y.reduce((sum, value) => sum + (value - yMean) ** 2, 0);
  const rSquared = sst > 0 ? 1 - sse / sst : null;
  const leverage = training.map((_, i) => q.reduce((sum, column) => sum + column[i] ** 2, 0));
  const looRmse = leverage.some((h) => 1 - h < 1e-8) ? null : Math.sqrt(mean(residuals.map((e, i) => (e / (1 - leverage[i])) ** 2)));
  return { ...result, ok: true, factors, coefficients, intercept, predictions, residuals,
    rSquared, adjustedRSquared: rSquared == null ? null : 1 - (1 - rSquared) * (n - 1) / (n - p),
    rmse: Math.sqrt(sse / n), looRmse, degreesOfFreedom: n - p };
}

export function predictHome(model, home) {
  if (!model.ok) return { value: null, missing: [], outside: [] };
  const missing = model.factors.filter(({ key }) => factorValue(home, key) == null).map(({ label }) => label);
  const outside = model.factors.filter(({ key, min, max }) => {
    const value = factorValue(home, key);
    return value != null && (value < min || value > max);
  }).map(({ label }) => label);
  if (missing.length) return { value: null, missing, outside };
  const value = model.intercept + model.coefficients.reduce((sum, factor) => sum + factor.value * factorValue(home, factor.key), 0);
  return { value: Number.isFinite(value) ? value : null, missing, outside };
}

export function factorPlot(rows, subject, subjectPrice, factor, model) {
  const points = rows.flatMap((home) => {
    const x = factorValue(home, factor.key);
    return x == null ? [] : [{ ...home, x, y: home.price }];
  });
  const subjectX = factorValue(subject, factor.key);
  const subjectPoint = subjectX != null && Number.isFinite(subjectPrice) && subjectPrice > 0
    ? { ...subject, x: subjectX, y: subjectPrice, isSubject: true } : null;
  const coefficient = model.ok && model.coefficients.find(({ key }) => key === factor.key);
  // A conditional slice through the multiple regression, holding others at training means.
  const line = coefficient && factor.key !== 'active' ? [coefficient.min, coefficient.max].map((x) => ({
    x, y: model.intercept + model.coefficients.reduce((sum, term) => sum + term.value * (term.key === factor.key ? x : term.center), 0),
  })) : [];
  return { points, subjectPoint, line, missingCount: rows.length - points.length, subjectX };
}
