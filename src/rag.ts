import {OpenAI} from "@langchain/openai";
import { anthropicKey, exposeVoiceUrl, generateAndSaveVoiceOver, openaiKey } from "./generations";
import { debug_logs, modelTypes } from "./globals";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RetrievalQAChain, loadQAStuffChain } from "langchain/chains";
import { CheerioWebBaseLoader } from "langchain/dist/document_loaders/web/cheerio";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib}  from "@langchain/community/vectorstores/hnswlib";
import { Ollama } from "@langchain/community/llms/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatAnthropic } from "@langchain/anthropic";

// Main class for using Rag, should not be inited directly, use createRagChain() function
export class RagChain {

    private chain: any;
    private loaded: boolean;

    constructor() {}

    // Preload is done automatically if you used the createRagChain() function
    async preLoad(
        modelType: modelTypes,
        file: {src: string, type: string},
        modelName: string = "",
        temperature: number = 0,
        baseUrl: string = "http://localhost:11434"
    ) {
        if (debug_logs) console.log("Preloading Rag Chain Model...");

        // This section will split context file provided for this Rag Chain Model,
        // create vectorstore and use it as retriever to create RetrievalQAChain
        let loader: any;

        switch (file.type) {
            case 'pdf':
                loader = new PDFLoader(file.src);
                break;
            case 'txt':
                loader = new TextLoader(file.src);
                break;
            default:
                loader = new TextLoader(file.src);
                break;
        }

        const docs = await loader.load();
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 512,
            chunkOverlap: 32,
        });
        const splitDocuments = await splitter.splitDocuments(docs);
        const embedings = await this.loadFaceTransformers();
        const vectorstore = await HNSWLib.fromDocuments(
            splitDocuments,
            embedings
        );
        const retriever = vectorstore.asRetriever();

        // This section creates a model depending on specified modelType and parameters
        let model;

        if (modelType == modelTypes.ollama) {
            // For local LLMs
            model = new Ollama({
                baseUrl: baseUrl,
                model: modelName == "" ? "mistral" : modelName,
                temperature: temperature,
            });
        } else if (modelType == modelTypes.openAI) {
            // For OpenAI
            model = new OpenAI({
                openAIApiKey: openaiKey,
                modelName: modelName == "" ? "gpt-3.5-turbo-0613" : modelName,
                temperature: temperature,
            });
        } else {
            // For Anthropic Claude
            model = new ChatAnthropic({
                temperature: temperature,
                modelName: modelName == "" ? "claude-2.1" : modelName,
                anthropicApiKey: anthropicKey,
                maxTokens: 1024,
            });
        }

        // System prompt
        const template = `Use the following pieces of context to answer the question at the end.
            If you don't know the answer, just say that you don't know, don't try to make up an answer.
            Use three sentences maximum and keep the answer as concise as possible. Be precise with numbers. 
            {context}
            Question: {question}
            Helpful Answer:`;

        const QA_CHAIN_PROMPT = new PromptTemplate({
            inputVariables: ["context", "question"],
            template,
        });

        // Create a retrieval QA chain that uses a Llama 2-powered QA stuff chain with a custom prompt.
        this.chain = new RetrievalQAChain({
            combineDocumentsChain: loadQAStuffChain(model, {prompt: QA_CHAIN_PROMPT}),
            retriever,
            returnSourceDocuments: true,
            inputKey: "question",
        });

        this.loaded = true;
        if (debug_logs) console.log("Rag Chain Model preloaded successfully!");
    }

    // Call this function to call prompts. voiceEnabled = true will add voice generation through openAI
    // Provide app from Express module if you use voice generation
    // if voice generation is on, you can specify voiceModel
    async getRagAnswer(question: string, voiceEnabled: boolean = false, app: any = undefined, voiceModel: string = 'alloy') {
        if (this.loaded) {
            if (debug_logs) console.log("Getting Rag Chain Model answer...");
            const response = await this.chain.call({
                question,
            });
            if (debug_logs) console.log("Rag Chain Model answer generated!");

            let exposedUrl = "";
            if (voiceEnabled) {
                // Generate and save the voice-over
                if (debug_logs) console.log("Generating voice for Rag Chain Model answer...");
                const voiceFilePath = await generateAndSaveVoiceOver(response.text, voiceModel);
                if (debug_logs) console.log("Voice generated");

                // Expose the URL for the voice file
                exposedUrl = exposeVoiceUrl(voiceFilePath,app);
            }
            return {response,exposedUrl};
        } else {
            if (debug_logs) console.log("Rag Chain Model wasn't loaded!");
            return undefined;
        }
    }

    async loadFaceTransformers() {
        // this import is used to fix import problem of @langchain/community/embeddings/hf_transformers require statements
        const {HuggingFaceTransformersEmbeddings} = await Function('return import("@langchain/community/embeddings/hf_transformers")')();
        return new HuggingFaceTransformersEmbeddings();
    }

    isLoaded() {
        // use to check if preload() has ended
        return this.loaded;
    }
}

// Function to create Rag Chain Model
// modelType specifiies desired type of model (see corresponding enum)
// file consists of local source to context file and type is a specification of type of file (txt, pdf) in form of string
// modelName is used to specify a model name. Look default names for different model types in the preload() function of RagChain class
// temperature will be set to default of 0.2 if not specified
// baseUrl (currently used for Ollama) defaults in http://localhost:11434
export async function createRagChain(
    modelType: modelTypes,
    file: {src: string, type: string},
    modelName: string = "",
    temperature: number = 0.2,
    baseUrl: string = "http://localhost:11434"
    ) {
        const newRagChain = new RagChain();
        await newRagChain.preLoad(modelType,file,modelName,temperature,baseUrl);
        return newRagChain;
}