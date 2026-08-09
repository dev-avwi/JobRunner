import { useState, createContext, useContext } from "react";
import { useFormContext, UseFormReturn, FieldValues } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ChevronLeft, ChevronRight, Check, Users, FileText, ListTodo, Eye } from "lucide-react";

interface WizardStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  validationFields: string[];
}

interface WizardContextType {
  currentStep: number;
  totalSteps: number;
  steps: WizardStep[];
  goNext: () => Promise<void>;
  goBack: () => void;
  isFirstStep: boolean;
  isLastStep: boolean;
  isSubmitting: boolean;
}

const WizardContext = createContext<WizardContextType | null>(null);

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error("useWizard must be used within WizardProvider");
  }
  return context;
}

interface WizardLayoutProps<T extends FieldValues> {
  steps: WizardStep[];
  form: UseFormReturn<T>;
  onSubmit: (data: T) => Promise<void>;
  onCancel?: () => void;
  children: React.ReactNode[];
  submitLabel?: string;
}

export function WizardLayout<T extends FieldValues>({ 
  steps, 
  form,
  onSubmit,
  onCancel,
  children,
  submitLabel = "Create"
}: WizardLayoutProps<T>) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const totalSteps = steps.length;
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  const goNext = async () => {
    const currentValidationFields = steps[currentStep].validationFields;
    
    if (currentValidationFields.length > 0) {
      const isValid = await form.trigger(currentValidationFields as any);
      if (!isValid) return;
    }

    if (isLastStep) {
      setIsSubmitting(true);
      try {
        await form.handleSubmit(onSubmit)();
      } finally {
        setIsSubmitting(false);
      }
    } else {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps - 1));
    }
  };

  const goBack = () => {
    if (currentStep === 0 && onCancel) {
      onCancel();
    } else {
      setCurrentStep((prev) => Math.max(prev - 1, 0));
    }
  };

  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <WizardContext.Provider value={{
      currentStep,
      totalSteps,
      steps,
      goNext,
      goBack,
      isFirstStep,
      isLastStep,
      isSubmitting
    }}>
      <div className="flex flex-col h-full min-h-[calc(100vh-120px)]" data-testid="form-wizard">
        <div className="flex-1 overflow-auto px-4 pb-32">
          <div className="mb-6">
            <Progress value={progress} className="h-1.5 mb-4" />
            
            <div className="flex items-center gap-2 mb-2">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'hsl(var(--trade) / 0.1)' }}
              >
                {steps[currentStep].icon}
              </div>
              <div>
                <Badge variant="outline" className="mb-1">
                  Step {currentStep + 1} of {totalSteps}
                </Badge>
                <h2 className="text-xl font-bold">{steps[currentStep].title}</h2>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">{steps[currentStep].description}</p>
          </div>

          {children[currentStep]}
        </div>

        <div 
          className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t p-4 safe-area-bottom"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          <div className="flex gap-3 max-w-2xl mx-auto">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="flex-1 min-h-[48px]"
              style={{ borderRadius: '12px' }}
              onClick={goBack}
              data-testid="button-wizard-back"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              {isFirstStep ? "Cancel" : "Back"}
            </Button>
            
            <Button
              type="button"
              size="lg"
              className="flex-1 text-white font-semibold min-h-[48px]"
              style={{ 
                backgroundColor: isLastStep ? 'hsl(142.1 76.2% 36.3%)' : 'hsl(var(--trade))',
                borderRadius: '12px'
              }}
              onClick={goNext}
              disabled={isSubmitting}
              data-testid="button-wizard-next"
            >
              {isSubmitting ? (
                "Creating..."
              ) : isLastStep ? (
                <>
                  <Check className="h-5 w-5 mr-2" />
                  {submitLabel}
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-5 w-5 ml-1" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </WizardContext.Provider>
  );
}

export const WIZARD_ICONS = {
  client: <Users className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />,
  details: <FileText className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />,
  items: <ListTodo className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />,
  review: <Eye className="h-5 w-5" style={{ color: 'hsl(var(--trade))' }} />
};
