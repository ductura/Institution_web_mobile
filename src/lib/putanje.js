// Base path of the app (BASE_PATH at build time, NEXT_PUBLIC_BASE_PATH in the
// browser bundle). Next adds it to <Link>, router and redirect(); fetch() does
// not, so calls from the browser to this app's BFF go through api().
const zadano = (v) => {
  const p = String(v ?? "").trim().replace(/\/+$/, "");
  return /^(\/[\w-]+)*$/.test(p) ? p : "";
};

export const BASE_PATH = zadano(process.env.BASE_PATH ?? process.env.NEXT_PUBLIC_BASE_PATH);
export const api = (putanja) => `${BASE_PATH}/api${putanja}`;

/** AAI@EduHr login on Institution_server (same origin, outside this app's base path). */
export const prijava = (povratak) => `/api/v1/auth/login?returnTo=${encodeURIComponent(povratak)}`;
