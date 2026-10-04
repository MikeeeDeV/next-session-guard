/**
 * Bridge: lets SessionManager work with the in-memory adapter.
 *
 * SessionManager talks to the database in "Prisma style" (prisma.session.create(...)).
 * The in-memory adapter has different method names, so we wrap it with a small
 * object that speaks the Prisma style but reads/writes the adapter's array.
 */

type Where = Record<string, any>;

function toTime(value: any): number {
  return new Date(value).getTime();
}

/** Checks if one row matches a Prisma-style `where` object. */
function matches(row: any, where: Where = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (key === "OR") return (cond as Where[]).some((w) => matches(row, w));

    const value = row[key];
    const isOperatorObject =
      cond !== null && typeof cond === "object" && !(cond instanceof Date);

    if (!isOperatorObject) return value === cond;

    if ("not" in cond && value === cond.not) return false;
    if ("in" in cond && !cond.in.includes(value)) return false;
    if ("gt" in cond && !(toTime(value) > toTime(cond.gt))) return false;
    if ("lt" in cond && !(toTime(value) < toTime(cond.lt))) return false;
    return true;
  });
}

export function isMemoryAdapter(client: any): boolean {
  return (
    !!client &&
    !client.session &&
    Array.isArray(client._store) &&
    typeof client.createSession === "function"
  );
}

export function memoryAdapterToPrisma(adapter: { _store: any[]; createSession: (d: any) => Promise<any> }) {
  const store = adapter._store;

  return {
    session: {
      create: async ({ data }: any) => adapter.createSession(data),

      findUnique: async ({ where }: any) => {
        const row = store.find((r) => matches(r, where));
        return row ? { ...row } : null;
      },

      findFirst: async ({ where }: any) => {
        const row = store.find((r) => matches(r, where));
        return row ? { ...row } : null;
      },

      findMany: async ({ where, orderBy, take }: any = {}) => {
        let rows = store.filter((r) => matches(r, where)).map((r) => ({ ...r }));
        if (orderBy?.lastActiveAt === "desc") {
          rows.sort((a, b) => toTime(b.lastActiveAt) - toTime(a.lastActiveAt));
        }
        if (typeof take === "number") rows = rows.slice(0, take);
        return rows;
      },

      update: async ({ where, data }: any) => {
        const row = store.find((r) => matches(r, where));
        if (!row) throw new Error("Record to update not found.");
        Object.assign(row, data);
        return { ...row };
      },

      updateMany: async ({ where, data }: any) => {
        const rows = store.filter((r) => matches(r, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },

      deleteMany: async ({ where }: any) => {
        let count = 0;
        for (let i = store.length - 1; i >= 0; i--) {
          if (matches(store[i], where)) {
            store.splice(i, 1);
            count++;
          }
        }
        return { count };
      },
    },
  };
}