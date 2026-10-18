export type ConnState = "none" | "connected" | "pending_out" | "pending_in";

export type ConnPerson = { id: string; name: string; role: string; headline: string | null; batch: number; branch: string; company: string | null };

export type ConnItem = { id: string; person: ConnPerson; message: string | null; createdAt: string };

/** Body of GET /api/connections. */
export type ConnectionsResponse = { connected: ConnItem[]; incoming: ConnItem[]; outgoing: ConnItem[] };
