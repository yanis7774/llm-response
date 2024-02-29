import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { Audio } from "openai/resources";
import SpeechCreateParams = Audio.SpeechCreateParams;
import { debug_logs } from "./globals";

let openai: any;
export let openaiKey = "";
export let anthropicKey = "";

// setup API keys functions
// for OpenAI (mandatory if using voice generation, basic prompts with no rag or OpenAI model is used in Rag Chain)
export async function setupOpenAIKey(key: string) {
    openaiKey = key;
    openai = new OpenAI({ apiKey: openaiKey });
    if (debug_logs) console.log("OpenAI API key is set...");
}

// for Anthropic (mandatory if using Anthropic model)
export async function setupAnthropicKey(key: string) {
    anthropicKey = key;
    if (debug_logs) console.log("Anthropic API key is set...");
}

// generic prompt generation, no context needed, but OpenAI API key is required
export async function getLLMTextAndVoice(systemMessage: string, prompt: string, voiceEnabled: boolean = false, app: any = undefined, voiceModel = 'alloy') {
    try {
        // Get the response from OpenAI
        if (debug_logs) console.log("Getting openai answer...");
        const response = await getOpenAIAnswer(systemMessage, prompt);
        if (debug_logs) console.log("Got openai answer!");

        let exposedUrl = "";
        if (voiceEnabled) {
            // Generate and save the voice-over
            if (debug_logs) console.log("Generating voice...");
            const voiceFilePath = await generateAndSaveVoiceOver(response, voiceModel);
            if (debug_logs) console.log("Voice generated successfully!");

            // Expose the URL for the voice file
            exposedUrl = exposeVoiceUrl(voiceFilePath, app);
            if (debug_logs) console.log("Voice path received!");
        }

        return { response, exposedUrl };
    } catch (error) {
        console.error(`Error in getTextAndVoice: ${error}`);
        throw error;
    }
}

export async function getOpenAIAnswer(systemMessage: string, prompt: string) {
    try {
        if (openai != undefined) {
            const completion = await openai.chat.completions.create({
                messages: [{ "role": "system", "content": systemMessage }, { "role": "user", "content": prompt }],
                model: "gpt-3.5-turbo",
            });

            const answer = completion.choices[0].message.content
            //console.log(`OpenAI response: ${answer}`)

            return answer
        } else {
            return "OPEN AI API KEY WAS NOT SET OR IS SET WRONG";
        }
    } catch (error) {
        console.error(`Error in getOpenAIAnswer: ${error}`);
        throw new Error(`Error fetching answer from OpenAI API: ${error}`);
    }
}

export async function generateAndSaveVoiceOver(text: string, voiceModel = 'alloy') {
    try {
        // Creating the voiceover
        const mp3 = await openai.audio.speech.create(<SpeechCreateParams>{
            model: "tts-1",
            voice: voiceModel,
            input: text,
            speed: 1.2
        });

        // Getting path and saving voice
        const folderPath = './voices';
        const timestamp = new Date().getTime();
        const filename = `voice_${timestamp}.mp3`;

        if (!fs.existsSync(folderPath)) {
            fs.mkdirSync(folderPath);
        }

        const fullPath = path.join(folderPath, filename);
        const buffer = Buffer.from(await mp3.arrayBuffer());
        await fs.promises.writeFile(fullPath, buffer);

        return fullPath;
    } catch (error) {
        console.error(`Error in generateAndSaveVoiceOver: ${error}`);
        throw new Error(`Error generating and saving voice over: ${error}`);
    }
}

export function exposeVoiceUrl(voicePath: string, app: any) {
    // Getting voice source
    if (app == undefined)
        return ``;

    const urlPath = `/voices/${path.basename(voicePath)}`;

    // @ts-ignore
    app.get(urlPath, (req: any, res: { sendFile: (arg0: string, arg1: (err: any) => void) => void; status: (arg0: number) => { (): any; new(): any; send: { (arg0: string): void; new(): any; }; }; }) => {
        const absolutePath = path.resolve(voicePath);
        res.sendFile(absolutePath, (err) => {
            if (err) {
                console.error(`Error serving ${absolutePath}:`, err);
                res.status(500).send("Error serving voice file");
            }
        });
    });

    return `${urlPath}`;
}