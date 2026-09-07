'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  BarChart3,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CircleDollarSign,
  ExternalLink,
  Home,
  Info,
  LandPlot,
  MapPin,
  RefreshCw,
  Ruler,
  Search,
  SlidersHorizontal,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {
  Brush,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  comparableDealAssessment,
  scenarioEstimate,
  sliceHistory,
  summarizeComparables,
} from './analytics';
import {
  dashboardDataFromApi,
  fetchAddressAnalysis,
  readCachedDashboard,
  writeCachedDashboard,
} from './api';
import defaultAnalysis from './default-analysis.json';
import NeighborhoodRegression from './NeighborhoodRegression';
import DataFreshness from './DataFreshness';

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const compactMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });
const number = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const moneyOrUnavailable = (value, compact = false) => (
  Number.isFinite(value) && value > 0 ? (compact ? compactMoney : money).format(value) : 'Not available'
);
const defaultSearchAddress = '1600 Pennsylvania Avenue NW, Washington, DC 20500';
const initialDashboard = dashboardDataFromApi(defaultAnalysis, defaultSearchAddress);
const addressKey = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function Metric({ label, value, detail, tone = 'default', icon: Icon }) {
  return (
    <div className={`metric metric--${tone}`}>
      <div className="metric__label"><Icon size={15} aria-hidden="true" />{label}</div>
      <div className="metric__value">{value}</div>
      <div className="metric__detail">{detail}</div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.filter((item) => item.value != null).map((item) => (
        <span key={item.dataKey} style={{ color: item.color }}>{item.name}: {money.format(item.value)}</span>
      ))}
    </div>
  );
}

function InputStepper({ label, value, min, max, step, suffix, onChange }) {
  return (
    <label className="field-control">
      <span>{label}</span>
      <div className="field-control__input">
        <input
          type="number"
          value={value ?? ''}
          disabled={value == null}
          placeholder={value == null ? 'Not reported' : undefined}
          min={min}
          max={max}
          step={step}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <small>{suffix}</small>
      </div>
    </label>
  );
}

function App() {
  const requestSequence = useRef(0);
  const initialLoadStarted = useRef(false);
  const [query, setQuery] = useState(defaultSearchAddress);
  const [dashboard, setDashboard] = useState(initialDashboard);
  const [isLoading, setIsLoading] = useState(true);
  const [dataMode, setDataMode] = useState('snapshot');
  const [neighborhoodRadius, setNeighborhoodRadius] = useState(1);
  const [neighborhoodAge, setNeighborhoodAge] = useState(180);
  const [loadError, setLoadError] = useState('');
  const [scenario, setScenario] = useState({
    beds: initialDashboard.subject.beds,
    baths: initialDashboard.subject.baths,
    squareFeet: initialDashboard.subject.squareFeet,
    acres: initialDashboard.subject.acres,
    yearBuilt: initialDashboard.subject.yearBuilt,
  });
  const [historyRange, setHistoryRange] = useState(10);
  const [showSubjectIndex, setShowSubjectIndex] = useState(true);
  const [notice, setNotice] = useState('');

  const currentSubject = dashboard.subject;
  const currentMarket = dashboard.market;
  const estimate = useMemo(() => scenarioEstimate(currentSubject, scenario), [currentSubject, scenario]);
  const hasRange = Number.isFinite(currentSubject.low) && Number.isFinite(currentSubject.high);
  const scenarioOffset = estimate - currentSubject.estimate;
  const estimateLow = hasRange ? currentSubject.low + scenarioOffset : null;
  const estimateHigh = hasRange ? currentSubject.high + scenarioOffset : null;
  const filteredComps = dashboard.comparables;
  const compSummary = useMemo(
    () => summarizeComparables(filteredComps, estimate, scenario.squareFeet),
    [filteredComps, estimate, scenario.squareFeet],
  );
  const eligibleDealComparables = useMemo(
    () => dashboard.comparables.filter((comp) => addressKey(comp.fullAddress) !== addressKey(currentSubject.address)),
    [dashboard.comparables, currentSubject.address],
  );
  const activeDealComparables = useMemo(
    () => eligibleDealComparables.filter((comp) => comp.status === 'Active'),
    [eligibleDealComparables],
  );
  const dealComparables = activeDealComparables.length >= 3 ? activeDealComparables : eligibleDealComparables;
  const dealAssessment = useMemo(
    () => comparableDealAssessment(dealComparables, currentSubject.listingPrice, scenario.squareFeet),
    [dealComparables, currentSubject.listingPrice, scenario.squareFeet],
  );
  const history = useMemo(() => {
    const sliced = sliceHistory(currentMarket.history, historyRange);
    const latestBasis = currentMarket.history.at(-1)?.bedroom || currentMarket.history.at(-1)?.city || currentSubject.marketBenchmark || 1;
    return sliced.map((point) => ({
      ...point,
      subjectIndex: Math.round((point.bedroom || point.city) * (estimate / latestBasis)),
    }));
  }, [currentMarket.history, currentSubject.marketBenchmark, historyRange, estimate]);
  const premium = currentSubject.marketBenchmark ? ((estimate / currentSubject.marketBenchmark) - 1) * 100 : 0;
  const fiveYearHistory = sliceHistory(currentMarket.history, 5);
  const fiveYearChange = fiveYearHistory.length > 1
    ? ((fiveYearHistory.at(-1).city / fiveYearHistory[0].city) - 1) * 100
    : 0;

  const analyzeAddress = async (address, initial = false, options = {}) => {
    const normalized = address.trim();
    if (!normalized) return;
    const requestId = ++requestSequence.current;
    setIsLoading(true);
    setLoadError('');
    try {
      const nextDashboard = await fetchAddressAnalysis(normalized, fetch, { radiusMiles: neighborhoodRadius, maxAgeDays: neighborhoodAge, ...options });
      if (requestId !== requestSequence.current) return;
      setDashboard(nextDashboard);
      setDataMode('api');
      if ((options.radiusMiles ?? neighborhoodRadius) === 1 && (options.maxAgeDays ?? neighborhoodAge) === 180) {
        writeCachedDashboard(normalized, nextDashboard);
      }
      setScenario({
        beds: nextDashboard.subject.beds,
        baths: nextDashboard.subject.baths,
        squareFeet: nextDashboard.subject.squareFeet,
        acres: nextDashboard.subject.acres,
        yearBuilt: nextDashboard.subject.yearBuilt,
      });
      setNotice(initial ? '' : `Analysis updated for ${nextDashboard.subject.address}.`);
      if (!initial) setTimeout(() => setNotice(''), 3600);
    } catch (error) {
      if (requestId === requestSequence.current) {
        setLoadError(error.message || 'Address analysis could not be loaded.');
      }
    } finally {
      if (requestId === requestSequence.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (initialLoadStarted.current) return;
    initialLoadStarted.current = true;
    const cachedDashboard = readCachedDashboard(defaultSearchAddress);
    if (cachedDashboard) {
      setDashboard(cachedDashboard);
      setDataMode('cached');
      setScenario({
        beds: cachedDashboard.subject.beds,
        baths: cachedDashboard.subject.baths,
        squareFeet: cachedDashboard.subject.squareFeet,
        acres: cachedDashboard.subject.acres,
        yearBuilt: cachedDashboard.subject.yearBuilt,
      });
    }
    void analyzeAddress(defaultSearchAddress, true);
  }, []);

  const resetScenario = () => {
    setScenario({ beds: currentSubject.beds, baths: currentSubject.baths, squareFeet: currentSubject.squareFeet, acres: currentSubject.acres, yearBuilt: currentSubject.yearBuilt });
    setQuery(currentSubject.address);
    setNotice('Property characteristics restored.');
  };

  const runAnalysis = (event) => {
    event.preventDefault();
    void analyzeAddress(query);
  };

  const premiumLabel = `${premium >= 0 ? '+' : ''}${premium.toFixed(1)}%`;
  const fiveYearLabel = `${fiveYearChange >= 0 ? '+' : ''}${fiveYearChange.toFixed(1)}%`;
  const dealPercent = dealAssessment.discountPercent;
  const dealLabel = dealPercent == null
    ? ['error', 'unavailable'].includes(currentSubject.listingLookupStatus) ? 'Listing lookup unavailable' : 'No active listing to compare'
    : dealPercent >= 10
      ? 'Strong potential discount'
      : dealPercent >= 3
        ? 'Below comparable homes'
        : dealPercent > -3
          ? 'In line with comparable homes'
          : dealPercent > -10
            ? 'Above comparable homes'
            : 'Substantial comparable premium';
  const dealTone = dealPercent == null ? 'neutral' : dealPercent >= 3 ? 'positive' : dealPercent <= -3 ? 'negative' : 'neutral';
  const listingDetail = currentSubject.listingPrice
    ? [currentSubject.listedDate !== 'Not available' ? `Listed ${currentSubject.listedDate}` : null, currentSubject.daysOnMarket ? `${currentSubject.daysOnMarket} days on market` : null].filter(Boolean).join(' | ') || 'Active RentCast sale listing'
    : ['error', 'unavailable'].includes(currentSubject.listingLookupStatus) ? 'Listing lookup unavailable' : 'No active sale listing found';

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#overview" aria-label="Housing Market Lab home">
          <span className="brand__mark"><Home size={19} strokeWidth={2.2} /></span>
          <span>Housing Market Lab</span>
        </a>
        <a className="portfolio-link" href="https://seanmulherin.github.io/" target="_blank" rel="noreferrer">
          SM Portfolio Home <ExternalLink size={14} />
        </a>
      </header>

      <section className="workspace-header" id="overview">
        <div className="workspace-header__copy">
          <div className="eyebrow"><span className="status-dot" /> Address-level market analysis</div>
          <h1>Home valuation and neighborhood analysis</h1>
        </div>
        <form className="address-search" onSubmit={runAnalysis}>
          <MapPin size={18} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Property address" placeholder="Enter a U.S. property address" />
          <button type="submit" disabled={isLoading}>{isLoading ? <RefreshCw className="is-spinning" size={17} /> : <Search size={17} />}{isLoading ? 'Analyzing' : 'Analyze'}</button>
        </form>
        {notice && <div className="toast" role="status"><Check size={16} />{notice}</div>}
      </section>


      <div className="dashboard-grid">
        <aside className="scenario-panel" aria-label="Property scenario controls">
          <div className="panel-heading">
            <div><span className="eyebrow">Subject profile</span><h2>Adjust the home</h2></div>
            <button className="icon-button" onClick={resetScenario} title="Reset property scenario" aria-label="Reset property scenario"><RefreshCw size={17} /></button>
          </div>
          <div className="property-type"><Building2 size={17} /><span><small>Property type</small>{currentSubject.propertyType}</span><ChevronDown size={15} /></div>
          <div className="control-grid">
            <InputStepper label="Bedrooms" value={scenario.beds} min={1} max={8} step={1} suffix="beds" onChange={(value) => setScenario({ ...scenario, beds: value })} />
            <InputStepper label="Bathrooms" value={scenario.baths} min={1} max={50} step={0.5} suffix="baths" onChange={(value) => setScenario({ ...scenario, baths: value })} />
            <InputStepper label="Living area" value={scenario.squareFeet} min={500} max={100000} step={50} suffix="sqft" onChange={(value) => setScenario({ ...scenario, squareFeet: value })} />
            <InputStepper label="Lot size" value={scenario.acres} min={0.03} max={100} step={0.01} suffix="acres" onChange={(value) => setScenario({ ...scenario, acres: value })} />
            <InputStepper label="Year built" value={scenario.yearBuilt} min={1700} max={2026} step={1} suffix="year" onChange={(value) => setScenario({ ...scenario, yearBuilt: value })} />
          </div>
          <div className="scenario-impact">
            <div><SlidersHorizontal size={16} /><span>Scenario impact</span></div>
            <strong className={estimate >= currentSubject.estimate ? 'positive' : 'negative'}>{estimate >= currentSubject.estimate ? '+' : ''}{money.format(estimate - currentSubject.estimate)}</strong>
            <small>Heuristic adjustment from address baseline</small>
          </div>
          <div className="source-note"><Info size={15} /><p><strong>{currentSubject.valuationSource}</strong> with Zillow market history. {dashboard.warnings[0] || 'Values are estimates, not an appraisal.'}</p></div>
        </aside>

        <div className="analysis-canvas">
          <DataFreshness dashboard={dashboard} mode={dataMode} loading={isLoading} error={loadError}
            radius={neighborhoodRadius} maxAge={neighborhoodAge}
            onScopeChange={(radiusMiles, maxAgeDays) => {
              setNeighborhoodRadius(radiusMiles); setNeighborhoodAge(maxAgeDays);
              void analyzeAddress(currentSubject.address, false, { radiusMiles, maxAgeDays });
            }} />
          <section className="metrics-row" aria-label="Valuation summary">
            <Metric icon={CircleDollarSign} label={currentSubject.valuationSource === 'Zillow market benchmark' ? 'Market fallback (no AVM)' : 'RentCast estimated value'} value={moneyOrUnavailable(estimate)} detail={hasRange ? `${moneyOrUnavailable(estimateLow, true)} - ${moneyOrUnavailable(estimateHigh, true)} range` : 'Valuation range not reported'} tone="primary" />
            <Metric icon={Building2} label="City benchmark" value={moneyOrUnavailable(currentSubject.marketBenchmark)} detail={`Zillow ZHVI | ${currentSubject.marketAsOf}`} />
            <Metric icon={TrendingUp} label="Market premium" value={premiumLabel} detail={`vs. ${currentMarket.location} SFR benchmark`} tone={premium >= 0 ? 'positive' : 'default'} />
            <Metric icon={BarChart3} label="Weighted comp value" value={moneyOrUnavailable(compSummary.weightedValue, true)} detail={`${compSummary.count} comparable properties`} />
            <Metric icon={Activity} label="5-year market change" value={fiveYearLabel} detail={`${currentMarket.location} single-family index`} tone={fiveYearChange >= 0 ? 'positive' : 'default'} />
          </section>

          <NeighborhoodRegression key={`${currentSubject.address}-${dashboard.neighborhood?.radius_miles}-${dashboard.neighborhood?.max_age_days}-${dashboard.neighborhood?.status}-${dashboard.freshness?.retrievedAt}`} subject={currentSubject}
            comparables={dashboard.neighborhood?.status === 'ok' ? dashboard.neighborhood.listings : []}
            source={dashboard.neighborhood} />

          <section className="analysis-section" id="market">
            <div className="section-heading">
              <div><span className="eyebrow">Market trajectory</span><h2>Value history and home-type context</h2><p>Compare the city index, available bedroom segment, and an indexed version of this property.</p></div>
              <div className="chart-actions">
                <div className="segmented" aria-label="History range">
                  {[1, 5, 10, 'all'].map((range) => <button key={range} className={historyRange === range ? 'is-active' : ''} onClick={() => setHistoryRange(range)}>{range === 'all' ? 'All' : `${range}Y`}</button>)}
                </div>
                <label className="toggle"><input type="checkbox" checked={showSubjectIndex} onChange={(event) => setShowSubjectIndex(event.target.checked)} /><span />Subject index</label>
              </div>
            </div>
            <div className="chart-frame chart-frame--history">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={history} margin={{ top: 16, right: 24, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="#dfe4df" strokeDasharray="3 4" vertical={false} />
                  <XAxis dataKey="date" minTickGap={40} tick={{ fill: '#66706a', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis width={72} tickFormatter={(value) => compactMoney.format(value)} tick={{ fill: '#66706a', fontSize: 12 }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend verticalAlign="top" align="left" iconType="line" wrapperStyle={{ paddingBottom: 18, fontSize: 12 }} />
                  <Line type="monotone" dataKey="city" name="City SFR ZHVI" stroke="#365b50" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />
                  {currentMarket.hasBedroomSeries && <Line type="monotone" dataKey="bedroom" name={currentMarket.primaryLabel} stroke="#d18b35" strokeWidth={2.2} dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
                  {showSubjectIndex && <Line type="monotone" dataKey="subjectIndex" name="Subject indexed value" stroke="#b7433f" strokeWidth={2.5} strokeDasharray="7 5" dot={false} activeDot={{ r: 4 }} isAnimationActive={false} />}
                  <Brush dataKey="date" height={25} stroke="#9aa79f" fill="#f6f8f5" travellerWidth={8} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="insight-strip">
              <div><Sparkles size={16} /><span><strong>Indexed value</strong> preserves the subject home's current premium while applying historical bedroom-segment movement.</span></div>
              <div><CalendarDays size={16} /><span>AVM requested: <strong>{currentSubject.valuationAsOf}</strong></span></div>
            </div>
          </section>

          <section className="property-facts">
            <div className="section-heading"><div><span className="eyebrow">Subject property</span><h2>Property facts</h2></div></div>
            <div className="facts-grid">
              <div><BedDouble size={18} /><span>Beds / baths<strong>{scenario.beds ?? 'Unknown'} / {(scenario.baths == null ? 'Unknown' : scenario.baths.toFixed(1))}</strong></span></div>
              <div><Ruler size={18} /><span>Living area<strong>{scenario.squareFeet == null ? 'Unknown' : `${number.format(scenario.squareFeet)} sqft`}</strong></span></div>
              <div><LandPlot size={18} /><span>Lot size<strong>{(scenario.acres == null ? 'Unknown' : scenario.acres.toFixed(2))} acres</strong></span></div>
              <div><CalendarDays size={18} /><span>Year built<strong>{scenario.yearBuilt ?? 'Unknown'}</strong></span></div>
              <div><CircleDollarSign size={18} /><span>Last sale<strong>{moneyOrUnavailable(currentSubject.lastSalePrice)}</strong></span></div>
              <div><Bath size={18} /><span>Last sale date<strong>{currentSubject.lastSaleDate}</strong></span></div>
            </div>
          </section>

          <section className="deal-assessment" aria-label="Comparable deal assessment">
            <div className="section-heading deal-assessment__heading">
              <div><span className="eyebrow">Listing price comparison</span><h2>Comparable deal assessment</h2><p>See whether the asking price is below or above nearby comparable listings.</p></div>
              <span className={`confidence-pill confidence-pill--${dealAssessment.confidence.toLowerCase()}`}>{dealAssessment.confidence} confidence</span>
            </div>
            <div className="deal-grid">
              <div className="deal-stat deal-stat--asking"><span>Current asking price</span><strong>{moneyOrUnavailable(currentSubject.listingPrice)}</strong><small>{listingDetail}</small></div>
              <div className="deal-stat"><span>Comp-supported value</span><strong>{moneyOrUnavailable(dealAssessment.expectedValue)}</strong><small>{dealAssessment.adjustedForSize ? 'Adjusted to subject living area' : 'Weighted by fit and distance'}</small></div>
              <div className={`deal-stat deal-stat--${dealTone}`}><span>Comparable discount</span><strong>{dealPercent == null ? 'Not available' : `${dealPercent >= 0 ? '+' : ''}${dealPercent.toFixed(1)}%`}</strong><small>{dealLabel}</small></div>
              <div className={`deal-stat deal-stat--${dealTone}`}><span>Dollar difference</span><strong>{dealAssessment.dollarGap == null ? 'Not available' : `${dealAssessment.dollarGap >= 0 ? '+' : '-'}${money.format(Math.abs(dealAssessment.dollarGap))}`}</strong><small>{dealAssessment.dollarGap == null ? 'Available when the property is actively listed' : dealAssessment.dollarGap >= 0 ? 'Below comp-supported value' : 'Above comp-supported value'}</small></div>
            </div>
            <div className="deal-method"><Info size={15} /><span>Based on {dealAssessment.count} {activeDealComparables.length >= 3 ? 'active nearby listings' : 'nearby comparable properties'}. Active prices are seller expectations, not completed sale prices.</span></div>
          </section>
        </div>
      </div>

      <footer className="footer"><span>Housing Market Lab</span><p>Estimates are informational and should not replace an appraisal or professional advice.</p><span>RentCast + Zillow data model</span></footer>
    </main>
  );
}

export default App;
