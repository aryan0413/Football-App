const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { AsyncLocalStorage } = require("node:async_hooks");
const ts = require("typescript");
const { createClient } = require("@supabase/supabase-js");
require("@next/env").loadEnvConfig(process.cwd(), true, { info() {}, error() {} });

const context = new AsyncLocalStorage();
const modules = new Map();
let database;
const auth = {
  async requireAppUser() { return context.getStore(); },
  async requireGroupRole(groupId, allowed) {
    const user = context.getStore();
    const result = await database.from("group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).maybeSingle();
    if (result.error) throw result.error;
    if (!allowed.includes(result.data?.role)) throw new Response("Forbidden", { status: 403 });
    return { user, role: result.data.role };
  },
  jsonError(error) {
    return error instanceof Response ? error : Response.json({ error: error.message ?? String(error) }, { status: 500 });
  }
};
function load(relative) {
  const filename = path.resolve(__dirname, "..", relative);
  if (modules.has(filename)) return modules.get(filename);
  const exports = {};
  modules.set(filename, exports);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText;
  vm.runInNewContext(compiled, { exports, Response, Request, URL, Buffer, crypto: globalThis.crypto, console,
    require(name) {
      if (name === "@/lib/auth") return auth;
      if (name === "@/lib/supabase") return { getSupabaseAdmin: () => database };
      if (name === "@clerk/nextjs/server") return { auth: async () => ({ userId: context.getStore()?.id ?? null }) };
      if (name === "next/cache") return { unstable_cache: (fn) => fn };
      return name.startsWith("@/") ? load(`${name.slice(2)}.ts`) : require(name);
    }
  }, { filename });
  return exports;
}
const live = load("lib/auctionLive.ts");

async function unitChecks() {
  let state = live.emptyAuctionState("LIVE");
  for (let i = 0; i < 100; i++) {
    const bid = { id: `bid${i}`, playerId: "player", teamId: `team${i % 2}`, amount: 20000 + i * 50000, bidderUserId: "captain", createdAt: new Date().toISOString() };
    state = { ...state, currentBid: bid, bidHistory: [bid, ...state.bidHistory], undoStack: live.pushAuctionUndo(state, "BID", { bidId: bid.id }) };
  }
  assert.equal(state.undoStack.length, 30);
  assert.ok(state.undoStack.every(frame => !frame.state.undoStack && frame.state.bidHistory.length === 0));
  assert.ok(JSON.stringify(state).length < 60000, "Undo history must stay bounded, not recursively duplicate earlier history");
  const photos = load("lib/playerPhotos.ts");
  const players = [{ id: "one", profile_image: "data:image/png;base64,AAA" }, { id: "two", profile_image: "https://example.com/photo.webp" }];
  const normalized = photos.withPlayerPhotoUrls(players);
  assert.match(normalized[0].profile_image, /^\/api\/player-photos\/one\?v=[a-f0-9]{16}$/);
  assert.equal(normalized[1].profile_image, players[1].profile_image);
  assert.equal(players[0].profile_image, "data:image/png;base64,AAA");
  const source = `data:image/png;base64,${(await require("sharp")({ create: { width: 600, height: 600, channels: 3, background: "#126b45" } }).png().toBuffer()).toString("base64")}`;
  const photoId = crypto.randomUUID();
  database = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { profile_image: source }, error: null }) }) }) }) };
  const photoRoute = load("app/api/player-photos/[id]/route.ts").GET;
  const photoRequest = new Request(`http://localhost/api/player-photos/${photoId}?v=${photos.playerPhotoVersion(source)}`);
  assert.equal((await photoRoute(photoRequest, { params: Promise.resolve({ id: photoId }) })).status, 401);
  const optimized = await context.run({ id: "viewer" }, () => photoRoute(photoRequest, { params: Promise.resolve({ id: photoId }) }));
  assert.equal(optimized.status, 200);
  assert.equal(optimized.headers.get("content-type"), "image/webp");
  assert.match(optimized.headers.get("cache-control"), /^private/);
  const metadata = await require("sharp")(Buffer.from(await optimized.arrayBuffer())).metadata();
  assert.equal(metadata.width, 256);
  assert.equal(metadata.height, 256);
  console.log("PASS bounded undo history, photo URL normalization and authenticated/cached WebP endpoint");
  const actualAuth = load("lib/auth.ts");
  database = { from(table) {
    let userId;
    return { select(columns) {
      if (table === "users") assert.ok(!columns.includes("profile_image"), "API auth must not fetch image bodies");
      return this;
    }, eq(column, value) { if (column === "clerk_user_id" || column === "user_id") userId = value; return this; },
    async maybeSingle() { return { data: table === "users" ? { id: userId } : { role: userId }, error: null }; } };
  } };
  for (const role of ["OWNER", "ADMIN"]) {
    assert.equal((await context.run({ id: role }, () => actualAuth.requireGroupRole("group", ["OWNER", "ADMIN"]))).role, role);
  }
  try {
    await context.run({ id: "PLAYER" }, () => actualAuth.requireGroupRole("group", ["OWNER", "ADMIN"]));
    assert.fail("Player role must not be able to start auctions");
  } catch (error) {
    assert.equal(error.status, 403);
    assert.match((await error.json()).error, /group owner or admin/);
  }
  console.log("PASS actual owner/admin permission checks and useful JSON denial messages");
}

async function integrationChecks() {
  assert.ok(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL, "Database credentials required");
  database = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const photosResult = await database.from("users").select("id, display_name, preferred_position, profile_image");
  if (photosResult.error) throw photosResult.error;
  const before = Buffer.byteLength(JSON.stringify(photosResult.data));
  const after = Buffer.byteLength(JSON.stringify(load("lib/playerPhotos.ts").withPlayerPhotoUrls(photosResult.data)));
  console.log(`Player roster payload: ${before} -> ${after} bytes (${(100 - after / before * 100).toFixed(1)}% smaller).`);
  const prefix = `qa_${Date.now().toString(36)}`;
  const createdUsers = [];
  let groupId;
  const routes = Object.fromEntries(["start", "setup", "ready", "bid", "control", "sell", "end"].map(name => [name, load(`app/api/auctions/${name}/route.ts`).POST]));
  async function call(name, user, payload, expected = 200) {
    const response = await context.run(user, () => routes[name](new Request(`http://localhost/api/auctions/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })));
    const data = await response.json().catch(() => ({}));
    assert.equal(response.status, expected, `${name}: ${JSON.stringify(data)}`);
    return data;
  }
  async function checked(query) {
    const { data, error } = await query;
    if (error) throw error;
    return data;
  }
  try {
    for (const [index, name] of ["Owner", "Captain A", "Captain B", "Auctioneer", "Player"].entries()) {
      const user = await checked(database.from("users").insert({ clerk_user_id: `${prefix}_${index}`, username: `${prefix}_${index}`, display_name: `Auction QA ${name}`, preferred_position: "CM" }).select("id").single());
      createdUsers.push(user);
    }
    const [owner, captainA, captainB, auctioneer, player] = createdUsers;
    groupId = (await checked(database.from("groups").insert({ name: `${prefix} isolated auction checks`, created_by: owner.id }).select("id").single())).id;
    await checked(database.from("group_members").insert(createdUsers.map((user, i) => ({ group_id: groupId, user_id: user.id, role: i === 0 ? "OWNER" : "PLAYER" }))));
    const group = await checked(database.from("groups").select("name").eq("id", groupId).single());
    const join = load("app/api/groups/join/route.ts").POST;
    const invitations = load("app/api/groups/invitations/route.ts").PATCH;
    await checked(database.from("group_members").update({ role: "ADMIN" }).eq("group_id", groupId).eq("user_id", captainA.id));
    for (const [user, role] of [[owner, "OWNER"], [captainA, "ADMIN"], [player, "PLAYER"]]) {
      const joined = await context.run(user, () => join(new Request("http://localhost/api/groups/join", { method: "POST", body: JSON.stringify({ groupName: group.name, role: "OWNER" }) })));
      assert.equal(joined.status, 200);
      const afterJoin = await checked(database.from("group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).single());
      assert.equal(afterJoin.role, role, "Joining again must neither demote admins nor promote players");
      const invitation = await checked(database.from("group_invitations").insert({ group_id: groupId, invited_user_id: user.id, invited_by: owner.id, status: "PENDING" }).select("id").single());
      const accepted = await context.run(user, () => invitations(new Request("http://localhost/api/groups/invitations", { method: "PATCH", body: JSON.stringify({ invitationId: invitation.id, status: "ACCEPTED" }) })));
      assert.equal(accepted.status, 200);
      const afterInvite = await checked(database.from("group_members").select("role").eq("group_id", groupId).eq("user_id", user.id).single());
      assert.equal(afterInvite.role, role, "Accepting an invitation must preserve an existing membership role");
    }
    console.log("PASS real database: owner/admin roles preserved on rejoin and invitation acceptance; players cannot promote themselves");
    await call("start", player, { groupId }, 403);
    const [first, simultaneous] = await Promise.all([call("start", owner, { groupId }), call("start", owner, { groupId })]);
    const matchId = first.matchId;
    assert.equal(matchId, simultaneous.matchId, "Concurrent starts must create one room");
    let snapshot = await live.getAuctionSnapshot(database, matchId);
    assert.equal(snapshot.teams.length, 2);
    assert.equal(snapshot.auction.starting_purse, 5000000);
    const teams = snapshot.teams.map((team, i) => ({ id: team.id, captainId: [captainA, captainB][i].id }));
    await call("setup", owner, { matchId, teams: [{ ...teams[0], id: crypto.randomUUID() }, teams[1]], auctioneerId: auctioneer.id, playerIds: [owner.id] }, 400);
    await call("setup", owner, { matchId, teams, auctioneerId: captainA.id, playerIds: [owner.id] }, 400);
    await call("setup", owner, { matchId, teams, auctioneerId: auctioneer.id, playerIds: [owner.id] });
    const waiting = await call("ready", owner, { matchId, forceStart: true });
    assert.equal(waiting.snapshot.state.status, "DRAFT");
    assert.equal(waiting.snapshot.selectedPlayers[0].id, owner.id, "Observer admin must remain in player pool");
    const joined = await call("ready", captainA, { matchId });
    assert.ok(joined.snapshot.readyRows.some(row => row.user_id === captainA.id), "Ready response must immediately reflect join");
    await Promise.all([call("ready", captainB, { matchId }), call("ready", auctioneer, { matchId })]);
    snapshot = await live.getAuctionSnapshot(database, matchId);
    assert.equal(snapshot.state.status, "LIVE");
    assert.equal(snapshot.state.currentPlayerId, owner.id);
    const rejoined = await call("start", owner, { groupId, matchId });
    assert.equal(rejoined.auction.status, "LIVE", "Rejoining must never reset a live auction");
    await call("bid", player, { matchId, playerId: owner.id, amount: 20000 }, 403);
    const bids = await Promise.all([captainA, captainB].map(user => context.run(user, () => routes.bid(new Request("http://localhost/api/auctions/bid", { method: "POST", body: JSON.stringify({ matchId, playerId: owner.id, amount: 20000 }) })))));
    assert.equal(bids.filter(response => response.status === 200).length, 1, "Only one equal simultaneous bid can win");
    assert.ok(bids.every(response => [200, 400, 409].includes(response.status)));
    snapshot = await live.getAuctionSnapshot(database, matchId);
    assert.equal(snapshot.state.currentBid.amount, 20000);
    const losingCaptain = snapshot.state.currentBid.bidderUserId === captainA.id ? captainB : captainA;
    await call("bid", losingCaptain, { matchId, playerId: owner.id, amount: 20001 }, 400);
    await call("bid", losingCaptain, { matchId, playerId: owner.id, amount: 6000000 }, 400);
    await call("bid", losingCaptain, { matchId, playerId: owner.id, amount: 70000 });
    const beforeUndo = (await live.getAuctionSnapshot(database, matchId)).state.version;
    const undone = await call("control", auctioneer, { matchId, action: "UNDO" });
    assert.equal(undone.snapshot.state.currentBid.amount, 20000);
    assert.ok(undone.snapshot.state.version > beforeUndo, "Undo versions must move forward so clients accept them");
    await call("control", auctioneer, { matchId, action: "STOP" });
    assert.equal((await live.getAuctionSnapshot(database, matchId)).state.status, "PAUSED");
    const pausedRejoin = await call("ready", auctioneer, { matchId, forceStart: true });
    assert.equal(pausedRejoin.snapshot.state.status, "PAUSED", "Joining must not bypass pause");
    await call("control", auctioneer, { matchId, action: "RESUME" });
    const sold = await call("sell", auctioneer, { matchId, playerId: owner.id });
    assert.equal(sold.snapshot.state.completed[owner.id].status, "SOLD");
    assert.equal(sold.snapshot.teams.flatMap(team => team.team_players).reduce((sum, row) => sum + row.auction_price, 0), 20000);
    await call("end", auctioneer, { matchId });
    assert.equal((await live.getAuctionSnapshot(database, matchId)).state.status, "ENDED");
    await checked(database.from("matches").update({ status: "SCHEDULED" }).eq("id", matchId));
    const fresh = await call("start", owner, { groupId });
    assert.notEqual(fresh.matchId, matchId, "Starting after completion must create a new auction");
    assert.equal((await live.getAuctionSnapshot(database, matchId)).state.status, "ENDED", "Completed results must stay intact");
    console.log("PASS real database: concurrent creation, permissions, captain/setup validation, minimum one player, admin pool preservation, three joins, concurrent bids, increments/budget, undo, pause/resume, sell, completion and fresh room");
  } finally {
    if (groupId) await checked(database.from("groups").delete().eq("id", groupId));
    if (createdUsers.length) await checked(database.from("users").delete().in("id", createdUsers.map(user => user.id)));
    console.log("Removed only this run's isolated QA group and QA users.");
  }
}

(async () => {
  await unitChecks();
  if (process.argv.includes("--integration")) await integrationChecks();
})().catch(error => { console.error(error); process.exitCode = 1; });
