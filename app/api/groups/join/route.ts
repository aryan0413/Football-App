import { jsonError, requireAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const groupName = String(body.groupName ?? "").trim();

    if (!groupName) {
      return Response.json({ error: "Enter a group name." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: groups, error: groupError } = await supabase
      .from("groups")
      .select("*")
      .ilike("name", groupName)
      .limit(2);

    if (groupError) throw groupError;
    if (!groups?.length) return Response.json({ error: "No group found with that exact name." }, { status: 404 });
    if (groups.length > 1) return Response.json({ error: "More than one group has that name. Ask an admin to invite you." }, { status: 409 });

    const group = groups[0];
    const { error: memberError } = await supabase
      .from("group_members")
      .upsert({ group_id: group.id, user_id: user.id, role: "PLAYER" }, { onConflict: "group_id,user_id" });

    if (memberError) throw memberError;
    return Response.json({ group });
  } catch (error) {
    return jsonError(error);
  }
}
