import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/students")({
  component: () => (
    <ModulePlaceholder
      title="Students"
      description="Master roster of every enrolled learner"
      nextUp={[
        "Searchable, filterable student table with class, form-master and status",
        "Student profile page: bio, guardians, fees, attendance, discipline",
        "Bulk import from Excel with column mapping and validation",
      ]}
    />
  ),
});
