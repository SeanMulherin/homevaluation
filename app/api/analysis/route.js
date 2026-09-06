import { proxyAnalysis } from '../../../src/analysis-proxy';

export const dynamic = 'force-dynamic';
export async function POST(request) {
  // A local backend override supports integration checks; production uses the fixed service.
  return proxyAnalysis(request, fetch, import.meta.env.DEV && process.env.HOUSING_BACKEND_URL
    ? process.env.HOUSING_BACKEND_URL : undefined);
}
