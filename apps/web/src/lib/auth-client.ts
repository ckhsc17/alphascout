"use client";

import { oauthProviderClient } from "@better-auth/oauth-provider/client";
import { createAuthClient } from "better-auth/react";

/** Browser auth client. The OAuth provider plugin forwards MCP authorization params on sign-in. */
export const authClient = createAuthClient({ plugins: [oauthProviderClient()] });
