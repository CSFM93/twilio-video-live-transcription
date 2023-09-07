const fs = require('fs');
const wavefile = require('wavefile');
let transcriber;

async function initialize() {
  const { pipeline } = await import('@xenova/transformers');
  transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base.en');
}

async function getAudioData(filePath) {

  const file = fs.readFileSync(filePath);
  const buffer = Buffer.from(file);

  // Read .wav file and convert it to required format
  const wav = new wavefile.WaveFile(buffer);
  wav.toBitDepth('32f'); // Pipeline expects input as a Float32Array
  wav.toSampleRate(16000); // Whisper expects audio with a sampling rate of 16000
  let audioData = wav.getSamples();
  if (Array.isArray(audioData)) {
    if (audioData.length > 1) {
      const SCALING_FACTOR = Math.sqrt(2);

      // Merge channels (into first channel to save memory)
      for (let i = 0; i < audioData[0].length; ++i) {
        audioData[0][i] = SCALING_FACTOR * (audioData[0][i] + audioData[1][i]) / 2;
      }
    }

    // Select first channel
    audioData = audioData[0];
  }
  return audioData;
}

function deleteFile(filePath) {
  fs.unlink(filePath, (err => {
    if (err) console.log(err);
  }));
}

async function transcribe(filePath) {
  const audioData = await getAudioData(filePath);
  const transcript = await transcriber(audioData);
  deleteFile(filePath)
  return transcript;
}

async function firstRun() {
  await initialize();
  const transcript = await transcribe('./uploads/audio.wav');
  console.log('transcript', transcript);
}

// firstRun();

module.exports = { initialize, transcribe };