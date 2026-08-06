import { createHash } from "crypto";

export const ACCESS_COOKIE = "mg_access";

/**
 * Site-wide access gate. When ACCESS_CODE is set, every page requires the code
 * once per browser. Used to keep the public deployment private while INR
 * payouts are still simulated. Unset the env var to open the site to everyone.
 */
export function accessEnabled() {
  return !!process.env.ACCESS_CODE;
}

/** Cookie value is derived, so the raw code is never stored in the browser. */
export function accessToken() {
  return createHash("sha256")
    .update(`${process.env.ACCESS_CODE}:${process.env.SESSION_SECRET ?? ""}`)
    .digest("hex");
}
