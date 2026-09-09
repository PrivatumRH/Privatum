import { createFileRoute, redirect } from "@tanstack/react-router";

// The PRIVATUM website is served as static files from /public.
// Send / to the static landing page.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ href: "/index.html" });
  },
  component: () => null,
});
