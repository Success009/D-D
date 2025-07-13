// This utility provides a single source of truth for checking API key availability.
// In the provided dev environment, process.env.API_KEY is populated.
// In a production environment (like Vercel), this variable must be set.
export const isApiKeyAvailable = !!process.env.API_KEY;
