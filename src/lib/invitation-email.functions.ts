import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getUserSchoolId } from "./school-context";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const sendInvitationEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invitationId: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const schoolId = await getUserSchoolId(supabase, userId);
    if (!schoolId) throw new Error("No school assigned");

    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("school_id", schoolId);
    if (rolesError) throw new Error(rolesError.message);

    const canManage = (roles ?? []).some((row) =>
      row.role === "principal" ||
      row.role === "vice_principal" ||
      row.role === "bursar" ||
      row.role === "secretary" ||
      row.role === "super_admin",
    );
    if (!canManage) throw new Error("Only principals can manage staff");

    const { data: invitation, error: invitationError } = await supabase
      .from("staff_invitations")
      .select("id, email, token, status, school_id")
      .eq("id", data.invitationId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (invitationError) throw new Error(invitationError.message);
    if (!invitation) throw new Error("Invitation not found");
    if (invitation.status !== "pending") throw new Error("Invitation is no longer pending");

    const appUrl = (process.env.APP_URL ?? process.env.VITE_APP_URL)?.replace(/\/$/, "");
    if (!appUrl) {
      throw new Error("Missing APP_URL environment variable for invitation emails");
    }

    const redirectTo = `${appUrl}/accept-invite?token=${encodeURIComponent(invitation.token)}`;

    const { error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
      invitation.email,
      { redirectTo },
    );

    if (inviteError) {
      throw new Error(`Invitation email could not be sent: ${inviteError.message}`);
    }

    return { ok: true, invitationId: invitation.id };
  });
