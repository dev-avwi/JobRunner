import { spawn } from "child_process";
import path from "path";
import { createHmac } from "crypto";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { logger } from "./logger";
import { logSystemEvent } from "./systemEventService";

/**
 * Production smoke-test scheduler (Task #109).
 *
 * Runs scripts/prod-smoke.mjs — a headless-browser walkthrough of the deployed
 * site's auth/onboarding surfaces (login page, email/password login, Google
 * OAuth handshake, magic-link subcontractor endpoints) — shortly after each
 * deploy boots and then once a day. Failures surface the same way schema
 * drift does: loud log lines in the deployment logs plus a critical
 * system_events row (which feeds the admin alerting pipeline).
 */

const SMOKE_SCRIPT = path.resolve(process.cwd(), "scripts", "prod-smoke.mjs");
const DAILY_MS = 24 * 60 * 60 * 1000;
const BOOT_DELAY_MS = 3 * 60 * 1000; // let the fresh deploy settle first
const RUN_TIMEOUT_MS = 5 * 60 * 1000;

let running = false;

export const SMOKE_ACCOUNT_EMAIL = "prod-smoke@jobrunner.com.au";

/**
 * Deterministic smoke-account password shared with scripts/prod-smoke.mjs.
 * Derived from SESSION_SECRET, never stored in plaintext anywhere.
 */
function deriveSmokePassword(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return "";
  return "Sm0ke!" + createHmac("sha256", secret).update("prod-smoke-account-v1").digest("hex").slice(0, 24);
}

/**
 * Provision (or self-heal) the dedicated least-privilege smoke account so the
 * suite's login walkthrough is always runnable. Same pattern as the demo
 * account seeding: idempotent, resets the password hash each time so it stays
 * in sync with the SESSION_SECRET-derived value.
 */
export async function ensureSmokeAccount(): Promise<boolean> {
  const password = deriveSmokePassword();
  if (!password) {
    console.warn("[prod-smoke] SESSION_SECRET missing — cannot provision smoke account.");
    return false;
  }
  try {
    const hashed = await bcrypt.hash(password, 10);
    let user = await storage.getUserByEmail(SMOKE_ACCOUNT_EMAIL);
    if (!user) {
      user = await storage.createUser({
        email: SMOKE_ACCOUNT_EMAIL,
        password: hashed,
        firstName: "Prod",
        lastName: "Smoke",
      } as any);
      console.log("[prod-smoke] Smoke account created.");
    }
    await storage.updateUser(user.id, {
      password: hashed,
      emailVerified: true,
      isActive: true,
    } as any);
    // Onboarding guard 403s most APIs until business settings say completed.
    const settings = await storage.getBusinessSettings(user.id);
    if (!settings) {
      await storage.createBusinessSettings({
        userId: user.id,
        businessName: "Prod Smoke Monitor",
        onboardingCompleted: true,
      } as any);
    } else if (!settings.onboardingCompleted) {
      await storage.updateBusinessSettings(user.id, { onboardingCompleted: true } as any);
    }
    return true;
  } catch (err: any) {
    console.error(`[prod-smoke] Failed to provision smoke account: ${err.message}`);
    return false;
  }
}

export function runProdSmoke(trigger: "boot" | "scheduled"): Promise<void> {
  if (running) return Promise.resolve();
  running = true;

  return new Promise(async (resolve) => {
    // Self-heal the dedicated smoke account first so the mandatory login
    // walkthrough always has valid credentials.
    await ensureSmokeAccount();

    console.log(`[prod-smoke] Starting ${trigger} smoke run against the deployed site...`);
    const child = spawn(process.execPath, [SMOKE_SCRIPT], {
      env: { ...process.env, PROD_SMOKE_EMAIL: SMOKE_ACCOUNT_EMAIL },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let output = "";
    const capture = (buf: Buffer) => {
      const text = buf.toString();
      output += text;
      // Mirror the script's own [prod-smoke]-prefixed lines into deploy logs.
      for (const line of text.split("\n")) {
        if (line.trim()) console.log(line);
      }
    };
    child.stdout.on("data", capture);
    child.stderr.on("data", capture);

    const timer = setTimeout(() => {
      console.error("[prod-smoke] Run timed out after 5 minutes — killing.");
      child.kill("SIGKILL");
    }, RUN_TIMEOUT_MS);

    child.on("close", async (code) => {
      clearTimeout(timer);
      running = false;
      if (code === 0) {
        console.log(`[prod-smoke] ${trigger} run PASSED.`);
      } else if (code === 2) {
        console.warn(`[prod-smoke] ${trigger} run UNABLE to execute (exit 2) — not treated as an outage.`);
      } else if (code === 3) {
        // Should not happen here (ensureSmokeAccount ran just before), so surface it loudly.
        console.error(`[prod-smoke] ${trigger} run reports smoke account still unprovisioned despite ensureSmokeAccount — check provisioning logs.`);
      } else {
        const failLines = output
          .split("\n")
          .filter((l) => l.includes("FAIL") || l.includes("SMOKE FAILURE"))
          .slice(0, 12)
          .join("\n");
        console.error(`[prod-smoke] ${trigger} run FAILED (exit ${code}). Broken page(s) detected on the live site.`);
        logger.error("system", `Production smoke suite failed (${trigger} run) — broken auth/onboarding page on live site`, {
          error: new Error(failLines || `prod-smoke exited ${code}`),
        });
        await logSystemEvent(
          "system",
          "critical",
          "prod_smoke_failed",
          `Production smoke suite failed (${trigger} run, exit ${code})`,
          { failures: failLines },
        );
      }
      resolve();
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      running = false;
      console.warn(`[prod-smoke] Could not spawn smoke run: ${err.message}`);
      resolve();
    });
  });
}

export function startProdSmokeScheduler(): void {
  if (process.env.NODE_ENV !== "production") {
    console.log("[prod-smoke] Scheduler disabled outside production.");
    return;
  }
  if (process.env.PROD_SMOKE_DISABLED === "true") {
    console.log("[prod-smoke] Scheduler disabled via PROD_SMOKE_DISABLED.");
    return;
  }

  setTimeout(() => {
    runProdSmoke("boot").catch(() => {});
  }, BOOT_DELAY_MS);

  setInterval(() => {
    runProdSmoke("scheduled").catch(() => {});
  }, DAILY_MS);

  console.log("✅ Production smoke scheduler started (post-boot + daily)");
}
