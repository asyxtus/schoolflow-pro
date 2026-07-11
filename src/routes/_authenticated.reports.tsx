import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/reports")({
  component: () => (
    <ModulePlaceholder
      title="Reports"
      description="Termly report cards and transcripts"
      nextUp={[
        "Score entry per subject with weighted CA and exam components",
        "Automated ranking, remarks and printable report cards",
        "Cumulative transcript across academic years",
      ]}
    />
  ),
});
