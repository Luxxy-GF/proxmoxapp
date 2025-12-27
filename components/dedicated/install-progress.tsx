"use client";

import { useEffect, useState } from "react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface InstallProgressProps {
    install: any; // Type should be PXEInstall
    onCancel?: () => void;
}

export function InstallProgress({ install, onCancel }: InstallProgressProps) {
    const [progress, setProgress] = useState(install.progress || 0);

    useEffect(() => {
        setProgress(install.progress || 0);
    }, [install.progress]);

    const isRunning = install.state === 'RUNNING' || install.state === 'QUEUED';
    const isDone = install.state === 'DONE';
    const isFailed = install.state === 'FAILED';

    return (
        <Card className="border-blue-500/50 shadow-lg">
            <CardHeader className="pb-2">
                <CardTitle className="flex justify-between items-center text-lg">
                    <span className="flex items-center gap-2">
                        {isRunning && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                        {isDone && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                        {isFailed && <XCircle className="h-4 w-4 text-red-500" />}
                        Installation Status: {install.state}
                    </span>
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">{install.stage || "initializing"}</Badge>
                        {isRunning && onCancel && (
                            <Button variant="ghost" size="sm" onClick={onCancel} className="h-6 text-red-500 hover:text-red-700 hover:bg-red-50">
                                Cancel
                            </Button>
                        )}
                    </div>
                </CardTitle>
                <CardDescription>
                    Started at {new Date(install.startedAt).toLocaleString()}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-1">
                    <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Progress</span>
                        <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>

                <div className="space-y-2">
                    <span className="text-sm font-medium">Log Output:</span>
                    <div className="h-32 rounded-md border bg-black/5 p-4 font-mono text-xs overflow-y-auto">
                        {install.logText || "No logs available..."}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
