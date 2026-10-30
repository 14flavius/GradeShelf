import { decodeJwt } from "jose";
import { z } from "zod";
import { genericOAuth } from "better-auth/plugins";
import { authorizationCodeRequest, getOAuth2Tokens } from "better-auth/oauth2";
import { fetchSsoJson, type SsoConfiguration } from "./sso.ts";
import { ssoAccountKey, ssoProviderId } from "./sso-validation.ts";
import { logEvent } from "../logger.mjs";

const profileSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});
const tokenSchema = z.object({
  access_token: z.string().min(1),
  id_token: z.string().min(1),
  token_type: z.string().refine((value) => value.toLowerCase() === "bearer"),
  expires_in: z.number().nonnegative().optional(),
  scope: z.string().optional(),
});

export function ssoProvider(config: SsoConfiguration) {
  return genericOAuth({
    config: [
      {
        providerId: ssoProviderId,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        discoveryUrl: `${config.issuer.replace(/\/$/, "")}/.well-known/openid-configuration`,
        authorizationUrl: config.discovery.authorization_endpoint,
        tokenUrl: config.discovery.token_endpoint,
        requireIdTokenVerification: true,
        pkce: true,
        scopes: ["openid", "profile", "email"],
        disableSignUp: true,
        disableImplicitSignUp: true,
        disableProviderLogout: true,
        overrideUserInfo: false,
        authentication: config.discovery.authentication,
        // Keep protocol construction in Better Auth, while bounding outbound I/O.
        getToken: async (data) => {
          const request = await authorizationCodeRequest({
            ...data,
            options: { clientId: config.clientId, clientSecret: config.clientSecret },
            authentication: config.discovery.authentication,
            tokenEndpoint: config.discovery.token_endpoint,
          });
          const result = tokenSchema.parse(
            await fetchSsoJson(config.discovery.token_endpoint, {
              method: "POST",
              ...request,
            }),
          );
          return getOAuth2Tokens(result);
        },
        getUserInfo: async (tokens) => {
          try {
            if (!tokens.idToken) {
              return null;
            }
            // genericOAuth verifies signature, issuer, audience and nonce before this callback.
            const claims = profileSchema
              .extend({
                iss: z.literal(config.issuer),
                aud: z.union([z.string(), z.array(z.string()).min(1)]),
                exp: z.number().int(),
                iat: z.number().int(),
                azp: z.string().optional(),
              })
              .parse(decodeJwt(tokens.idToken));
            if (
              claims.iat > Date.now() / 1000 + 30 ||
              (Array.isArray(claims.aud) &&
                claims.aud.length > 1 &&
                claims.azp !== config.clientId) ||
              (claims.azp !== undefined && claims.azp !== config.clientId)
            ) {
              return null;
            }
            let profile: z.infer<typeof profileSchema> = claims;
            if (!profile.email && config.discovery.userinfo_endpoint && tokens.accessToken) {
              profile = profileSchema.parse(
                await fetchSsoJson(config.discovery.userinfo_endpoint, {
                  headers: { Authorization: `Bearer ${tokens.accessToken}` },
                }),
              );
              if (profile.sub !== claims.sub) {
                return null;
              }
            }
            if (!profile.email) {
              return null;
            }
            return {
              sub: claims.sub,
              email: profile.email,
              emailVerified: profile.email_verified === true,
              name: profile.name,
            };
          } catch {
            logEvent("auth.sso_profile_rejected");
            return null;
          }
        },
        accountSubject: ({ profile }) => {
          const subject = z.string().min(1).max(255).parse(profile.sub);
          return ssoAccountKey(config.issuer, config.clientId, subject);
        },
      },
    ],
  });
}
