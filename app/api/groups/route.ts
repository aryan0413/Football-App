import { jsonError, requireAppUser } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const user = await requireAppUser();
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const logo = String(body.logo ?? "").trim() || null;
    const description = String(body.description ?? "").trim() || null;

    if (!name) return Response.json({ error: "Group name is required." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data: group, error: groupError } = await supabase
      .from("groups")
      .insert({ name, logo, description, created_by: user.id })
      .select("*")
      .single();

    if (groupError) throw groupError;

    const { error: memberError } = await supabase
      .from("group_members")
      .insert({ group_id: group.id, user_id: user.id, role: "OWNER" });

    if (memberError) throw memberError;

    return Response.json({ group });
  } catch (error) {
    return jsonError(error);
  }
}
