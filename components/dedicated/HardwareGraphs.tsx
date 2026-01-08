"use client";

import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Loader2 } from "lucide-react";
import { useTheme } from "next-themes"; // Assuming standard next-themes usage, or just check generic dark mode

interface MetricsResponse {
    timestamps: string[];
    temperatures: {
        cpu: (number | null)[];
        inlet: (number | null)[];
        exhaust: (number | null)[];
    };
    fans: Record<string, (number | null)[]>;
}

export function HardwareGraphs({ serverId }: { serverId: string }) {
    const [data, setData] = useState<MetricsResponse | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const res = await fetch(`/api/baremetal/servers/${serverId}/metrics`);
            if (res.ok) {
                setData(await res.json());
            }
        } catch (e) {
            console.error("Failed to load metrics", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
        const interval = setInterval(fetchData, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, [serverId]);

    const chartData = useMemo(() => {
        if (!data) return [];
        return data.timestamps.map((t, i) => {
            const point: any = { time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };

            // Temps
            if (data.temperatures.cpu[i] != null) point.cpu = data.temperatures.cpu[i];
            if (data.temperatures.inlet[i] != null) point.inlet = data.temperatures.inlet[i];
            if (data.temperatures.exhaust[i] != null) point.exhaust = data.temperatures.exhaust[i];

            // Fans
            Object.keys(data.fans).forEach(fan => {
                if (data.fans[fan][i] != null) point[fan] = data.fans[fan][i];
            });

            return point;
        });
    }, [data]);

    if (loading && !data) {
        return <div className="p-10 flex justify-center text-muted-foreground"><Loader2 className="animate-spin mr-2" /> Collecting metrics...</div>;
    }

    if (!data || data.timestamps.length === 0) {
        return <div className="p-4 border rounded-lg bg-muted/20 text-center text-muted-foreground">Collecting metrics... (No history yet)</div>;
    }

    const hasFans = Object.keys(data.fans).length > 0;

    return (
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {/* Temperature Graph */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm font-medium">Temperature History (24h)</CardTitle>
                </CardHeader>
                <CardContent className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                            <XAxis
                                dataKey="time"
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                minTickGap={30}
                            />
                            <YAxis
                                stroke="#888888"
                                fontSize={12}
                                tickLine={false}
                                axisLine={false}
                                unit="°C"
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                                itemStyle={{ color: 'var(--foreground)' }}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="cpu" name="CPU" stroke="#10b981" strokeWidth={2} dot={false} connectNulls />
                            <Line type="monotone" dataKey="inlet" name="Inlet" stroke="#3b82f6" strokeWidth={2} dot={false} connectNulls />
                            <Line type="monotone" dataKey="exhaust" name="Exhaust" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Fans Graph */}
            {hasFans && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Fan Speeds (24h)</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                                <XAxis
                                    dataKey="time"
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={30}
                                />
                                <YAxis
                                    stroke="#888888"
                                    fontSize={12}
                                    tickLine={false}
                                    axisLine={false}
                                    unit=" RPM"
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--background)', borderColor: 'var(--border)' }}
                                    itemStyle={{ color: 'var(--foreground)' }}
                                />
                                <Legend />
                                {Object.keys(data.fans).map((fan, idx) => (
                                    <Line
                                        key={fan}
                                        type="monotone"
                                        dataKey={fan}
                                        name={fan}
                                        stroke={`hsl(${idx * 60 + 200}, 70%, 50%)`}
                                        strokeWidth={2}
                                        dot={false}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
