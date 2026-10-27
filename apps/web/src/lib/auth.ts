import { schema } from "@alphascout/db";
import { cimd } from "@better-auth/cimd";
import { fetchClientMetadataResource } from "@better-auth/cimd/node";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { mcp } from "@better-auth/mcp";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { getWriteDb } from "@/lib/db";

/** Public origin of the app, e.g. https://alphascout… (http://localhost:3100 in dev). */
export const BASE_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";

/** OAuth-protected MCP endpoint (dashboard read/write). The anonymous one is /api/mcp. */
export const MCP_ACCOUNT_RESOURCE = `${BASE_URL}/api/mcp/account`;

export const auth = betterAuth({
  baseURL: BASE_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(getWriteDb(), { provider: "pg", schema }),
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID ?? "",
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? "",
    },
  },
  plugins: [
    jwt(),
    mcp({
      loginPage: "/login",
      consentPage: "/consent",
      resource: MCP_ACCOUNT_RESOURCE,
      scopes: ["openid", "profile", "email", "offline_access"],
      // CIMD is the 2026 MCP default; keep DCR for clients that still register dynamically.
      allowDynamicClientRegistration: true,
      allowUnauthenticatedClientRegistration: true,
      clientRegistrationDefaultApplicationType: "infer",
    }),
    cimd({ fetchClientMetadataResource, metadataProfile: "mcp-2026-07-28" }),
  ],
});
