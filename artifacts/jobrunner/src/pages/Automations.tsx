import { useEffect } from "react";

// Automations have moved to Autopilot — redirect anyone who lands on this URL.
export default function Automations() {
  useEffect(() => {
    window.location.replace("/autopilot");
  }, []);
  return null;
}
