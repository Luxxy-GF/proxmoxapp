import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

interface RouteParams {
    params: Promise<{ id: string }>;
}

// GET /api/admin/pxe/profiles/[id] - Get single profile
export async function GET(req: Request, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const profile = await prisma.pXEProfile.findUnique({
        where: { id },
        include: {
            diskRules: {
                include: { diskLayout: true }
            }
        }
    });

    if (!profile) {
        return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    return NextResponse.json(profile);
}

// PATCH /api/admin/pxe/profiles/[id] - Update profile
export async function PATCH(req: Request, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        const body = await req.json();

        // Remove fields that shouldn't be in the update payload
        const {
            id: _id,
            createdAt,
            updatedAt,
            diskRules,  // Relation field
            ...updateData
        } = body;

        const profile = await prisma.pXEProfile.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json(profile);
    } catch (error) {
        console.error("[PXE_PROFILES_PATCH]", error);
        return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
    }
}

// DELETE /api/admin/pxe/profiles/[id] - Delete profile
export async function DELETE(req: Request, { params }: RouteParams) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        await prisma.pXEProfile.delete({
            where: { id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[PXE_PROFILES_DELETE]", error);
        return NextResponse.json({ error: "Failed to delete profile" }, { status: 500 });
    }
}
