import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.8";
import { corsHeaders } from "../_shared/cors.ts";

console.log("Function 'admin-get-users' started.");

// --- Helper Functions ---
async function getUserIdFromRequest(req: Request, supabaseClient: SupabaseClient): Promise<string | null> {
  const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
  return userError ? null : user?.id ?? null;
}

async function checkAdminRole(userId: string, supabaseClient: SupabaseClient): Promise<boolean> {
   if (!userId) return false;
   const { data: isAdmin, error: rpcError } = await supabaseClient.rpc('user_has_role', {
        user_id: userId,
        role_name: 'admin'
    });
    if (rpcError) {
        console.error("RPC Error checking admin role:", rpcError);
        return false;
    }
    return isAdmin ?? false;
}

// --- Main Handler ---
serve(async (req) => {
  // Handle CORS preflight & check method is POST
  if (req.method === 'OPTIONS') { return new Response("ok", { headers: corsHeaders }); }
  if (req.method !== 'POST') { return new Response(JSON.stringify({ error: "Method Not Allowed" }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

  try {
    // --- Auth and Admin Check ---
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization")! } }, auth: { persistSession: false } }
    );
    const userId = await getUserIdFromRequest(req, supabaseClient);
    const isAdmin = await checkAdminRole(userId!, supabaseClient);
    if (!isAdmin) { return new Response(JSON.stringify({ error: "Forbidden: Requires admin role" }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }); }

    console.log(`Admin user ${userId} authorized for get-users.`);

    // --- Get Body Params ---
    const { page = 1, perPage = 20, searchTerm = null } = await req.json();
    const pageNum = parseInt(page, 10) || 1;
    const perPageNum = parseInt(perPage, 10) || 20;
    const rangeStart = (pageNum - 1) * perPageNum;
    const rangeEnd = rangeStart + perPageNum - 1;
    const search = searchTerm?.trim() || null;

    console.log(`Fetching users page: ${pageNum}, perPage: ${perPageNum}, search: '${search}'`);

    const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Query profiles directly instead of auth.users
    let profileQuery = supabaseAdmin
        .from('profiles')
        .select('id, username, first_name, last_name, avatar_url', { count: 'exact' })
        .order('id', { ascending: false })
        .range(rangeStart, rangeEnd);

    if (search) {
        const lowerSearch = `%${search.toLowerCase()}%`;
        profileQuery = profileQuery.or(`username.ilike.${lowerSearch},first_name.ilike.${lowerSearch},last_name.ilike.${lowerSearch}`);
    }

    const { data: profiles, error: profilesError, count } = await profileQuery;

    if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw new Error("Failed to fetch users.");
    }

    if (!profiles || profiles.length === 0) {
        return new Response(JSON.stringify({ users: [], total: count ?? 0 }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
        });
    }

    const userIds = profiles.map(p => p.id);

    // Fetch roles for these users
    const { data: rolesData, error: rolesError } = await supabaseAdmin
        .from('user_roles')
        .select(`user_id, roles!inner(id, name)`)
        .in('user_id', userIds);

    if (rolesError) console.error("Error fetching roles:", rolesError);

    // For each profile, we need email and auth data from a direct query
    // Use service role to query auth.users table directly via RPC or raw query
    const { data: authUsers, error: authError } = await supabaseAdmin
        .rpc('get_users_auth_data', { user_ids: userIds })
        .then(result => {
            // If RPC doesn't exist, fall back to constructing without email
            if (result.error?.code === '42883') {
                console.warn('get_users_auth_data RPC not found, returning without email/auth data');
                return { data: null, error: null };
            }
            return result;
        });

    if (authError && authError.code !== '42883') {
        console.error("Error fetching auth data:", authError);
    }

    // Combine data
    const combinedUsers = profiles.map(profile => {
        const userRolesData = rolesData?.filter(r => r.user_id === profile.id) || [];
        const roles = userRolesData.map(r => r.roles).filter(role => role !== null);
        const authUser = authUsers?.find(u => u.id === profile.id);
        
        // Check if user is banned (banned_until is in the future)
        const isBanned = authUser?.banned_until ? new Date(authUser.banned_until) > new Date() : false;

        return {
            id: profile.id,
            email: authUser?.email || null,
            created_at: authUser?.created_at || null,
            last_sign_in_at: authUser?.last_sign_in_at || null,
            banned_until: authUser?.banned_until || null,
            is_banned: isBanned,
            username: profile.username,
            first_name: profile.first_name,
            last_name: profile.last_name,
            avatar_url: profile.avatar_url,
            roles: roles, 
        };
    });

    return new Response(JSON.stringify({ users: combinedUsers, total: count ?? 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error("Error in admin-get-users:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
