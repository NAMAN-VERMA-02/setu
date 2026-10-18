import type { Match } from "./index";
import type { RouteMapData } from "./routes";

/** Body of GET /api/match. */
export type MatchResponse = {
  semester: number;
  total: number;
  bridgeBlocked: boolean;
  routeMap: RouteMapData;
  matches: Match[];
};
