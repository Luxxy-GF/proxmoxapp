"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Monitor, ExternalLink, X } from "lucide-react";

interface ConsolePaneProps {
    serverId: string;
    serverHostname: string;
}

interface ConsoleSession {
    sessionId: string;
    token: string;
    consoleUrl: string;
    expiresAt: string;
    status: string;
}

export function ConsolePane({ serverId, serverHostname }: ConsolePaneProps) {
    const [loading, setLoading] = useState(false);
    const [session, setSession] = useState<ConsoleSession | null>(null);
    const [showIframe, setShowIframe] = useState(false);

    const openConsole = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/baremetal/console/session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serverId,
                    consoleType: 'java'
                })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Failed to start console session');
            }

            const data = await res.json();
            setSession(data);
            setShowIframe(true);
            toast.success('Console session started');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    const closeConsole = async () => {
        if (session) {
            try {
                await fetch(`/api/baremetal/console/session/${session.sessionId}`, {
                    method: 'DELETE'
                });
            } catch (e) {
                console.error('Failed to close session:', e);
            }
        }
        setSession(null);
        setShowIframe(false);
    };

    const openInNewTab = () => {
        if (session) {
            window.open(session.consoleUrl, '_blank');
        }
    };

    return (
        <div className="space-y-4">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Monitor className="h-5 w-5" />
                        Remote Console
                    </CardTitle>
                    <CardDescription>
                        Access the server's IPMI/BMC web console directly from your browser via noVNC.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {!session ? (
                        <div className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Opening the console will start a secure session to the server's BMC interface.
                                The session will automatically close after 4 hours of inactivity.
                            </p>
                            <Button onClick={openConsole} disabled={loading} size="lg">
                                {loading ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Starting Console...
                                    </>
                                ) : (
                                    <>
                                        <Monitor className="mr-2 h-4 w-4" />
                                        Open Console
                                    </>
                                )}
                            </Button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <Badge variant="default">Session Active</Badge>
                                <span className="text-sm text-muted-foreground">
                                    Expires: {new Date(session.expiresAt).toLocaleTimeString()}
                                </span>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={openInNewTab}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Open in New Tab
                                </Button>
                                <Button variant="destructive" onClick={closeConsole}>
                                    <X className="mr-2 h-4 w-4" />
                                    Close Session
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {showIframe && session && (
                <Card>
                    <CardHeader className="py-2 px-4 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Monitor className="h-4 w-4" />
                            <span className="font-medium">{serverHostname} Console</span>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setShowIframe(false)}>
                            Minimize
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        <iframe
                            src={session.consoleUrl}
                            className="w-full h-[600px] border-0 rounded-b-lg bg-black"
                            title={`Console - ${serverHostname}`}
                            allow="clipboard-read; clipboard-write"
                        />
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Console Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-2">
                        <span className="text-muted-foreground">Console Type:</span>
                        <span>Java JNLP Console</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <span className="text-muted-foreground">Connection:</span>
                        <span>Proxied through Agent (noVNC)</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <span className="text-muted-foreground">Session Timeout:</span>
                        <span>4 hours</span>
                    </div>
                    <p className="text-muted-foreground mt-4">
                        <strong>Note:</strong> The console connects to the BMC/IPMI interface, not the operating system.
                        You can use this to access BIOS, boot menus, and perform OS installations.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}
