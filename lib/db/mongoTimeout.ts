/**
 * Cap MongoDB operation duration so Vercel serverless functions can fail fast
 * (see https://www.mongodb.com/docs/manual/reference/operator/meta/maxTimeMS/).
 */
export const MONGO_MAX_TIME_MS = 8000;

export const mongoMaxTime = { maxTimeMS: MONGO_MAX_TIME_MS } as const;
