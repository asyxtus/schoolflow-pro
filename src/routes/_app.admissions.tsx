import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/admissions")({
  component: () => (
    <ModulePlaceholder
      title="Admissions"
      description="Applications from enquiry to enrolment"
      nextUp={[
        "Public application form with document uploads",
        "Kanban pipeline: New → Review → Interview → Offer → Enrolled",
        "Automated offer letters and fee-quote generation",
      ]}
    />
  ),
});
