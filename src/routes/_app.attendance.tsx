import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/attendance")({
  component: () => (
    <ModulePlaceholder
      title="Attendance"
      description="Daily register and absence tracking"
      nextUp={[
        "Class-by-class daily register with one-tap present/absent/late",
        "Absence reasons and guardian SMS notifications",
        "Monthly attendance reports per student and per class",
      ]}
    />
  ),
});
