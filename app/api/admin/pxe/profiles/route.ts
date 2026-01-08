import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";
import { auth } from "@/auth";

// GET /api/admin/pxe/profiles - List all profiles
export async function GET(req: Request) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const templateType = searchParams.get("templateType");
    const enabled = searchParams.get("enabled");
    const isDestructive = searchParams.get("isDestructive");

    const where: Record<string, unknown> = {};

    if (templateType) {
        where.templateType = templateType;
    }
    if (enabled !== null && enabled !== undefined) {
        where.enabled = enabled === "true";
    }
    if (isDestructive !== null && isDestructive !== undefined) {
        where.isDestructive = isDestructive === "true";
    }

    const profiles = await prisma.pXEProfile.findMany({
        where,
        orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(profiles);
}

// POST /api/admin/pxe/profiles - Create new profile
export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();

        const profile = await prisma.pXEProfile.create({
            data: {
                name: body.name,
                templateType: body.templateType || "PRESEED",
                osFamily: body.osFamily || "DEBIAN",
                tags: body.tags || [],
                enabled: body.enabled ?? true,

                // Installation Metadata
                language: body.language,
                timezone: body.timezone,
                releaseVersion: body.releaseVersion,
                mirrorUrl: body.mirrorUrl,
                httpDirectory: body.httpDirectory,
                driversUrl: body.driversUrl,
                localCacheDir: body.localCacheDir,
                cachingPolicy: body.cachingPolicy || "SMART",

                // PXE Boot Configuration
                enableComboot: body.enableComboot ?? false,
                ipxeBiosFile: body.ipxeBiosFile,
                ipxeEfiFile: body.ipxeEfiFile,
                dhcpKeepAliveMinutes: body.dhcpKeepAliveMinutes ?? 5,

                // Network Configuration
                networkMode: body.networkMode || "AUTO",
                ipv4Behavior: body.ipv4Behavior || "allow",
                ipv6Behavior: body.ipv6Behavior || "allow",
                allowDifferentGateway: body.allowDifferentGateway ?? false,

                // Offering Rules
                requireServerTags: body.requireServerTags || [],
                excludeServerTags: body.excludeServerTags || [],
                requireUserRoles: body.requireUserRoles || [],
                excludeUserRoles: body.excludeUserRoles || [],
                serverTargetType: body.serverTargetType || "BOTH",

                // Completion Logic
                completionEvent: body.completionEvent || "AFTER_PXE",

                // Disk Layout
                defaultDiskLayoutId: body.defaultDiskLayoutId,
                fallbackToDefault: body.fallbackToDefault ?? true,
                forceDiskLayout: body.forceDiskLayout ?? false,

                // Scripts
                postInstallScriptIds: body.postInstallScriptIds || [],
                firstBootScriptIds: body.firstBootScriptIds || [],
                enforceScripts: body.enforceScripts ?? false,
                hideOtherScripts: body.hideOtherScripts ?? false,

                // Feature Permissions
                allowSetHostname: body.allowSetHostname ?? true,
                allowSshKeyInjection: body.allowSshKeyInjection ?? true,
                allowSetRootPassword: body.allowSetRootPassword ?? true,
                updateInventoryAfter: body.updateInventoryAfter ?? true,

                // Content
                bootScriptTemplate: body.bootScriptTemplate,
                installTemplate: body.installTemplate,
                diskLayoutTemplate: body.diskLayoutTemplate,
                defaultPackages: body.defaultPackages,
                customScripts: body.customScripts,

                // Flags
                isDestructive: body.isDestructive ?? false,
            },
        });

        return NextResponse.json(profile, { status: 201 });
    } catch (error) {
        console.error("[PXE_PROFILES_POST]", error);
        return NextResponse.json({ error: "Failed to create profile" }, { status: 500 });
    }
}
