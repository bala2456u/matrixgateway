/** Public origin of this deployment, used to build hosted links. */
export function baseUrl() {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const railway = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (railway) return `https://${railway}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}
