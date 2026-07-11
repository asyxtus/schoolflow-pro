import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/classes")({
  component: () => (
    <ModulePlaceholder
      title="Classes"
      description="Streams, sections and form-master assignments"
      nextUp={[
        "Class list with enrolment count and capacity",
        "Assign form master, subject teachers and class prefect",
        "Promotion workflow at year-end",
      ]}
    />
  ),
});
