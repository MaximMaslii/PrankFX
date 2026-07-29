import { Redirect } from "expo-router";

/**
 * Root route always delegates to the gate in `_layout.tsx` via a Redirect.
 * The gate itself decides between onboarding, auth, or the tabs based on state.
 */
export default function Index() {
  return <Redirect href="/onboarding" />;
}
