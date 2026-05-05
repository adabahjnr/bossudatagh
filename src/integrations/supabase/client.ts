import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

const noop = () => ({ data: null, error: null });

const makeConfigError = () => ({
  message: "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
});

const makeQueryBuilder = (): any => {
  const qb: any = {};
  const chain = () => qb;
  qb.select = chain; qb.insert = chain; qb.upsert = chain; qb.update = chain; qb.delete = chain;
  qb.eq = chain; qb.neq = chain; qb.or = chain; qb.in = chain; qb.is = chain; qb.gt = chain; qb.lt = chain;
  qb.gte = chain; qb.lte = chain; qb.order = chain; qb.limit = chain;
  qb.maybeSingle = async () => ({ data: null, error: makeConfigError() });
  qb.single = async () => ({ data: null, error: makeConfigError() });
  qb.then = (resolve: any) => Promise.resolve({ data: null, error: makeConfigError() }).then(resolve);
  return qb;
};

const isConfigured = Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);

export const supabase: any = isConfigured
  ? createClient<Database>(SUPABASE_URL!, SUPABASE_PUBLISHABLE_KEY!)
  : {
      from: () => makeQueryBuilder(),
      rpc: async () => ({ data: null, error: makeConfigError() }),
      functions: {
        invoke: async () => ({ data: null, error: makeConfigError() }),
      },
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: noop } } }),
        signUp: async () => ({ data: null, error: makeConfigError() }),
        signInWithPassword: async () => ({ data: null, error: makeConfigError() }),
        signOut: async () => ({ error: null }),
        resetPasswordForEmail: async () => ({ data: null, error: makeConfigError() }),
        updateUser: async () => ({ data: null, error: makeConfigError() }),
      },
      channel: () => ({ on: () => ({ subscribe: noop }), subscribe: noop, unsubscribe: noop }),
      removeChannel: noop,
    };