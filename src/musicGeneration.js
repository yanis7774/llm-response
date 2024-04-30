// import { AutoTokenizer, MusicgenForConditionalGeneration } from "@xenova/transformers-v3";
// import wavefile from 'wavefile';

// export async function generateMusicOSFirstStep(prompt, app) {

//     // Load tokenizer and model
//     const tokenizer = await AutoTokenizer.from_pretrained('Xenova/musicgen-small');
//     const model = await MusicgenForConditionalGeneration.from_pretrained('Xenova/musicgen-small', {
//         dtype: {
//             text_encoder: 'q8',
//             decoder_model_merged: 'q8',
//             encodec_decode: 'fp32',
//         },
//     });

//     // Prepare text input
//     const inputs = tokenizer(prompt);

//     // Generate audio
//     const audio_values = await model.generate({
//         ...inputs,
//         max_new_tokens: 500,
//         do_sample: true,
//         guidance_scale: 3,
//     });


//     const wav = new wavefile.WaveFile();
//     wav.fromScratch(1, model.config.audio_encoder.sampling_rate, '32f', audio_values.data);

//     const folderPath = './music';
//     const timestamp = new Date().getTime();
//     const filename = `musicOS_${timestamp}.wav`;
//     const fullPath = path.join(folderPath, filename);

//     fs.writeFileSync(fullPath, wav.toBuffer());

//     return fullPath;

// }