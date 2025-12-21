import { Node } from "@prisma/client"
import { decrypt } from "./encryption"

interface ProxmoxResponse<T = any> {
    data: T
    errors?: any
    success?: boolean
}

export interface ProxmoxConsoleSession {
    upid: string
    ticket: string
    port: number
    proto?: string
}

export async function callProxmoxApi(
    node: Node,
    path: string,
    method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD" = "GET",
    body?: any
): Promise<any> {
    const tokenId = decrypt(node.tokenId)
    const tokenSecret = decrypt(node.tokenSecret)

    const headers = {
        Authorization: `PVEAPIToken=${tokenId}=${tokenSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
    }

    // Ensure trailing slash is handled or relative paths
    const cleanPath = path.startsWith("/") ? path : `/${path}`
    const url = `${node.endpoint}${cleanPath}`.replace(/([^:]\/)\/+/g, "$1") // Simple double slash cleanup

    // Transform body to form-urlencoded for Proxmox if needed, or simple JSON?
    // Proxmox API usually expects form data or urlencoded.
    let requestBody: string | undefined
    let finalUrl = url

    if (body) {
        const params = new URLSearchParams(body).toString()
        if (method === "GET" || method === "HEAD") {
            finalUrl += (finalUrl.includes('?') ? '&' : '?') + params
        } else {
            requestBody = params
        }
    }

    console.log(`[Proxmox] Calling ${method} ${finalUrl}`)

    try {
        const response = await fetch(finalUrl, {
            method,
            headers,
            body: requestBody,
            // Allow self-signed certs in dev/internal if needed (node specific, but Next.js fetch wraps native)
            // For strictly node environment with self-signed:
            // agent: new https.Agent({ rejectUnauthorized: false }) -> unsafe but common
            // Next.js fetch polyfill might be strict.
        })

        if (!response.ok) {
            const text = await response.text()
            console.error(`[Proxmox] Error ${response.status}: ${text}`)
            throw new Error(`Proxmox API Error: ${response.status} ${response.statusText} - ${text}`)
        }

        const json = await response.json()
        // Proxmox returns { data: ... } wrapped
        return json.data
    } catch (error) {
        console.error(`[Proxmox] Call failed: ${error}`)
        throw error
    }
}

export async function getNodeStatus(node: Node) {
    try {
        const data = await callProxmoxApi(node, `/nodes/${node.proxmoxId}/status`, "GET")

        // Calculate percentages
        // cpu is 0-1 (e.g. 0.05 for 5%)
        // memory is bytes
        // rootfs is bytes

        const cpu = (data.cpu || 0) * 100
        const ram = (data.memory && data.memory.total) ? (data.memory.used / data.memory.total) * 100 : 0
        const disk = (data.rootfs && data.rootfs.total) ? (data.rootfs.used / data.rootfs.total) * 100 : 0

        return {
            online: true,
            cpu,
            ram,
            disk,
            uptime: data.uptime,
            version: data.pveversion
        }
    } catch (error) {
        console.error("Failed to get node status:", error)
        return { online: false, error }
    }
}

export async function getNextVmid(node: Node, vmid?: number) {
    try {
        const path = vmid ? `/cluster/nextid?vmid=${vmid}` : "/cluster/nextid"
        const data = await callProxmoxApi(node, path, "GET")
        return parseInt(data)
    } catch (error) {
        // console.error("Failed to get next VMID:", error)
        throw error
    }
}


export async function getTaskStatus(node: Node, upid: string) {
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/tasks/${upid}/status`, "GET")
}

export async function waitForTask(node: Node, upid: string) {
    let status = "running"
    let exitStatus = null

    // Poll every 1s
    while (status === "running") {
        await new Promise(r => setTimeout(r, 1000))
        const data = await getTaskStatus(node, upid)
        status = data.status
        exitStatus = data.exitstatus
    }

    if (exitStatus !== "OK") {
        throw new Error(`Task failed with exit status: ${exitStatus}`)
    }
    return true
}

export async function getStorage(node: Node) {
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/storage`, "GET", { content: 'images' })
}

export async function cloneLxc(node: Node, vmid: number, newid: number, hostname: string, description?: string, storage?: string) {
    const body: any = {
        newid,
        hostname,
        full: 1 // Full clone by default
    }
    if (description) body.description = description
    if (storage) body.storage = storage

    // Returns UPID
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/lxc/${vmid}/clone`, "POST", body)
}

export async function cloneQemu(node: Node, vmid: number, newid: number, name: string, description?: string, storage?: string) {
    const body: any = {
        newid,
        name,
        full: 1
    }
    if (description) body.description = description
    if (storage) body.storage = storage

    // Returns UPID
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/qemu/${vmid}/clone`, "POST", body)
}

export async function setLxcConfig(node: Node, vmid: number, config: {
    cores?: number,
    memory?: number,
    swap?: number,
    password?: string,
    net0?: string,
    nameserver?: string
}) {
    const body: any = {}
    if (config.cores) body.cores = config.cores
    if (config.memory) body.memory = config.memory
    if (config.swap !== undefined) body.swap = config.swap
    if (config.password) body.password = config.password
    if (config.net0) body.net0 = config.net0
    if (config.nameserver) body.nameserver = config.nameserver

    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/lxc/${vmid}/config`, "PUT", body)
}

export async function startVm(node: Node, vmid: number, type: "lxc" | "qemu") {
    // Start is also async task, but we usually don't wait for it unless we need IP immediately
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/${type}/${vmid}/status/start`, "POST")
}

export async function stopVm(node: Node, vmid: number, type: "lxc" | "qemu") {
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/${type}/${vmid}/status/stop`, "POST")
}

export async function shutdownVm(node: Node, vmid: number, type: "lxc" | "qemu") {
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/${type}/${vmid}/status/shutdown`, "POST")
}

export async function rebootVm(node: Node, vmid: number, type: "lxc" | "qemu") {
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/${type}/${vmid}/status/reboot`, "POST")
}


export async function resetVm(node: Node, vmid: number, type: "lxc" | "qemu") {
    if (type === "lxc") {
        // LXC doesn't have "reset" in the same way, use reboot instead
        return callProxmoxApi(node, `/nodes/${node.proxmoxId}/${type}/${vmid}/status/reboot`, "POST")
    }
    // QEMU has a proper reset endpoint
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/${type}/${vmid}/status/reset`, "POST")
}


export async function suspendVm(node: Node, vmid: number, type: "lxc" | "qemu") {
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/${type}/${vmid}/status/suspend`, "POST")
}

export async function resumeVm(node: Node, vmid: number, type: "lxc" | "qemu") {
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/${type}/${vmid}/status/resume`, "POST")
}

export async function getVmTasks(node: Node, vmid: number, limit = 25) {
    return callProxmoxApi(node, "/cluster/tasks", "GET", {
        vmid,
        limit,
        start: 0,
    })
}

export async function setQemuConfig(node: Node, vmid: number, config: {
    cores?: number,
    memory?: number,
    sockets?: number,
    ciuser?: string,
    cipassword?: string,
    ipconfig0?: string,
    sshkeys?: string,
    net0?: string,
    nameserver?: string
}) {
    const body: any = {}
    if (config.cores) body.cores = config.cores
    if (config.memory) body.memory = config.memory
    if (config.sockets) body.sockets = config.sockets
    if (config.ciuser) body.ciuser = config.ciuser
    if (config.cipassword) body.cipassword = config.cipassword
    if (config.ipconfig0) body.ipconfig0 = config.ipconfig0
    if (config.sshkeys) body.sshkeys = config.sshkeys
    if (config.net0) body.net0 = config.net0
    if (config.nameserver) body.nameserver = config.nameserver

    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/qemu/${vmid}/config`, "POST", body)
}

export async function getQemuConfig(node: Node, vmid: number) {
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/qemu/${vmid}/config`, "GET")
}


export async function resizeLxcDisk(node: Node, vmid: number, disk: string, size: string) {
    const body: any = {
        disk,
        size
    }
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/lxc/${vmid}/resize`, "PUT", body)
}

export async function resizeQemuDisk(node: Node, vmid: number, disk: string, size: string) {
    const body: any = {
        disk,
        size
    }
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/qemu/${vmid}/resize`, "PUT", body)
}

export async function getVmStatus(node: Node, vmid: number, type: "qemu" | "lxc" = "qemu") {
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/${type}/${vmid}/status/current`, "GET")
}

export async function createVncProxy(node: Node, vmid: number, type: "qemu" | "lxc") {
    // Generate ticket
    const res = await callProxmoxApi(node, `/nodes/${node.proxmoxId}/${type}/${vmid}/vncproxy`, "POST", {
        websocket: 1
    })
    return res
}

// ========================================
// Server Settings Helper Functions
// ========================================

export async function setAutoStart(node: Node, vmid: number, type: "qemu" | "lxc", enabled: boolean) {
    const path = `/nodes/${node.proxmoxId}/${type}/${vmid}/config`
    return callProxmoxApi(node, path, "PUT", { onboot: enabled ? 1 : 0 })
}

export async function deleteVm(node: Node, vmid: number, type: "qemu" | "lxc") {
    try {
        // First, try to stop the VM/LXC if it's running
        try {
            await stopVm(node, vmid, type)

            // Wait for the VM to actually stop (poll status for up to 30 seconds)
            const maxAttempts = 30
            for (let i = 0; i < maxAttempts; i++) {
                await new Promise(resolve => setTimeout(resolve, 1000)) // Wait 1 second

                const status = await callProxmoxApi(
                    node,
                    `/nodes/${node.proxmoxId}/${type}/${vmid}/status/current`,
                    "GET"
                )

                if (status.data.status === "stopped") {
                    break
                }

                if (i === maxAttempts - 1) {
                    console.warn(`[Proxmox] VM ${vmid} did not stop after ${maxAttempts} seconds, attempting force delete`)
                }
            }
        } catch (e) {
            // VM might already be stopped or doesn't exist, continue with deletion
            console.log(`[Proxmox] Stop VM ${vmid} returned error (may already be stopped):`, e)
        }

        // Now delete the VM/LXC
        const path = `/nodes/${node.proxmoxId}/${type}/${vmid}`
        return await callProxmoxApi(node, path, "DELETE", { purge: 1 })
    } catch (error) {
        console.error(`[Proxmox] Failed to delete ${type} ${vmid}:`, error)
        throw error
    }
}

export async function getAvailableTemplates(node: Node) {
    // Get both LXC and QEMU templates
    const lxcPath = `/nodes/${node.proxmoxId}/lxc`
    const qemuPath = `/nodes/${node.proxmoxId}/qemu`

    try {
        const [lxcResponse, qemuResponse] = await Promise.all([
            callProxmoxApi(node, lxcPath, "GET"),
            callProxmoxApi(node, qemuPath, "GET")
        ])

        const lxcTemplates = (lxcResponse?.data || []).filter((vm: any) => vm.template)
        const qemuTemplates = (qemuResponse?.data || []).filter((vm: any) => vm.template)

        return {
            lxc: lxcTemplates,
            qemu: qemuTemplates
        }
    } catch (error) {
        console.error("Failed to get templates:", error)
        return { lxc: [], qemu: [] }
    }
}

export async function setPassword(node: Node, vmid: number, type: "qemu" | "lxc", password: string, username: string = "root") {
    if (type === "lxc") {
        // For LXC, use the set_password endpoint
        const path = `/nodes/${node.proxmoxId}/lxc/${vmid}/config`
        return callProxmoxApi(node, path, "PUT", { password })
    } else {
        // For QEMU, set via cloud-init if available
        const path = `/nodes/${node.proxmoxId}/qemu/${vmid}/config`
        return callProxmoxApi(node, path, "PUT", { cipassword: password, ciuser: username })
    }
}

export async function getLxcConfig(node: Node, vmid: number) {
    const path = `/nodes/${node.proxmoxId}/lxc/${vmid}/config`
    return callProxmoxApi(node, path, "GET")
}

export async function configureBackup(node: Node, vmid: number, schedule: {
    enabled: boolean
    schedule: string
    storage: string
    mode: "snapshot" | "stop"
    retention: number
}) {
    // This would typically be done via vzdump or Proxmox Backup Server
    // For now, we'll store this in the database and implement later via cron/vzdump
    // This is a placeholder that returns success
    return { success: true, message: "Backup configuration stored in database" }
}

// Used for Xterm.js (Serial)
export async function createTermProxy(node: Node, vmid: number, type: "qemu" | "lxc") {
    const res = await callProxmoxApi(node, `/nodes/${node.proxmoxId}/${type}/${vmid}/termproxy`, "POST", {
        serial: "serial0"
    })
    return res as ProxmoxConsoleSession
}

// Authenticated version for specific user (e.g. ephemeral VNC user)
export async function createTermProxyAsUser(node: Node, vmid: number, type: "qemu" | "lxc", authData: { ticket: string, CSRFPreventionToken: string }) {
    const apiPath = `/nodes/${node.proxmoxId}/${type}/${vmid}/termproxy`
    const url = `${node.endpoint}${apiPath}`.replace(/([^:])\/\/+/g, "$1/")

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "CSRFPreventionToken": authData.CSRFPreventionToken,
            "Cookie": `PVEAuthCookie=${authData.ticket}`
        },
        body: new URLSearchParams({ serial: "serial0" }).toString()
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to create TermProxy as user: ${res.statusText} - ${text}`)
    }

    const json = await res.json()
    return json.data as ProxmoxConsoleSession
}

export async function forceReboot(node: Node, vmid: number, type: "qemu" | "lxc") {
    // Force reboot = reset
    return resetVm(node, vmid, type)
}

// ========================================
// VNC Authentication Helpers (Token -> Ticket Bridge)
// ========================================

export async function ensureVncUser(node: Node, vmid: number) {
    const userid = `lumen_vnc_${vmid}@pve`
    const maxRetries = 3

    for (let i = 0; i < maxRetries; i++) {
        const password = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10) + "!"

        try {
            // 1. Delete user if exists
            try {
                await callProxmoxApi(node, `/access/users/${userid}`, "DELETE")
            } catch (e: any) {
                // Ignore "User not found" (404) or similar (500 if locked?)
                // console.log("Delete failed (expected if not exists):", e.message)
            }

            // Small delay to allow propagation or reduce race collision
            await new Promise(r => setTimeout(r, 200 + Math.random() * 300))

            // 2. Create user with new password
            await callProxmoxApi(node, "/access/users", "POST", {
                userid,
                password,
                enable: 1
            })

            return { userid, password } // Success!

        } catch (e: any) {
            console.error(`Attempt ${i + 1} to ensure VNC user failed:`, e.message)
            if (i === maxRetries - 1) throw e // Rethrow on last attempt

            // Wait before retry
            await new Promise(r => setTimeout(r, 500))
        }
    }

    throw new Error("Failed to ensure VNC user after retries")
}

export async function setVncPermissions(node: Node, vmid: number, userid: string) {
    // Grant VM.Console on /vms/{vmid}
    try {
        await callProxmoxApi(node, "/access/acl", "PUT", {
            path: `/vms/${vmid}`,
            roles: "PVEVMUser", // PVEVMUser has permissions for Console
            users: userid
        })
    } catch (e) {
        console.error("Failed to set VNC permissions:", e)
        throw e
    }
}

// Get guest agent network information
export async function getGuestAgentNetworkInfo(node: Node, vmid: number, type: "qemu" | "lxc") {
    try {
        const result = await callProxmoxApi(
            node,
            `/nodes/${node.proxmoxId}/${type}/${vmid}/agent/network-get-interfaces`,
            "GET"
        )

        console.log('[Proxmox] Guest agent response:', JSON.stringify(result, null, 2))

        // Parse the network interfaces and extract IP addresses
        const interfaces = result.result || []
        const ipAddresses: string[] = []

        for (const iface of interfaces) {
            if (iface['ip-addresses']) {
                for (const ip of iface['ip-addresses']) {
                    // Skip link-local and loopback addresses
                    const addr = ip['ip-address']
                    if (addr && !addr.startsWith('127.') && !addr.startsWith('::1') && !addr.startsWith('fe80::')) {
                        ipAddresses.push(addr)
                    }
                }
            }
        }

        console.log('[Proxmox] Extracted IPs:', ipAddresses)
        return ipAddresses
    } catch (error) {
        console.error(`[Proxmox] Failed to get guest agent network info for ${type} ${vmid}:`, error)
        return []
    }
}

export async function getTicket(node: Node, username: string, password: string) {
    // Authentication endpoint
    // Uses standard fetch because callProxmoxApi adds API Token headers which might conflict or are not needed here
    // But we can use the endpoint URL construction from callProxmoxApi manually or just fetch.

    // We need to bypass the API Token header for this generic login
    const url = `${node.endpoint}/access/ticket`.replace(/([^:]\/)\/+/g, "$1")

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({ username, password }).toString()
    })

    if (!res.ok) {
        throw new Error(`Failed to get ticket: ${res.statusText}`)
    }

    const json = await res.json()
    return json.data // { ticket, CSRFPreventionToken, ... }
}

// ========================================
// Iso Custom Management Helpers
// ========================================

export async function createQemuVm(node: Node, vmid: number, name: string, options: {
    cores: number,
    memory: number,
    net0?: string,
    scsi0?: string, // Disk
    ide2?: string, // CDROM
    boot?: string
}) {
    const body: any = {
        vmid,
        name,
        cores: options.cores,
        memory: options.memory,
        net0: options.net0 || "virtio,bridge=vmbr0,firewall=1",
        scsihw: "virtio-scsi-pci",
        ostype: "l26" // Linux 2.6/3.x/4.x/5.x (generic)
    }

    if (options.scsi0) body.scsi0 = options.scsi0
    if (options.ide2) body.ide2 = options.ide2
    if (options.boot) body.boot = options.boot

    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/qemu`, "POST", body)
}

export async function uploadIsoToStorage(node: Node, storage: string, filename: string, file: Blob | File) {
    // Proxmox upload URL: /nodes/{node}/storage/{storage}/upload
    // Requires 'content' (iso), 'filename', and the file.
    // NOTE: This usually requires multipart/form-data.

    const apiPath = `/nodes/${node.proxmoxId}/storage/${storage}/upload`

    // We need to decrypt tokens manually for the custom fetch here to handle FormData if callProxmoxApi doesn't support it well.
    // However, callProxmoxApi assumes x-www-form-urlencoded or JSON.
    // We will implement a custom fetch here.

    const tokenId = decrypt(node.tokenId)
    const tokenSecret = decrypt(node.tokenSecret)

    const url = `${node.endpoint}${apiPath}`.replace(/([^:])\/\/+/g, "$1/")

    // Use native FormData
    const formData = new FormData()
    formData.append("content", "iso")
    formData.append("filename", filename)
    // When using native fetch/FormData in Node, passing the Blob/File directly works best for streaming logic if supported
    // If 'file' comes from NextRequest.formData(), it's likely a native File/Blob implementation.
    formData.append("file", file, filename)

    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `PVEAPIToken=${tokenId}=${tokenSecret}`,
            // Don't set Content-Type, let fetch set boundary
        },
        body: formData
    })

    if (!res.ok) {
        const text = await res.text()
        throw new Error(`Failed to upload ISO: ${res.statusText} - ${text}`)
    }

    // Returns UPID usually
    return await res.json()
}

export async function getStorageContent(node: Node, storage: string) {
    // GET /nodes/{node}/storage/{storage}/content
    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/storage/${storage}/content`, "GET")
}

export async function deleteIsoFromStorage(node: Node, storage: string, volumeId: string) {
    // Volume ID format: storage:iso/filename.iso
    // Path: /nodes/{node}/storage/{storage}/content/{volume}

    // If volumeId doesn't contain storage prefix, we might need to handle it.
    // Usually Proxmox storage "content" list returns "local:iso/my.iso".
    // The API expects the full volume ID.

    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/storage/${storage}/content/${volumeId}`, "DELETE")
}

export async function configQemuDisk(node: Node, vmid: number, config: {
    ide2?: string, // CDROM media
    boot?: string  // Boot order
}) {
    const body: any = {}
    if (config.ide2) body.ide2 = config.ide2
    if (config.boot) body.boot = config.boot

    return callProxmoxApi(node, `/nodes/${node.proxmoxId}/qemu/${vmid}/config`, "POST", body)
}
