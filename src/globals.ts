export const voiceGenerationEnabled = false;
export let debug_logs = true;
export function turnDebugOff() {
    debug_logs = false;
}

export enum modelTypes {
    ollama,
    openAI,
    anthropic
}