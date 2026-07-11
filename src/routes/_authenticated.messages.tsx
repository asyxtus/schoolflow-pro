import { createFileRoute } from "@tanstack/react-router";
import { ModulePlaceholder } from "@/components/module-placeholder";

export const Route = createFileRoute("/_app/messages")({
  component: () => (
    <ModulePlaceholder
      title="Messages"
      description="Announcements to parents, staff and students"
      nextUp={[
        "Compose to a class, a form or the whole school",
        "SMS + in-app delivery with read receipts",
        "Template library for common notices (fees, holidays, PTA)",
      ]}
    />
  ),
});
