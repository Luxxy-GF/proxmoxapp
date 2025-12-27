
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createProfileSchema = z.object({
    name: z.string().min(1),
    kind: z.enum(['INSTALL', 'RESCUE', 'INVENTORY']),
    osFamily: z.enum(['DEBIAN', 'UBUNTU', 'ALMALINUX', 'OTHER']),
    tags: z.array(z.string()),
    bootScriptTemplate: z.string().optional(),
});

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const json = await req.json();
        const body = createProfileSchema.parse(json);

        const profile = await prisma.pXEProfile.create({
            data: {
                name: body.name,
                kind: body.kind,
                osFamily: body.osFamily,
                tags: body.tags,
                bootScriptTemplate: body.bootScriptTemplate,
            },
        });

        return NextResponse.json(profile);
    } catch (error) {
        if (error instanceof z.ZodError) {
            return new NextResponse(JSON.stringify(error.errors), { status: 400 });
        }
        console.error("[PXE_PROFILES_POST]", error);
        return new NextResponse("Internal Error", { status: 500 });
    }
}

export async function GET(req: Request) {
    const session = await auth();
    // Allow users to see list of INSTALL profiles for reinstall wizard?
    // For now, restrict generic list to admins, but expose specific lists via server-actions or filtered endpoints if needed.
    if (!session?.user) {
        return new NextResponse("Forbidden", { status: 403 });
    }

    try {
        const profiles = await prisma.pXEProfile.findMany({
            orderBy: { name: 'asc' }
        });
        return NextResponse.json(profiles);
    } catch (error) {
        return new NextResponse("Internal Error", { status: 500 });
    }
}
