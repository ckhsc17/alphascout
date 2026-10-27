import { requireMcpAuth } from "@better-auth/mcp";
import { createMcpHandler } from "mcp-handler";
import { auth, MCP_ACCOUNT_RESOURCE } from "@/lib/auth";
import { registerDashboardTools } from "@/lib/mcp/dashboards";
import { registerAlphaScout, SERVER_INSTRUCTIONS } from "@/lib/mcp/server";

const INSTRUCTIONS = `${SERVER_INSTRUCTIONS}
You are signed in, so you can also build dashboards: create_dashboard, then add_widget with specs (list_viz_types shows every widget type with an example). Check each dataset's columns with describe_dataset first. Share the returned URL with the user.`;

/**
 * Authenticated MCP endpoint: everything /api/mcp offers plus dashboard tools. Requests without a
 * valid access token get a 401 with an RFC 9728 challenge, which makes MCP clients start the
 * OAuth flow (GitHub sign-in via Better Auth).
 */
const handler = requireMcpAuth(
  auth,
  (request, claims) => {
    const userId = claims.sub;
    if (!userId) return new Response("Token has no subject", { status: 403 });
    const mcp = createMcpHandler(
      (server) => {
        registerAlphaScout(server);
        registerDashboardTools(server, userId);
      },
      { serverInfo: { name: "alphascout-account", version: "0.1.0" }, instructions: INSTRUCTIONS },
    );
    return mcp(request);
  },
  { resource: MCP_ACCOUNT_RESOURCE },
);

export { handler as DELETE, handler as GET, handler as POST };
