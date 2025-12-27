# Project Summary: Proxmox Management Panel (Luxxy/Lumen)

**Date:** 2025-12-26  
**Project Name:** ProxmoxApp (Internal Codename)  
**Description:** A comprehensive web-based management panel for Proxmox VE, built with Next.js. It allows users to provision, manage, and access Virtual Machines (VMs) and LXC containers via a modern UI.

## Tech Stack

-   **Framework:** Next.js 16 (App Router)
-   **Language:** TypeScript
-   **Styling:** Tailwind CSS v4, Shadcn/UI (Radix Primitives), Lucide React icons
-   **Database:** PostgreSQL (with Prisma ORM)
-   **Authentication:** NextAuth.js (Beta), generic Credentials + OAuth support structurally
-   **State/Data Fetching:** React Server Components (RSC), Server Actions, generic `useSWR` or direct fetch patterns inferred
-   **Terminal/Console:** Xterm.js (Frontend) + Custom WebSocket Proxy (`termproxy` bridge to Proxmox)
-   **Billing:** Stripe integration (Dependencies present: `@stripe/react-stripe-js`)
-   **Charts:** Recharts

## Core Features Implemented

### 1. Server/VM Management
-   **Dashboard:** Overview of user's servers.
-   **Provisioning:**
    -   **Deployment Wizard:** Multi-step wizard to deploy new servers.
    -   **Templates:** Support for cloning from QEMU templates (`cloneQemu` logic).
    -   **ISO:** Support for booting from ISOs.
    -   **IP Pools:** Selection of IP pools during deployment to assign static IPs.
    -   **Storage:** Selection of storage backends.
-   **Control:** Start, Stop, Restart, Shutdown.
-   **Console:** Integrated Xterm.js web console connecting to Proxmox via WebSocket (`/api/proxy/console` & `/api/ws/termproxy`).
-   **Settings:** Rename server, toggle backups (snapshot/stop mode), VNC/Spice toggle (implied).

### 2. Infrastructure Management
-   **Nodes:** Management of Proxmox nodes (auth via API Token).
-   **IP Pools:** Management of IP ranges (Start IP, End IP, Gateway, Netmask, VLAN) per node.
-   **ISOs:** Upload and management of ISO files.
-   **Templates:** Grouping and management of OS templates.

### 3. User & Access
-   **Roles:** Admin/User distinction. First user registered becomes Admin automatically.
-   **Subusers:** Access control for sharing server management with other users.
-   **Billing:** Product definitions (CPU/RAM/Disk limits), Subscriptions, Invoices.

## Database Schema Highlights (Prisma)
-   **User:** Standard Auth fields + `balance`, `role`.
-   **Node:** Proxmox connection details (`endpoint`, `tokenId`, `tokenSecret`, `cotermEndpoint`).
-   **Server:** Core resource, links to `Node`, `User`, `Product`, `Template`.
    -   Has `ServerResources` (CPU/RAM/Disk specs).
    -   Has `ServerNetwork` (IP/Mac/Gateway).
    -   Has `BillingSubscription`.
-   **IPPool / IPAllocation:** IPAM logic.

## Recent Tasks & Changes
1.  **VM Restoration & Templates:**
    -   Fixed `waitForTask` race conditions during QEMU cloning.
    -   Re-enabled "OS Templates" tab in deployment wizard.
    -   Implemented backend logic for template-based cloning.

2.  **Console Implementation:**
    -   Built custom `termproxy` integration to proxy Proxmox VNC/Shell websockets to the browser via `xterm.js`.
    -   Added API routes for handling token generation and socket upgrades.

3.  **Deployment Wizard Fixes:**
    -   Resolved VMID allocation collisions.
    -   Fixed IP Pool selection display (filtering logic).
    -   Updated UI for "Media & Boot" selection (breadcrumbs, layout).

4.  **Build & Config:**
    -   Fixed Next.js build errors (e.g., `ignoreBuildErrors` placement, missing components).
    -   Resolved Prisma Client import issues (`@prisma/client` vs generated types).

## Current Issues / Known State
-   **Next.js Config:** `ignoreBuildErrors` was recently fixed in `next.config.ts`.
-   **Prisma:** Schema is stable, recently debugged import errors.
-   **UI:** "Coming Soon" page logic exists for `milred.cloud` flow (from history).

## Directory Structure Overview
-   `/app`: Next.js App Router pages and API routes.
    -   `/api/proxmox`: Proxmox integration endpoints.
    -   `/dashboard`: User panel.
    -   `/admin`: Admin panel (inferred).
-   `/components`: Reusable UI components (Shadcn/UI base).
-   `/lib`: Utility functions (Proxmox API client, DB client).
-   `/prisma`: Database schema and migrations.
