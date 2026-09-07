const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const percent = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const positive = value => Number.isFinite(value) && value > 0;
const amount = value => Number.isFinite(value) ? money.format(value) : 'Unavailable';

export function regressionPriceComparison(modelValue, price) {
  if (!positive(modelValue) || !positive(price)) return null;
  const difference = price - modelValue;
  return { difference, percent: difference / modelValue * 100,
    direction: difference < 0 ? 'below' : difference > 0 ? 'above' : 'equal' };
}

export default function RegressionPricing({ model, prediction, askingPrice, priceOverride, onPriceChange, idle = false }) {
  const modelValue = model.ok && positive(prediction.value) ? prediction.value : null;
  const entered = priceOverride.trim() !== '';
  const comparisonPrice = entered ? Number(priceOverride) : askingPrice;
  const label = entered ? 'Entered price' : 'Asking price';
  const comparison = regressionPriceComparison(modelValue, comparisonPrice);
  const error = model.ok && Number.isFinite(model.looRmse) ? model.looRmse : null;
  const smallGap = comparison && error != null && Math.abs(comparison.difference) < error;
  const extrapolating = prediction.outside.length > 0;
  const reason = idle ? 'Enter an address and click Analyze to estimate the home’s value.'
    : !model.ok ? model.reason
    : prediction.missing.length ? `The subject is missing ${prediction.missing.join(', ').toLowerCase()}. A model value cannot be calculated.`
    : !modelValue ? 'The fitted model does not produce a positive value for this home. Revise the factors or neighborhood sample.' : null;
  return <section className="regression-pricing" aria-label="Regression pricing assessment">
    <h3>What does the model say your home is worth?</h3>
    <p>The fitted regression estimates the listing price of a home with your property’s reported characteristics.</p>
    <div className="regression-pricing-grid" aria-live="polite">
      <div><span>Model-estimated value</span><strong>{amount(modelValue)}</strong><small>From the selected regression factors</small></div>
      <div><span>{label}</span><strong>{positive(comparisonPrice) ? amount(comparisonPrice) : 'Not provided'}</strong><small>{entered ? 'Your comparison price' : 'Reported active listing price'}</small></div>
      <div><span>Dollar difference</span><strong>{comparison ? amount(Math.abs(comparison.difference)) : 'Unavailable'}</strong><small>{comparison ? comparison.direction === 'equal' ? 'Equal to the model estimate' : `${label} ${comparison.direction} the model estimate` : 'Requires a model value and comparison price'}</small></div>
      <div><span>Percentage difference</span><strong>{comparison ? `${percent.format(Math.abs(comparison.percent))}%` : 'Unavailable'}</strong><small>Difference as a share of the model estimate</small></div>
    </div>
    <label className="regression-comparison-input">Asking or purchase price to compare (USD)
      <input type="number" min="1" step="any" value={priceOverride} placeholder={positive(askingPrice) ? String(askingPrice) : 'Enter a price'} onChange={event => onPriceChange(event.target.value)} disabled={idle} />
    </label>
    {reason && <p className="regression-pricing-status" role="status">{reason}</p>}
    {modelValue && !comparison && <p className="regression-pricing-status">Enter a positive asking or purchase price to assess it against the fitted value.</p>}
    {comparison && <div className="regression-pricing-verdict" aria-live="polite">
      <strong>{comparison.direction === 'equal' ? 'Priced at the model estimate' : comparison.direction === 'below' ? 'Potentially undervalued relative to the model' : 'Potentially overvalued relative to the model'}</strong>
      <p>{label} {comparison.direction === 'equal' ? 'equals' : `is ${percent.format(Math.abs(comparison.percent))}% ${comparison.direction}`} the model estimate{comparison.direction !== 'equal' ? `, a difference of ${amount(Math.abs(comparison.difference))}` : ''}.</p>
      {smallGap && <p>The price gap is smaller than the model’s leave-one-out prediction error. This difference is inconclusive.</p>}
      {extrapolating && <p>This comparison extrapolates beyond the observed range for {prediction.outside.join(', ').toLowerCase()}.</p>}
    </div>}
    {model.ok && <p className="regression-pricing-footnote">Based on {model.n} neighborhood listings. Leave-one-out prediction error: {amount(error)}. This error summarizes held-out predictions; it is not a confidence interval.</p>}
    <p className="regression-pricing-footnote">Above or below refers to this fitted model, not an independently established market value. The model uses listing prices, including last asking prices for inactive listings.</p>
  </section>;
}
