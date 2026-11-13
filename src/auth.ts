
import NextAuth from "next-auth";
import Keycloak from "next-auth/providers/keycloak";
import prisma from "./lib/prisma";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  providers: [
    Keycloak({
      clientId: process.env.AUTH_KEYCLOAK_ID!,
      clientSecret: process.env.AUTH_KEYCLOAK_SECRET!,
      issuer: process.env.AUTH_KEYCLOAK_ISSUER!,
    }),
  ],

  callbacks: {
    async jwt({ token, user, account }) {
      // Only synchronize the user during Keycloak sign-in
      if (account?.provider === "keycloak" && user) {
        const keycloakId = account.providerAccountId;
        const email = user.email;

        if (!email) {
          throw new Error("Keycloak account has no email address.");
        }

        // Find the existing user or create a new one
        const dbUser = await prisma.user.upsert({
          where: {
            keycloakId,
          },

          update: {
            email,
            fullName: user.name || email,
          },

          create: {
            keycloakId,
            email,
            fullName: user.name || email,
          },

          select: {
            id: true,
            role: true,
            isActive: true,
          },
        });

        // Prevent inactive application users from accessing the system
        if (!dbUser.isActive) {
          throw new Error("Your account has been deactivated.");
        }

        // Store application details in the JWT
        token.userId = dbUser.id;
        token.role = dbUser.role;
      }

      return token;
    },

async session({ session, token }) {
  if (
    session.user &&
    typeof token.userId === "string" &&
    typeof token.role === "string"
  ) {
    Object.assign(session.user, {
      id: token.userId,
      role: token.role,
    });
  }

  return session;
},
  },
});
