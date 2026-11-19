import { BASE_PATH } from "./src/lib/putanje.js";

// BASE_PATH (build time, e.g. "/app/mobile" behind the edge proxy) is empty by
// default, so the pages are served at "/" as before the move to Next.js.
const nextConfig = {
  ...(BASE_PATH ? { basePath: BASE_PATH } : {}),
  env: { NEXT_PUBLIC_BASE_PATH: BASE_PATH },
  poweredByHeader: false,
  reactStrictMode: true,
  agentRules: false,
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
