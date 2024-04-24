# LLM response library

A collection of simplified server tools for using LLMs with additional context (Rag system) or without it.

Capabilities of the tools in this library:

- Generate repsonses for any prompts through OpenAI API key

- Create a model with loaded context file (Ollama, OpenAI or Anthropic)

- Generate voice overs through OpenAI

- Generate images through OpenAI DALLE

- Generate music through Replicate

When setting up models you can specify their name, temperature and voice model for voice generation. You can also turn off voice generation if not needed.

## Install the library

## Via npm

Run the following command:

```ts
npm i llm_response
```

Then add initial setup code in index.ts:

```ts
let mainChain;
setupOpenAIKey(process.env.OPEN_API_KEY); // insert your OpenAI API key here
setTimeout(async ()=>{
    // specify desired model type through modelTypes enum, specify context file and its extension (txt, pdf)
    mainChain = await createRagChain(modelTypes.openAI,{src:"<path_to_the_file>.txt",type:'txt'});
},10);
```

You can use some global variable to store created Rag Chain.

## Using different model types

If you use Anthropic model type for Rag system, before calling setMainChain(), add:

```ts
setupAnthropicKey(process.env.ANTHROPIC_API_KEY); // insert your Anthropic API key here
```

If you don't use OpenAI for Rag system, you can skip setupOpenAIKey(), but basic prompt responses will not work, as well as voice generation.

For using ollama just run ollama model on the same machine (it uses 'Mistral' as default, but you can change it)

Arguments for tuning rag system in function setMainChain():

- model type, use modelTypes enum (Ollama, OpenAI, Anthropic)
- file, consists of src (source file path) and type ('txt' or 'pdf')
- modelName for specification of particular model names
- temperature, set at 0.2 at default
- baseUrl for Ollama, set to "http://localhost:11434" by default

## Getting prompt response without Rag

call await getLLMText() function, it has following arguments:

- systemMessage, system prompt
- prompt, user prompt

it will return string response

## Using Rag

use a created before class instance (through createRagChain() function) and call its getRagAnswer(prompt: string), it will result in answer string

## Rag and using files

When using Rag, you provide a TXT or PDF file as a context. Place desired files locally
and when using createRagChain, put local path to file in src field (check Via npm to
see function format)

## Voice generation

If you want to use voice generation, you need to:

1. Setup OpenAI API key as written at the start of this readme
2. Use Express module to input app into prompt functions

Using app from Express example:
```ts
// app config, aside from all other needed configs
let appReadyPromiseResolve: (arg0: express.Express) => void;
const appReadyPromise = new Promise((resolve) => {
    appReadyPromiseResolve = resolve;
});
config({initializeExpress: (app) => {
    appReadyPromiseResolve(app)}})

// getting the app needed for functions of this module
const app = await appReadyPromise;
```

When ready, call async function getLLMTextAndVoice() or getRagAnswerAndVoice() just like their base functions described in previous sections, but add following arguments:

- app, you need to add app from Express module here
- voiceModel, set to 'alloy' by default

it will return response, where response is generated answer and exposedURL is full path to generated voice. It will look like this:

```ts
{response, exposedURL} = await mainChain.getRagAnswer(promptText)
```

## Image generation

To generate image based on prompt, use

```ts
const imageLocalUrl = await generateAndSaveImage(prompt, app);
```

Prompt is your string prompt to base generation on. App should be provided from Express module, see Voice generation for app example. Result of this function is full url where image is located.

## Music generation

Music generation is not tied to openAi or other llm. Instead setup Replicate API key:

```ts
setupReplicateKey(process.env.REPLICATE_API_TOKEN);
```

And then call

```ts
await generateMusic("your prompt");
```

It will return url to music file online

## Configured AI responses

You can use following openAI methods to use a config object as system message. They work identically to original methods, but use config object instead of systemMessage parameter.

```ts
await getLLmTextConfigured();
await getLLmTextAndVoiceConfigured();
```