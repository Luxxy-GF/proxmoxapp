import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// POST /api/admin/pxe/profiles/[id]/duplicate - Duplicate profile
export async function POST(req: Request, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        const original = await prisma.pXEProfile.findUnique({
            where: { id },
        });

        if (!original) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...data } = original;

        const duplicate = await prisma.pXEProfile.create({
            data: {
                ...data,
                name: `${original.name} (Copy)`,
            },
        });

        return NextResponse.json(duplicate, { status: 201 });
    } catch (error) {
        console.error("[PXE_PROFILES_DUPLICATE]", error);
        return NextResponse.json({ error: "Failed to duplicate profile" }, { status: 500 });
    }
}
