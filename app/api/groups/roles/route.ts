import { jsonError, requireGroupRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { GroupRole } from "@/lib/types";

const roles = new Set<GroupRole>(["ADMIN", "PLAYER"]);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const groupId = String(body.groupId ?? "");
    const userId = String(body.userId ?? "");
    const role = String(body.role ?? "") as GroupRole;

    if (!groupId || !userId || !roles.has(role)) {
      return Response.json({ error: "Group, user, and valid role are required." }, { status: 400 });
    }

    const { user } = await requireGroupRole(groupId, ["OWNER"]);
    if (user.id === userId) {
      return Response.json({ error: "You cannot change your own owner role." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: target, error: targetError } = await supabase
      .from("group_members")
      .select("role")
      .eq("group_id", groupId)
      .eq("user_id", userId)
      .maybeSingle();

    if (targetError) throw targetError;
    if (!target) return Response.json({ error: "User is not in this group." }, { status: 404 });
    if (target.role === "OWNER") {
      return Response.json({ error: "The group creator stays the owner." }, { status: 400 });
    }

    const { error } = await supabase
      .from("group_members")
      .update({ role })
      .eq("group_id", groupId)
      .eq("user_id", userId);

    if (error) throw error;
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
