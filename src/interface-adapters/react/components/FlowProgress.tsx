"use client";

import { cn } from '../utils';

interface FlowProgressProps {
  currentStep: number;
  totalSteps?: number;
  className?: string;
}

export const FlowProgress = ({
  currentStep,
  totalSteps = 4,
  className,
}: FlowProgressProps) => {
  const normalizedCurrentStep = Math.min(Math.max(currentStep, 1), totalSteps);

  return (
    <div
      className={cn('flow-progress', className)}
      aria-label={`진행 단계 ${normalizedCurrentStep}/${totalSteps}`}
    >
      {Array.from({ length: totalSteps }, (_, index) => {
        const step = index + 1;

        return (
          <span
            key={step}
            className={cn(step === normalizedCurrentStep && 'is-active')}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
};
