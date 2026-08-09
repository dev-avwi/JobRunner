import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

export default function Demo() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/demo-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
        });
        const data = await res.json();
        if (cancelled) return;
        if (data?.success) {
          if (data.sessionToken) {
            localStorage.setItem("sessionToken", data.sessionToken);
          }
          window.location.replace("/");
        } else {
          setError("Demo login failed. Please try again.");
        }
      } catch {
        if (!cancelled) setError("Network error. Please try again.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="text-center space-y-4 max-w-md">
        <div className="flex items-center justify-center w-14 h-14 mx-auto rounded-full bg-primary/10">
          <Sparkles className="w-7 h-7 text-primary animate-spin" />
        </div>
        <h1 className="text-2xl font-bold">Loading the JobRunner demo…</h1>
        <p className="text-muted-foreground">
          Setting up a sample workspace so you can explore without signing up.
        </p>
        {error && (
          <p className="text-destructive text-sm pt-2" data-testid="demo-error">
            {error}{" "}
            <a href="/" className="underline">
              Back to home
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
