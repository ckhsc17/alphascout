import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { auth } from "@/lib/auth";

// RFC 8414 metadata. The issuer lives under /api/auth, so clients look here (with the path
// appended) rather than under the auth handler.
export const GET = oauthProviderAuthServerMetadata(auth);
