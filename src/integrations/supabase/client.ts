// Supabase is disconnected — app runs on local store only.
// Re-connect by restoring the real createClient call and setting VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY.

const noop = () => ({ data: null, error: null });
const noopAsync = async () => ({ data: null, error: null });

const makeQueryBuilder = (): any => {
  const qb: any = {};
  const chain = () => qb;
  qb.select = chain; qb.insert = chain; qb.upsert = chain; qb.update = chain; qb.delete = chain;
  qb.eq = chain; qb.neq = chain; qb.or = chain; qb.in = chain; qb.is = chain; qb.gt = chain; qb.lt = chain;
  qb.gte = chain; qb.lte = chain; qb.order = chain; qb.limit = chain; qb.maybeSingle = noopAsync;
  qb.single = noopAsync;
  qb.then = (resolve: any) => Promise.resolve({ data: null, error: null }).then(resolve);
  return qb;
};

export const supabase: any = {
  from: () => makeQueryBuilder(),
  rpc: noopAsync,
  auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }),
    signUp: noopAsync,
    signInWithPassword: noopAsync,
    signOut: noopAsync,
    resetPasswordForEmail: noopAsync,
    updateUser: noopAsync,
  },
  channel: () => ({ on: () => ({ subscribe: noop }), subscribe: noop, unsubscribe: noop }),
  removeChannel: noop,
};