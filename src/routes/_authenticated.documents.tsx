import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/page-header";
import { DocumentVaultCard } from "@/components/document-vault-card";

export const Route = createFileRoute("/_authenticated/documents")({
  component: DocumentsPage,
});

function DocumentsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <PageHeader
        title="Document Vault"
        description="School-wide files — policies, handbooks, and general records. For a specific student's documents, use their profile page."
      />
      <DocumentVaultCard ownerType="school" title="School documents" />
    </div>
  );
}
