import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_authenticated/settings")({
  component: () => (
    <ModulePlaceholder
      title="Settings"
      description="School profile, academic year, users and roles"
      nextUp={[
        "School profile: name, logo, motto, address, contact",
        "Academic year and term configuration",
        "Users, roles and permissions (admin, bursar, teacher, parent)",
      ]}
    />
  ),
});
