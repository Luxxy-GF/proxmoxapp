// PXE Types - Matches the sync response from Panel
// These types must exactly match what /api/baremetal/agent/sync returns

export interface PXEProfile {
    id: string;
    name: string;
    osFamily: 'UBUNTU' | 'DEBIAN' | 'ALMALINUX' | 'OTHER';
    templateType: 'KICKSTART' | 'PRESEED' | 'WINDOWS' | 'RESCUE' | 'UTILITY';
    bootScriptTemplate?: string | null;
    installTemplate?: string | null;
    diskLayoutTemplate?: string | null;
    customScripts?: string | null;
    lateCommandsTemplate?: string | null;
    firstBootScript?: string | null;
    defaultPackages?: string | null;
    language?: string | null;
    timezone?: string | null;
    mirrorUrl?: string | null;
}

export interface PXEDiskLayout {
    id: string;
    name: string;
    syntax: string;
    content: string;
}

export interface PXEInstall {
    id: string;
    token: string;
    state: 'QUEUED' | 'RUNNING' | 'INVENTORY_SCAN' | 'DONE' | 'FAILED';
    userDataJson?: { rootPassword?: string; sshKeys?: string[] } | null;
    profile: PXEProfile;
    diskLayout?: PXEDiskLayout | null;
}

export interface PXEServer {
    id: string;
    mac: string;
    hostname: string;
    status: string;
    primaryIpv4?: string | null;
    gateway?: string | null;
    netmask?: string | null;
    nameservers?: string | null;
    activeInstall?: PXEInstall | null;
}

export interface PXEConfig {
    panelBaseUrl: string;
    panelCallbackUrl: string;
    servers: PXEServer[];
}
