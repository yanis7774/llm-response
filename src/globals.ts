export const voiceGenerationEnabled = false;

export let debug_logs = true;
export function turnDebugOff() {
    debug_logs = false;
}
export function debugLog(message: any) {
    if (debug_logs) console.log(message);
}

export enum modelTypes {
    ollama,
    openAI,
    anthropic,
    HFE
}