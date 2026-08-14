/**
 * Lazy-loaded sections and modals for JobDetailView.
 *
 * These components are split into their own chunks so opening a job doesn't
 * download rarely-used dialogs and below-the-fold sections up front. Each
 * wrapper includes its own Suspense boundary so call sites don't change.
 */
import { lazy, Suspense, type ComponentType, type ComponentProps } from "react";

function lazyWithSuspense<T extends ComponentType<any>>(
  loader: () => Promise<{ default: T }>,
  fallback: React.ReactNode = null,
) {
  const Lazy = lazy(loader);
  return function LazySection(props: ComponentProps<T>) {
    return (
      <Suspense fallback={fallback}>
        <Lazy {...props} />
      </Suspense>
    );
  };
}

const sectionFallback = (
  <div className="rounded-lg border bg-card animate-pulse h-24" aria-hidden="true" />
);

// Sections (rendered inline; skeleton placeholder while loading)
export const JobPhotoGallery = lazyWithSuspense(
  () => import("./JobPhotoGallery"),
  sectionFallback,
);
export const JobVoiceNotes = lazyWithSuspense(
  () => import("./JobVoiceNotes").then((m) => ({ default: m.JobVoiceNotes })),
  sectionFallback,
);
export const JobDocuments = lazyWithSuspense(
  () => import("./JobDocuments").then((m) => ({ default: m.JobDocuments })),
  sectionFallback,
);
export const JobVariations = lazyWithSuspense(
  () => import("./JobVariations").then((m) => ({ default: m.JobVariations })),
  sectionFallback,
);
export const JobSignature = lazyWithSuspense(
  () => import("./JobSignature").then((m) => ({ default: m.JobSignature })),
  sectionFallback,
);
export const AIPhotoAnalysis = lazyWithSuspense(
  () => import("./AIPhotoAnalysis").then((m) => ({ default: m.AIPhotoAnalysis })),
  sectionFallback,
);
export const SafetyFormsSection = lazyWithSuspense(
  () => import("./SafetyFormsSection").then((m) => ({ default: m.SafetyFormsSection })),
  sectionFallback,
);
export const LinkedJobsCard = lazyWithSuspense(
  () => import("./LinkedJobsCard"),
  sectionFallback,
);
export const JobProfitabilityCard = lazyWithSuspense(
  () => import("./JobProfitabilityCard"),
  sectionFallback,
);
export const GeofenceSettingsCard = lazyWithSuspense(
  () => import("./GeofenceSettingsCard"),
  sectionFallback,
);
export const LinkedDocumentsCard = lazyWithSuspense(
  () => import("./JobWorkflowComponents").then((m) => ({ default: m.LinkedDocumentsCard })),
  sectionFallback,
);
export const JobForms = lazyWithSuspense(
  () => import("./CustomFormRenderer").then((m) => ({ default: m.JobForms })),
  sectionFallback,
);
export const JobCardSection = lazyWithSuspense(
  () => import("./CustomFormRenderer").then((m) => ({ default: m.JobCardSection })),
  sectionFallback,
);
export const JobTasksSection = lazyWithSuspense(
  () => import("./CustomFormRenderer").then((m) => ({ default: m.JobTasksSection })),
  sectionFallback,
);
export const JobFlowWizard = lazyWithSuspense(
  () => import("@/components/JobFlowWizard"),
  sectionFallback,
);

// Modals / dialogs (hidden until opened; no visible fallback needed)
export const SafetyCheckDialog = lazyWithSuspense(
  () => import("./SafetyFormsSection").then((m) => ({ default: m.SafetyCheckDialog })),
);
export const EmailTemplateEditor = lazyWithSuspense(
  () => import("./EmailTemplateEditor"),
);
export const QuickCollectPayment = lazyWithSuspense(
  () => import("./QuickCollectPayment"),
);
export const BeforePhotoPrompt = lazyWithSuspense(
  () => import("./BeforePhotoPrompt").then((m) => ({ default: m.BeforePhotoPrompt })),
);
export const UnifiedSendModal = lazyWithSuspense(
  () => import("./UnifiedSendModal").then((m) => ({ default: m.UnifiedSendModal })),
);
export const ManualSmsComposer = lazyWithSuspense(
  () => import("./ManualSmsComposer").then((m) => ({ default: m.ManualSmsComposer })),
);
export const JobPhasesSection = lazyWithSuspense(
  () => import("./JobPhasesSection").then((m) => ({ default: m.JobPhasesSection })),
  sectionFallback,
);
export const ClaimsSection = lazyWithSuspense(
  () => import("./ClaimsSection").then((m) => ({ default: m.ClaimsSection })),
  sectionFallback,
);
export const ProjectGanttView = lazyWithSuspense(
  () => import("./ProjectGanttView").then((m) => ({ default: m.ProjectGanttView })),
  sectionFallback,
);
