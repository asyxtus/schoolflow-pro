import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/timetable")({
  component: () => (
    <ModulePlaceholder
      title="Timetable"
      description="Weekly schedule for classes and teachers"
      nextUp={[
        "Drag-to-place schedule editor with conflict detection",
        "Per-class and per-teacher printable views",
        "Substitution log when a teacher is absent",
      ]}
    />
  ),
});
