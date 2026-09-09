/**
 * Canonical site origin, used to build absolute URLs for social metadata.
 *
 * Open Graph and Twitter card crawlers (X, Slack, Discord, iMessage, LinkedIn)
 * ignore relative image paths — og:image and og:url must be fully qualified or
 * the card renders without an image. Set VITE_SITE_URL per environment so
 * preview deploys advertise their own origin rather than production's.
 *
 * When unset we fall back to relative paths: the site still works, the share
 * card just won't carry an image.
 */
// Bracket access: tsconfig sets noPropertyAccessFromIndexSignature, and
// ImportMetaEnv exposes VITE_* through an index signature.
const raw = import.meta.env["VITE_SITE_URL"]?.trim() ?? "";

/** Origin with any trailing slash removed, or "" when not configured. */
export const SITE_URL = raw.replace(/\/+$/, "");

/** Absolute URL for `path` when VITE_SITE_URL is set, else `path` unchanged. */
export function absoluteUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return SITE_URL ? `${SITE_URL}${p}` : p;
}

/** Share card image. Regenerate with scripts/make_og.py if the brand changes. */
export const OG_IMAGE = absoluteUrl("/assets/og-image.jpg");
