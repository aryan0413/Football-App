import { jsonError, requireAppUser, requireGroupRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  try {
    const user = await requireAppUser();
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("group_invitations")
      .select("id, status, created_at, groups(id, name, logo), inviter:invited_by(display_name, username)")
      .eq("invited_user_id", user.id)
      .eq("status", "PENDING")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return Response.json({ invitations: data ?? [] });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const groupId = String(body.groupId ?? "");
    const invitedUserId = String(body.invitedUserId ?? "");
    const { user } = await requireGroupRole(groupId, ["OWNER", "ADMIN"]);

    if (!invitedUserId) return Response.json({ error: "Invited user is required." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: existingMember } = await supabase
      .from("group_members")
      .select("id")
      .eq("group_id", groupId)
      .eq("user_id", invitedUserId)
      .maybeSingle();

    if (existingMember) return Response.json({ error: "User is already a member." }, { status: 409 });

    const { data, error } = await supabase
      .from("group_invitations")
      .insert({ group_id: groupId, invited_user_id: invitedUserId, invited_by: user.id, status: "PENDING" })
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") return Response.json({ error: "Invitation already exists." }, { status: 409 });
      throw error;
    }

    return Response.json({ invitation: data });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const invitationId = String(body.invitationId ?? "");
    const status = String(body.status ?? "");
    if (!["ACCEPTED", "DECLINED"].includes(status)) {
      return Response.json({ error: "Invalid invitation status." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: invitation, error: inviteError } = await supabase
      .from("group_invitations")
      .select("*")
      .eq("id", invitationId)
      .eq("invited_user_id", user.id)
      .eq("status", "PENDING")
      .maybeSingle();

    if (inviteError) throw inviteError;
    if (!invitation) return Response.json({ error: "Invitation not found." }, { status: 404 });

    const { error: updateError } = await supabase
      .from("group_invitations")
      .update({ status })
      .eq("id", invitationId);

    if (updateError) throw updateError;

    if (status === "ACCEPTED") {
      const { error: memberError } = await supabase
        .from("group_members")
        .upsert({ group_id: invitation.group_id, user_id: user.id, role: "PLAYER" }, { onConflict: "group_id,user_id" });

      if (memberError) throw memberError;
    }

    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
