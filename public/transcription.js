import { MediaRecorder, register } from 'https://cdn.skypack.dev/extendable-media-recorder';
import { connect } from 'https://cdn.skypack.dev/extendable-media-recorder-wav-encoder';

let isMuted = false;
let isTranscribing = false;
let mediaRecorder;

const btnMuteUnmute = document.getElementById('btnMuteUnmute');
const btnTranscribe = document.getElementById('btnTranscribe');
const btnHangup = document.getElementById('btnHangup');


async function initializeWaveEncoder() {
  await register(await connect());
}
initializeWaveEncoder();

function handleMuteUnmute() {
  if (room === undefined) {
    return;
  }

  const iElement = btnMuteUnmute.getElementsByTagName('i')[0];
  const tooltipInstance = bootstrap.Tooltip.getInstance(btnMuteUnmute);
  if (!isMuted) {
    isMuted = true;
    iElement.classList.replace('bi-mic-mute-fill', 'bi-mic-fill');
    btnMuteUnmute.classList.replace('btn-danger', 'btn-success');
    tooltipInstance.setContent({ '.tooltip-inner': 'Unmute' });
  } else {
    isMuted = false;
    iElement.classList.replace('bi-mic-fill', 'bi-mic-mute-fill');
    btnMuteUnmute.classList.replace('btn-success', 'btn-danger');
    tooltipInstance.setContent({ '.tooltip-inner': 'Mute' });
  }

  room.localParticipant.audioTracks.forEach((trackPublication) => {
    if (isMuted) {
      trackPublication.track.disable();
    } else {
      trackPublication.track.enable();
    }
  });
}

async function transcribe() {
  if (room === undefined) {
    return;
  }

  const tooltipInstance = bootstrap.Tooltip.getInstance(btnTranscribe);
  if (!isTranscribing) {
    isTranscribing = true;
    btnTranscribe.classList.replace('btn-success', 'btn-danger');
    tooltipInstance.setContent({ '.tooltip-inner': 'Disable live captions' });

    const participantDiv = document.getElementById(room.localParticipant.identity);
    const audioElement = participantDiv.getElementsByTagName('audio')[0];
    const audioStream = audioElement.srcObject;
    mediaRecorder = new MediaRecorder(audioStream, { mimeType: 'audio/wav' });
    recordAudio();
  } else {
    isTranscribing = false;
    btnTranscribe.classList.replace('btn-danger', 'btn-success');
    tooltipInstance.setContent({ '.tooltip-inner': 'Enable live caption' });
    mediaRecorder.stop();
  }
}

function recordAudio() {
  let chunks = [];
  mediaRecorder.start();

  const interval = setInterval(() => {
    mediaRecorder.stop();
  }, 6000);

  mediaRecorder.onstart = () => {
    console.log('recorder started');
  };

  mediaRecorder.ondataavailable = (e) => {
    if (!isMuted) {
      chunks.push(e.data);
    }
  };

  mediaRecorder.onstop = async (e) => {
    console.log('recorder stopped');
    const blob = new Blob(chunks, { type: 'audio/wav' });
    uploadAudio(blob);

    chunks = [];
    if (isTranscribing) {
      mediaRecorder.start();
    } else {
      clearInterval(interval);
    }
  };
}

function uploadAudio(blob) {
  const dlUrl = URL.createObjectURL(blob).split('/');
  const filename = `${dlUrl[3]}.wav`;
  const file = new File([blob], filename);

  const formData = new FormData();
  formData.append('audio', file);

  fetch('/uploadAudio', {
    method: 'POST',
    body: formData,
  })
    .then(async (response) => {
      const res = await response.json();
      if (res.success) {
        showTranscript(res.transcript, room.localParticipant.identity);
        sendTranscript(res.transcript);
      }
      console.log(res);
    })
    .catch((err) => {
      console.log('err', err);
    });
};

function sendTranscript(transcript) {
  console.log('sending transcript')
  localDataTrack.send(JSON.stringify({
    transcript: transcript,
  }));
}

function hangUp() {
  if (room !== undefined) {
    room.disconnect();
    window.location.replace('https://www.twilio.com/en-us/video');
  }
};

btnMuteUnmute.addEventListener('click', handleMuteUnmute);
btnTranscribe.addEventListener('click', transcribe);
btnHangup.addEventListener('click', hangUp);

