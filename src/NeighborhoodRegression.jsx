import { useMemo, useState } from 'react';
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis } from 'recharts';
import { FACTORS, factorAvailability, factorPlot, fitNeighborhoodModel, neighborhoodHomes, predictHome } from './regression';

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const decimal = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const showMoney = (value) => Number.isFinite(value) ? usd.format(value) : 'Unavailable';
const showR2 = (value) => Number.isFinite(value) ? value.toFixed(2) : 'Unavailable';
const palette = { active: '#365b50', inactive: '#73837b', unknown: '#a6ada9', subject: '#b7433f', line: '#414b45' };
const statusGroup = (home) => ['active', 'inactive'].includes(String(home.status).trim().toLowerCase()) ? String(home.status).trim().toLowerCase() : 'unknown';
const formatX = (factor, x) => factor.key === 'active' ? (x === 1 ? 'Active' : 'Inactive') : factor.key === 'yearBuilt' ? Math.round(x).toString() : decimal.format(x);

function FactorTooltip({ active, payload, factor, priceLabel }) {
  const point = active && payload?.[0]?.payload;
  if (!point) return null;
  return <div className="chart-tooltip regression-tooltip">
    <strong>{point.fullAddress || point.address}</strong>
    <span>{point.isSubject ? priceLabel : 'Listed price'}: {showMoney(point.y)}</span>
    <span>{factor.label}: {formatX(factor, point.x)}</span>
    <span>{point.status || 'Unknown status'}{point.propertyType ? ` · ${point.propertyType}` : ''}</span>
  </div>;
}

function FactorChart({ factor, plot, yDomain, priceLabel, showLine }) {
  const chartId = `factor-${factor.key}`;
  return <figure className="factor-figure" aria-labelledby={chartId}>
    <figcaption><h3 id={chartId}>Price vs. {factor.label.toLowerCase()}</h3>
      <p>{plot.points.length} nearby homes{plot.missingCount > 0 ? ` · ${plot.missingCount} missing this factor` : ''}</p>
    </figcaption>
    {plot.points.length || plot.subjectPoint ? <div className="factor-chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <ScatterChart margin={{ top: 14, right: 22, bottom: 25, left: 4 }} accessibilityLayer>
          <CartesianGrid stroke="#e4e9e5" strokeDasharray="3 4" />
          <XAxis type="number" dataKey="x" name={factor.label} domain={factor.key === 'active' ? [-0.4, 1.4] : ['auto', 'auto']}
            ticks={factor.key === 'active' ? [0, 1] : undefined} allowDecimals={!['beds', 'yearBuilt', 'active'].includes(factor.key)}
            tickFormatter={(x) => formatX(factor, x)} tick={{ fontSize: 12, fill: '#66706a' }} tickLine={false}
            label={{ value: factor.axis, position: 'insideBottom', offset: -16, fontSize: 12, fill: '#46524b' }} />
          <YAxis type="number" dataKey="y" name="Price (USD)" domain={yDomain} width={76} tickFormatter={compact.format} tick={{ fontSize: 12, fill: '#66706a' }} tickLine={false} />
          <ZAxis range={[65, 65]} />
          <Tooltip content={<FactorTooltip factor={factor} priceLabel={priceLabel} />} cursor={{ strokeDasharray: '3 3' }} />
          {showLine && plot.line.length === 2 && <ReferenceLine segment={plot.line} stroke={palette.line} strokeDasharray="5 5" ifOverflow="hidden" />}
          <Scatter name="Active listings" data={plot.points.filter((home) => statusGroup(home) === 'active')} fill={palette.active} fillOpacity={0.65} isAnimationActive={false} />
          <Scatter name="Inactive listings" data={plot.points.filter((home) => statusGroup(home) === 'inactive')} fill="white" stroke={palette.inactive} strokeWidth={1.8} isAnimationActive={false} />
          <Scatter name="Unknown status" data={plot.points.filter((home) => statusGroup(home) === 'unknown')} fill={palette.unknown} shape="triangle" isAnimationActive={false} />
          {plot.subjectPoint && <Scatter name="Subject home" data={[plot.subjectPoint]} fill={palette.subject} stroke="white" strokeWidth={1.5} shape="diamond" isAnimationActive={false} />}
        </ScatterChart>
      </ResponsiveContainer>
    </div> : <div className="factor-empty">No reported {factor.label.toLowerCase()} values in this comparison.</div>}
    <p className="factor-note">{plot.subjectPoint ? `◆ Subject: ${formatX(factor, plot.subjectX)} · ${showMoney(plot.subjectPoint.y)}` : plot.subjectX == null ? `Subject ${factor.label.toLowerCase()} is not reported; no subject marker.` : 'Enter a positive subject price to show its marker.'}</p>
  </figure>;
}

export default function NeighborhoodRegression({ subject, comparables }) {
  const neighborhood = useMemo(() => neighborhoodHomes(comparables, subject), [comparables, subject]);
  const [status, setStatus] = useState('All');
  const [sameType, setSameType] = useState(false);
  const [radius, setRadius] = useState('all');
  const [selected, setSelected] = useState(() => factorAvailability(neighborhood.rows).filter((factor) => factor.defaultSelected).map(({ key }) => key));
  const [priceOverride, setPriceOverride] = useState('');
  const [showLine, setShowLine] = useState(true);
  const hasListingPrice = Number.isFinite(subject.listingPrice) && subject.listingPrice > 0;
  const baselinePrice = hasListingPrice ? subject.listingPrice : subject.estimate;
  const subjectPrice = priceOverride.trim() ? Number(priceOverride) : baselinePrice;
  const priceLabel = priceOverride.trim() ? 'Entered subject price' : hasListingPrice ? 'Subject asking price' : 'Subject AVM / benchmark estimate';
  const profile = { ...subject.regressionFacts, address: subject.address, propertyType: subject.propertyType };
  const rows = useMemo(() => neighborhood.rows.filter((home) =>
    (status === 'All' || statusGroup(home) === status.toLowerCase()) &&
    (!sameType || home.propertyType === subject.propertyType) &&
    (radius === 'all' || (Number.isFinite(home.distance) && home.distance <= Number(radius)))
  ), [neighborhood.rows, status, sameType, subject.propertyType, radius]);
  const availability = useMemo(() => factorAvailability(rows), [rows]);
  const model = useMemo(() => fitNeighborhoodModel(rows, selected), [rows, selected]);
  const prediction = predictHome(model, profile);
  const plottedFactors = FACTORS.filter(({ key }) => key !== 'distance' || selected.includes(key));
  const plots = plottedFactors.map((factor) => factorPlot(rows, profile, subjectPrice, factor, model));
  const prices = [...rows.map((home) => home.price), ...(Number.isFinite(subjectPrice) && subjectPrice > 0 ? [subjectPrice] : []), ...(showLine ? plots.flatMap((plot) => plot.line.map((point) => point.y)) : [])];
  const lo = prices.length ? Math.min(...prices) : 0;
  const hi = prices.length ? Math.max(...prices) : 1;
  const padding = Math.max((hi - lo) * 0.1, hi * 0.03, 1);
  const yDomain = [Math.max(0, lo - padding), hi + padding];
  const trainingSet = new Set(model.rows);
  const otherTypes = rows.filter((home) => home.propertyType !== subject.propertyType).length;
  const omitted = model.omitted.map(({ label, reason }) => `${label}: ${reason.toLowerCase()}`);

  return <section className="analysis-section regression-section" id="regression" aria-label="Neighborhood price regression">
    <div className="section-heading"><div><span className="eyebrow">Neighborhood price model</span><h2>Price and property characteristics</h2>
      <p>Fit a multiple linear regression to nearby listings. Each figure compares the subject home with the same filtered neighborhood set.</p>
    </div></div>
    <div className="regression-filters">
      <label>Listings<select value={status} onChange={(event) => setStatus(event.target.value)}><option>All</option><option>Active</option><option>Inactive</option></select></label>
      <label>Distance<select value={radius} onChange={(event) => setRadius(event.target.value)}><option value="all">All returned homes</option><option value="0.5">Within 0.5 mile</option><option value="1">Within 1 mile</option><option value="2">Within 2 miles</option><option value="5">Within 5 miles</option></select></label>
      <label className="regression-check"><input type="checkbox" checked={sameType} onChange={(event) => setSameType(event.target.checked)} />Same property type as subject</label>
    </div>
    <fieldset className="regression-factors"><legend>Factors in the regression</legend>
      {availability.map((factor) => <label key={factor.key} className={factor.reason ? 'factor-unavailable' : ''}>
        <input type="checkbox" checked={selected.includes(factor.key)} disabled={Boolean(factor.reason) && !selected.includes(factor.key)} onChange={(event) => setSelected(event.target.checked ? [...selected, factor.key] : selected.filter((key) => key !== factor.key))} />
        <span>{factor.label}<small>{factor.reason || `${factor.count}/${rows.length} reported`}</small></span>
      </label>)}
    </fieldset>
    <p className="regression-context">{rows.length} of {neighborhood.rows.length} returned nearby homes · RentCast listed prices in USD. Inactive means no longer listed, not a confirmed sale. This selected comparable set is not a census of the neighborhood.</p>
    {otherTypes > 0 && <p className="regression-note">{otherTypes} homes have a different or unknown property type from the subject ({subject.propertyType}). Use the property-type filter for a closer comparison.</p>}
    <div className="regression-stats" aria-label="Regression results" aria-live="polite">
      <div><span>{model.ok ? 'Homes used in model' : 'Complete homes for model'}</span><strong>{model.n} / {rows.length}</strong><small>{model.missingCount} missing selected factors</small></div>
      <div><span>Subject model prediction</span><strong>{showMoney(prediction.value)}</strong><small>Fitted from nearby listed prices</small></div>
      <div><span>Adjusted R²</span><strong>{model.ok ? showR2(model.adjustedRSquared) : 'Unavailable'}</strong><small>Fit adjusted for number of factors</small></div>
      <div><span>Leave-one-out RMSE</span><strong>{model.ok ? showMoney(model.looRmse) : 'Unavailable'}</strong><small>Prediction error when holding out each home</small></div>
    </div>
    {!model.ok && <p className="regression-note" role="status">{model.reason}</p>}
    {omitted.length > 0 && <p className="regression-note">Omitted from this fit: {omitted.join('; ')}.</p>}
    {prediction.missing.length > 0 && <p className="regression-note">Subject prediction unavailable: missing {prediction.missing.join(', ').toLowerCase()}. Display defaults are not used as observed facts.</p>}
    {prediction.outside.length > 0 && <p className="regression-note">Subject outside the fitted neighborhood range for {prediction.outside.join(', ').toLowerCase()}. Any prediction extrapolates beyond these homes.</p>}
    {model.ok && model.n < 30 && <p className="regression-context">Small sample ({model.n} homes, {model.factors.length} factors). Coefficients can be sensitive to individual listings.</p>}
    <div className="regression-plot-controls">
      <label>Subject price for figures (USD)<input type="number" min="1" step="1000" placeholder={Number.isFinite(baselinePrice) && baselinePrice > 0 ? String(baselinePrice) : 'Enter price'} value={priceOverride} onChange={(event) => setPriceOverride(event.target.value)} /></label>
      <p>{priceLabel}: <strong>{Number.isFinite(subjectPrice) && subjectPrice > 0 ? showMoney(subjectPrice) : 'Unavailable'}</strong>. Markers use reported property facts; the scenario controls above apply to the separate heuristic estimate.</p>
      <label className="regression-check"><input type="checkbox" checked={showLine} onChange={(event) => setShowLine(event.target.checked)} />Show adjusted model lines</label>
    </div>
    <div className="regression-legend" aria-label="Figure legend"><span><i className="legend-active" />Active</span><span><i className="legend-inactive" />Inactive</span><span><i className="legend-unknown" />Unknown status</span><span><i className="legend-subject" />Subject home</span>{showLine && <span><i className="legend-line" />Adjusted model</span>}</div>
    <p className="regression-context">Every figure uses the same price axis. Points show observed listing prices; dashed lines hold other fitted factors at their neighborhood averages. Overlapping points may represent multiple homes.</p>
    <div className="factor-scroll" role="region" aria-label="Property factor figures, scroll horizontally" tabIndex={0}>{plottedFactors.map((factor, i) => <FactorChart key={factor.key} factor={factor} plot={plots[i]} yDomain={yDomain} priceLabel={priceLabel} showLine={showLine} />)}</div>
    {model.ok && <details className="regression-details"><summary>Model coefficients and fit details</summary>
      <p>Ordinary least squares with an intercept, using complete observations and excluding the subject. Effects below hold other factors fixed; they describe associations, not causal effects.</p>
      <div className="table-wrap"><table><thead><tr><th>Factor</th><th>Change in fitted price</th><th>Unit</th></tr></thead><tbody>{model.coefficients.map((factor) => <tr key={factor.key}><td>{factor.label}</td><td>{showMoney(factor.value * factor.increment)}</td><td>{factor.unit}</td></tr>)}</tbody></table></div>
      <p>Intercept: {showMoney(model.intercept)} · R²: {showR2(model.rSquared)} · In-sample RMSE: {showMoney(model.rmse)} · Residual degrees of freedom: {model.degreesOfFreedom}. Leave-one-out error holds the selected factor set fixed.</p>
    </details>}
    <details className="regression-details"><summary>View homes behind the figures</summary>
      <p>The plots use each home with a known value for that figure. The regression uses homes with every included factor reported. {neighborhood.excluded.subject} subject records and {neighborhood.excluded.duplicates} repeated property records excluded; {neighborhood.excluded.price} records without a valid price excluded.</p>
      <div className="table-wrap"><table><thead><tr><th>Property</th><th>Listed price</th><th>Status</th><th>Sqft</th><th>Beds</th><th>Baths</th><th>Acres</th><th>Year built</th><th>Model</th></tr></thead><tbody>{rows.map((home, i) => <tr key={home.id || `${home.fullAddress}-${i}`}><td>{home.fullAddress || home.address}</td><td>{showMoney(home.price)}</td><td>{home.status}</td>{['sqft', 'beds', 'baths', 'acres', 'yearBuilt'].map((key) => <td key={key}>{home[key] == null ? 'Unknown' : key === 'yearBuilt' ? home[key] : decimal.format(home[key])}</td>)}<td>{model.ok ? trainingSet.has(home) ? 'Included' : 'Missing factors' : 'Not fitted'}</td></tr>)}</tbody></table></div>
    </details>
  </section>;
}
