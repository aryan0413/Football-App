import { jsonError, requireGroupRole } from "@/lib/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const groupId = url.searchParams.get("groupId") ?? "";
    const query = (url.searchParams.get("q") ?? "").trim();
    await requireGroupRole(groupId, ["OWNER", "ADMIN"]);

    if (!query) return Response.json({ users: [] });

    const supabase = getSupabaseAdmin();
    const username = query.replace(/^@/, "").toLowerCase();
    const [byUsername, byName] = await Promise.all([
      supabase
        .from("users")
        .select("id, username, display_name, profile_image, preferred_position")
        .ilike("username", `${username}%`)
        .limit(8),
      supabase
        .from("users")
        .select("id, username, display_name, profile_image, preferred_position")
        .ilike("display_name", `%${query}%`)
        .limit(8)
    ]);

    if (byUsername.error) throw byUsername.error;
    if (byName.error) throw byName.error;

    const users = new Map<string, any>();
    [...(byUsername.data ?? []), ...(byName.data ?? [])].forEach((user) => users.set(user.id, user));
    return Response.json({ users: Array.from(users.values()).slice(0, 8) });
  } catch (error) {
    return jsonError(error);
  }
}
