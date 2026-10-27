import { createMcpHandler } from "mcp-handler";
import { registerAlphaScout, SERVER_INSTRUCTIONS } from "@/lib/mcp/server";

const handler = createMcpHandler(registerAlphaScout, {
  serverInfo: { name: "alphascout", version: "0.1.0" },
  instructions: SERVER_INSTRUCTIONS,
});

export { handler as DELETE, handler as GET, handler as POST };
