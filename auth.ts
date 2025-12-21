import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Credentials from "next-auth/providers/credentials"
import { authConfig } from "./auth.config"
import bcrypt from "bcryptjs"

import { prisma } from "@/lib/db"

// const prisma = new PrismaClient()

export const { handlers, auth, signIn, signOut } = NextAuth({
    ...authConfig,
    adapter: PrismaAdapter(prisma) as any, // Type cast to bypass version mismatch
    session: { strategy: "jwt" },
    providers: [
        Credentials({
            name: "Proxmox",
            credentials: {
                username: { label: "Username", type: "text" },
                password: { label: "Password", type: "password" },
            },
            authorize: async (credentials) => {
                const username = credentials.username as string;
                const password = credentials.password as string;

                if (!username || !password) return null;

                const user = await prisma.user.findUnique({
                    where: { email: username }
                });

                if (!user || !user.password) return null;

                const isValid = await bcrypt.compare(password, user.password);
                if (!isValid) return null;

                return {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                }
            },
        }),
    ],
    callbacks: {
        async session({ session, token }) {
            if (token && session.user) {
                session.user.role = token.role as string;
                session.user.id = token.sub as string;
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                token.role = user.role;
            }
            return token
        }
    }
})
