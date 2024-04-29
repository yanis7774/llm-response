// types/xenova-transformers-v3.d.ts
declare module '@xenova/transformers-v3' {
    export interface TokenizerFunction {
      (input: string): { input_ids: number[], attention_mask: number[] };
    }
  
    export class AutoTokenizer {
      static from_pretrained(modelName: string): Promise<TokenizerFunction>;
    }
  
    interface MusicgenConfig {
      dtype: {
        text_encoder: string;
        decoder_model_merged: string;
        encodec_decode: string;
      };
    }
  
    interface GenerateConfig {
      input_ids: number[];
      attention_mask: number[];
      max_new_tokens: number;
      do_sample: boolean;
      guidance_scale: number;
    }
  
    export class MusicgenForConditionalGeneration {
      static from_pretrained(modelName: string, config: MusicgenConfig): Promise<MusicgenForConditionalGeneration>;
      generate(config: GenerateConfig): Promise<{ data: Float32Array }>;
      config: {
        audio_encoder: {
          sampling_rate: number;
        }
      };
    }
  }
  