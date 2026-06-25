/** Production custom domain — hardcoded as the only literal value for prod CORS. */
export const PROD_ORIGIN = 'https://proev-dashboard.dravaautomations.com';

/**
 * True when running on a Vercel production deployment.
 * VERCEL_ENV is injected server-side by Vercel; undefined in local dev.
 */
export const isProduction = process.env.VERCEL_ENV === 'production';

/**
 * For endpoints that don't send credentials (no cookies / auth headers),
 * use '*' in non-production so Vercel preview URLs work without hardcoding them.
 * ponytail: production stays strict; preview/dev gets open for QA convenience.
 */
export const CORS_ORIGIN_OPEN = isProduction ? PROD_ORIGIN : '*';
