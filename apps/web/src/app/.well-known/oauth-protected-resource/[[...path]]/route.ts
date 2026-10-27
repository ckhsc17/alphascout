import { auth } from "@/lib/auth";

// RFC 9728 metadata for /api/mcp/account; the MCP plugin answers these paths inside auth.handler.
export const GET = (request: Request) => auth.handler(request);
