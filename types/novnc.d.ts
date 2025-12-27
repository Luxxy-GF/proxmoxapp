declare module '@novnc/novnc/lib/rfb' {
    export default class RFB {
        constructor(target: HTMLElement, url: string, options?: any);
        disconnect(): void;
        addEventListener(event: string, callback: (e: any) => void): void;
        removeEventListener(event: string, callback: (e: any) => void): void;
    }
}
