import { storage } from "./storage";
import type { CustomForm, FormSubmission } from "@workspace/db";

export interface TaskRule {
  fieldId?: string;
  operator?: string; // equals, not_equals, contains, is_empty, is_not_empty, is_checked, greater_than, less_than, any
  value?: any;
  taskTitle?: string;
  assignTo?: string | null;
}

function toStr(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function toNum(v: any): number {
  const n = parseFloat(toStr(v));
  return Number.isFinite(n) ? n : NaN;
}

export function ruleMatches(rule: TaskRule, answer: any): boolean {
  const op = (rule.operator || "equals").toLowerCase();
  const ans = answer;
  const target = rule.value;
  switch (op) {
    case "any":
      return true;
    case "is_empty":
      return toStr(ans).trim() === "";
    case "is_not_empty":
      return toStr(ans).trim() !== "";
    case "is_checked":
      return ans === true || toStr(ans).toLowerCase() === "true" || toStr(ans).toLowerCase() === "yes";
    case "not_checked":
      return !(ans === true || toStr(ans).toLowerCase() === "true" || toStr(ans).toLowerCase() === "yes");
    case "not_equals":
      return toStr(ans).trim().toLowerCase() !== toStr(target).trim().toLowerCase();
    case "contains":
      return toStr(ans).toLowerCase().includes(toStr(target).toLowerCase());
    case "greater_than": {
      const a = toNum(ans), t = toNum(target);
      return Number.isFinite(a) && Number.isFinite(t) && a > t;
    }
    case "less_than": {
      const a = toNum(ans), t = toNum(target);
      return Number.isFinite(a) && Number.isFinite(t) && a < t;
    }
    case "equals":
    default:
      return toStr(ans).trim().toLowerCase() === toStr(target).trim().toLowerCase();
  }
}

/**
 * Evaluate a form's taskRules against a submission's answers and spawn follow-up tasks.
 * Owner-controlled: rules live on the form (customForms.taskRules). Never throws —
 * failures are logged so a rule problem can't block a submission.
 */
export async function evaluateTaskRules(params: {
  form: CustomForm;
  submission: FormSubmission;
  answers: Record<string, any>;
  ownerUserId: string;
  jobId?: string | null;
  assignedBy?: string;
}): Promise<number> {
  try {
    const rawRules = (params.form as any)?.taskRules;
    if (!Array.isArray(rawRules) || rawRules.length === 0) return 0;

    const answers = params.answers || {};
    const fieldMeta: any[] = Array.isArray((params.form as any)?.fields) ? (params.form as any).fields : [];
    const fieldLabel = (id?: string) => {
      if (!id) return "";
      const f = fieldMeta.find((x: any) => x?.id === id || x?.fieldId === id || x?.name === id);
      return f?.label || f?.name || id;
    };

    let created = 0;
    for (const rule of rawRules as TaskRule[]) {
      if (!rule || typeof rule !== "object") continue;
      const answer = rule.fieldId ? answers[rule.fieldId] : undefined;
      if (!ruleMatches(rule, answer)) continue;

      const title =
        (rule.taskTitle && String(rule.taskTitle).trim()) ||
        `Follow-up: ${fieldLabel(rule.fieldId)}`;

      const descParts = [`Auto-created from form "${params.form.name}"`];
      if (rule.fieldId) {
        descParts.push(`${fieldLabel(rule.fieldId)}: ${toStr(answer) || "(no answer)"}`);
      }

      await storage.createTask({
        userId: params.ownerUserId,
        jobId: params.jobId || null,
        title: title.slice(0, 500),
        description: descParts.join("\n"),
        status: "open",
        assignedTo: rule.assignTo || null,
        source: "form_rule",
        sourceFormId: params.form.id,
        sourceSubmissionId: params.submission.id,
      } as any);
      created++;
    }
    return created;
  } catch (err) {
    console.error("[taskRules] evaluation failed:", err);
    return 0;
  }
}
