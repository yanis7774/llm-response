import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { Audio } from "openai/resources";
import SpeechCreateParams = Audio.SpeechCreateParams;
import Replicate from 'replicate';
import { debugLog } from "./globals";
import { Ollama } from "@langchain/community/llms/ollama";

export const aiConfig: any = {ollama: undefined, openai: undefined, replicate: undefined, openaiKey: "", anthropicKey: "", hfKey: "", replicateKey: ""}

// setup API keys functions
// for OpenAI (mandatory if using voice generation, basic prompts with no rag or OpenAI model is used in Rag Chain)
export async function setupOpenAIKey(key: string) {
    aiConfig.openaiKey = key;
    aiConfig.openai = new OpenAI({ apiKey: aiConfig.openaiKey });
    debugLog("OpenAI API key is set...");
}

// for Anthropic (mandatory if using Anthropic model)
export async function setupAnthropicKey(key: string) {
    aiConfig.anthropicKey = key;
    debugLog("Anthropic API key is set...");
}

// To setup Ollama, all arguments have defaults
export async function setupOllama(modelName: string = "mistral", temperature: number = 0.2, baseUrl: string = "http://localhost:11434") {
    aiConfig.ollama = new Ollama({ baseUrl: baseUrl, model: modelName, temperature: temperature });
}

// To setup Replicate, only API key is needed
export async function setupReplicateKey(key: string) {
    aiConfig.replicateKey = key
    aiConfig.replicate = new Replicate({ auth: key });
    debugLog("Replicate API key is set...");
}

// generic prompt generation, no context needed, but OpenAI API key is required
export async function getLLMText(systemMessage: string, prompt: string) {
    try {
        // Get the response from OpenAI
        debugLog("Getting openai answer...");
        const response = await getOpenAIAnswer(systemMessage, prompt);
        debugLog("Got openai answer!");

        return response;
    } catch (error) {
        console.error(`Error in getText: ${error}`);
        throw error;
    }
}

// generic prompt generation through Ollama
export async function getOllamaText(prompt: string) {
    try {
        // Get the response from OpenAI
        debugLog("Getting ollama answer...");
        const response = await aiConfig.ollama.invoke(prompt);
        debugLog("Got ollama answer!");

        return response;
    } catch (error) {
        console.error(`Error in getText: ${error}`);
        throw error;
    }
}

// generic prompt generation through, no context needed, but OpenAI API key is required. Also generates voice
// app needs to be provided from Express module. voiceModel can be set, default is 'alloy'
export async function getOllamaTextAndVoice(prompt: string, app: any = undefined, voiceModel = 'alloy') {
    try {
        // Get the response from OpenAI
        debugLog("Getting ollama answer...");
        const response = await aiConfig.ollama.invoke(prompt);
        debugLog("Got ollama answer!");

        // Generate and save the voice-over
        debugLog("Generating voice...");
        const voiceFilePath = await generateAndSaveVoiceOver(response, voiceModel);
        debugLog("Voice generated successfully!");

        // Expose the URL for the voice file
        const exposedUrl = exposeLocalUrl('voices', voiceFilePath, app);
        debugLog("Voice path received!");

        return { response, exposedUrl };
    } catch (error) {
        console.error(`Error in getText: ${error}`);
        throw error;
    }
}

// generic prompt generation, no context needed, but OpenAI API key is required. Also generates voice
// app needs to be provided from Express module. voiceModel can be set, default is 'alloy'
export async function getLLMTextAndVoice(systemMessage: string, prompt: string, app: any = undefined, voiceModel = 'alloy') {
    try {
        // Get the response from OpenAI
        debugLog("Getting openai answer...");
        const response = await getOpenAIAnswer(systemMessage, prompt);
        debugLog("Got openai answer!");

        // Generate and save the voice-over
        debugLog("Generating voice...");
        const voiceFilePath = await generateAndSaveVoiceOver(response, voiceModel);
        debugLog("Voice generated successfully!");

        // Expose the URL for the voice file
        const exposedUrl = exposeLocalUrl('voices', voiceFilePath, app);
        debugLog("Voice path received!");

        return { response, exposedUrl };
    } catch (error) {
        console.error(`Error in getTextAndVoice: ${error}`);
        throw error;
    }
}

export async function getOpenAIAnswer(systemMessage: string, prompt: string) {
    try {
        if (aiConfig.openai != undefined) {
            const completion = await aiConfig.openai.chat.completions.create({
                messages: [{ "role": "system", "content": systemMessage }, { "role": "user", "content": prompt }],
                model: "gpt-3.5-turbo",
            });

            return completion.choices[0].message.content
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
        const mp3 = await aiConfig.openai.audio.speech.create(<SpeechCreateParams>{
            model: "tts-1",
            voice: voiceModel,
            input: text,
            speed: 1.2
        });

        // Getting path
        const folderPath = './voices';
        const timestamp = new Date().getTime();
        const filename = `voice_${timestamp}.mp3`;
        const fullPath = path.join(folderPath, filename);

        // Saving voice
        fs.promises.mkdir(folderPath, { recursive: true })
        .then(async () => fs.promises.writeFile(fullPath, Buffer.from(await mp3.arrayBuffer())))
        .catch(console.error);

        return fullPath;
    } catch (error) {
        console.error(`Error in generateAndSaveVoiceOver: ${error}`);
        throw new Error(`Error generating and saving voice over: ${error}`);
    }
}

export function exposeLocalUrl(baseFolder: string, voicePath: string, app: any) {
    // Getting voice source
    if (!app) return ``;

    const urlPath = `/${baseFolder}/${path.basename(voicePath)}`;
    app.get(urlPath, (req: any, res: any) => {
        const absolutePath = path.resolve(voicePath);
        res.sendFile(absolutePath, (err: any) => {
            if (err) {
                console.error(`Error serving ${absolutePath}:`, err);
                res.status(500).send("Error serving file");
            }
        });
    });

    return urlPath;
}

export async function generateAndSaveImage(prompt: string, app: any) {
    debugLog("Generating image...");
    const response = await generateImageWithDALLE(prompt);
    debugLog("Image generated successfully!");
    debugLog("Saving image...")
    const file = await saveImageToFile(response);
    debugLog("Image saved successfully!")
    return exposeLocalUrl('images', file, app);
}

async function generateImageWithDALLE(prompt: string) {
    try {
        const response = await aiConfig.openai.images.generate({
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            response_format: "b64_json"
        });
        return response.data[0].b64_json;
    } catch (error) {
        console.error(`Error in generateImageWithDALLE: ${error}`);
        throw new Error(`Error generating image: ${error}`);
    }
}

async function saveImageToFile(base64Data: WithImplicitCoercion<string> | {
    [Symbol.toPrimitive](hint: "string"): string;
}) {
    try {
        // Getting path
        const folderPath = './images';
        const timestamp = new Date().getTime();
        const filename = `image_${timestamp}.png`;
        const fullPath = path.join(folderPath, filename);

        // Saving image
        fs.promises.mkdir(folderPath, { recursive: true })
        .then(async () => fs.promises.writeFile(fullPath, Buffer.from(base64Data, 'base64')))
        .catch(console.error);

        return fullPath;

    } catch (error) {
        console.error('Error saving the image:', error);
        return '';
    }
}

export async function generateMusic(prompt: string) {

    if (aiConfig.replicate != undefined) {
        debugLog("Generating music...");
        const input = {
            prompt: prompt,
            model_version: "large",
            output_format: "mp3",
            normalization_strategy: "peak"
        };
        const output = await aiConfig.replicate.run("meta/musicgen:671ac645ce5e552cc63a54a2bbff63fcf798043055d2dac5fc9e36a837eedcfb", {input});
        debugLog("Music generated!");
        return output;
    } else {
        debugLog("Replicate API key is not set");
        return "";
    }

}