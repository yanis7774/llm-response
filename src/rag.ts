import {OpenAI} from "@langchain/openai";
import { aiConfig, exposeLocalUrl, generateAndSaveVoiceOver } from "./generations";
import { debugLog, modelTypes } from "./globals";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { RetrievalQAChain, loadQAStuffChain } from "langchain/chains";
import { CheerioWebBaseLoader } from "langchain/dist/document_loaders/web/cheerio";
import { PDFLoader } from "langchain/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { HNSWLib}  from "@langchain/community/vectorstores/hnswlib";
import { Ollama } from "@langchain/community/llms/ollama";
import { PromptTemplate } from "@langchain/core/prompts";
import { ChatAnthropic } from "@langchain/anthropic";
import {HuggingFaceInference} from "@langchain/community/llms/hf";

// Main class for using Rag, should not be inited directly, use createRagChain() function
export class RagChain {

    private chain: any;
    private loaded: boolean = false;

    constructor() {}

    // Preload is done automatically if you used the createRagChain() function
    async preLoad(
        modelType: modelTypes,
        file: {src: string, type: string},
        modelName: string = "",
        temperature: number = 0.2,
        baseUrl: string = "http://localhost:11434"
    ) {
        debugLog("Preloading Rag Chain Model...");

        // This section will split context file provided for this Rag Chain Model,
        // create vectorstore and use it as retriever to create RetrievalQAChain
        let loader = file.type === 'pdf' ? new PDFLoader(file.src) : new TextLoader(file.src);

        const docs = await loader.load();
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 512, chunkOverlap: 32 });
        const splitDocuments = await splitter.splitDocuments(docs);
        const embedings = await this.loadFaceTransformers();
        const vectorstore = await HNSWLib.fromDocuments(splitDocuments, embedings);
        const retriever = vectorstore.asRetriever();

        // This section creates a model depending on specified modelType and parameters
        const model = this.createModel(modelType, modelName, temperature, baseUrl);

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
        debugLog("Rag Chain Model preloaded successfully!");
    }

    // Call this function to call prompts without voice generation
    async getRagAnswer(question: string) {
        if (!this.loaded) {
            debugLog("Rag Chain Model wasn't loaded!");
            return undefined;
        }

        debugLog("Getting Rag Chain Model answer...");
        const response = await this.chain.call({
            question,
        });
        debugLog("Rag Chain Model answer generated!");

        return response.text;
    }

    // Call this function to call prompts. Provide app from Express module if you use voice generation
    // You can specify voiceModel. If not specified, 'alloy' is chosen by default
    async getRagAnswerAndVoice(question: string, app: any = undefined, voiceModel: string = 'alloy') {
        if (!this.loaded) {
            debugLog("Rag Chain Model wasn't loaded!");
            return undefined;
        }

        debugLog("Getting Rag Chain Model answer...");
        const responseResult = await this.chain.call({
            question,
        });
        const response = responseResult.text;
        debugLog("Rag Chain Model answer generated!");

        // Generate and save the voice-over
        debugLog("Generating voice for Rag Chain Model answer...");
        const voiceFilePath = await generateAndSaveVoiceOver(response.text, voiceModel);
        debugLog("Voice generated");

        // Expose the URL for the voice file
        const exposedUrl = exposeLocalUrl('voices',voiceFilePath,app);
        return {response,exposedUrl};
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

    private createModel(modelType: modelTypes, modelName: string, temperature: number, baseUrl: string) {
        const defaultModelName = modelName || (modelType === modelTypes.openAI ? "gpt-3.5-turbo-0613" : (modelType === modelTypes.ollama ? "mistral" : "claude-2.1"));
        switch (modelType) {
            case modelTypes.ollama:
                return new Ollama({ baseUrl: baseUrl, model: defaultModelName, temperature: temperature });
            case modelTypes.openAI:
                return new OpenAI({ openAIApiKey: aiConfig.openaiKey, modelName: defaultModelName, temperature: temperature });
            case modelTypes.anthropic:
                return new ChatAnthropic({ temperature: temperature, modelName: defaultModelName, anthropicApiKey: aiConfig.anthropicKey, maxTokens: 1024 });
            case modelTypes.HFE:
                return new HuggingFaceInference({
                    model: modelName,
                    apiKey:  aiConfig.hfKey, // In Node.js defaults to process.env.HUGGINGFACEHUB_API_KEY
                    endpointUrl: baseUrl,
                    temperature: 0.7,
                    //     verbose: true,
                    //     numCtx: 8192,
                });
            default:
                throw new Error(`Unsupported model type: ${modelType}`);
        }
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