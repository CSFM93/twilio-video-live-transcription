const webcamFeedContainer = document.getElementById('webcam-feed-container');
const mainFeedElement = document.getElementById('main-feed');
const divLiveTranscript = document.getElementById('live-transcript-container');

const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
const tooltipList = [...tooltipTriggerList]
  .map((tooltipTriggerEl) => new bootstrap.Tooltip(tooltipTriggerEl));

let accessToken;
let room;
let localDataTrack;

async function startRoom() {
  const roomName = 'myRoom';
  const response = await fetch('/join-room', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ roomName }),
  });
  const { token } = await response.json();
  accessToken = token;
  room = await joinVideoRoom(roomName, token);

  handleConnectedParticipant(room.localParticipant);
  room.participants.forEach(handleConnectedParticipant);
  room.on('participantConnected', handleConnectedParticipant);
  room.on('participantDisconnected', handleDisconnectedParticipant);

  window.addEventListener('pagehide', () => room.disconnect());
  window.addEventListener('beforeunload', () => room.disconnect());
}

async function joinVideoRoom(roomName, token) {
  const { LocalDataTrack, createLocalVideoTrack, createLocalAudioTrack } = Twilio.Video;

  let localVideoTrack = await createLocalVideoTrack({ facingMode: 'user' })
  let localAudioTrack = await createLocalAudioTrack()
  localDataTrack = new LocalDataTrack();

  try {
    return await Twilio.Video.connect(token, {
      name: roomName,
      audio: { noiseSuppression: true, echoCancellation: true },
      tracks: [localVideoTrack, localAudioTrack, localDataTrack]
    });
  } catch (error) {
    console.log('error', error);
  }
}

async function handleConnectedParticipant(participant) {
  const participantDiv = document.createElement('div');
  participantDiv.setAttribute('class', 'participantDiv mt-2');
  participantDiv.setAttribute('id', participant.identity);
  webcamFeedContainer.appendChild(participantDiv);

  participant.tracks.forEach((trackPublication) => {
    handleTrackPublication(trackPublication, participant);
  });

  participant.on('trackPublished', (trackPublication) => {
    handleTrackPublication(trackPublication, participant);
  });

  participant.on('trackSubscribed', (track) => {
    handleTrackSubscription(track, participant);
  });
}

function handleTrackPublication(trackPublication, participant) {
  function switchMainFeed(track, usernameDiv) {
    mainFeedElement.innerHTML = '';
    mainFeedElement.append(track.attach());
    mainFeedElement.appendChild(usernameDiv);
  }

  function displayTrack(track) {
    if (track.kind !== 'data') {
      const participantDiv = document.getElementById(participant.identity);
      participantDiv.append(track.attach());

      const usernameDiv = document.createElement('div');
      usernameDiv.setAttribute('class', 'usernameDiv');
      const truncatedIdentity = truncate(participant.identity, 10);
      usernameDiv.innerText = participant.identity === room.localParticipant.identity ? 'You' : `user-${truncatedIdentity}`;
      participantDiv.appendChild(usernameDiv);

      if (track.kind === 'video') {
        switchMainFeed(track, usernameDiv);
        participantDiv.addEventListener('click', () => {
          switchMainFeed(track, usernameDiv);
        });
      }
    }
  }

  if (trackPublication.track) {
    displayTrack(trackPublication.track);
  }

  trackPublication.on('subscribed', () => {
    displayTrack(trackPublication.track);
  });
}

function handleTrackSubscription(track, participant) {
  if (track.kind === 'data') {
    console.log('data track subscription');
    track.on('message', (data) => {
      console.log('transcript received')
      const message = JSON.parse(data);
      showTranscript(message.transcript, participant.identity);
    });
  }
}

function handleDisconnectedParticipant(participant) {
  participant.removeAllListeners();
  const participantDiv = document.getElementById(participant.identity);
  participantDiv.remove();
}

function truncate(str, max) {
  return str.length > max ? `${str.substr(0, max - 1)}…` : str;
}

startRoom();

function showTranscript(transcript, identity) {
  if (transcript !== '') {
    const pElement = document.createElement('p');
    pElement.setAttribute('class', 'transcript-p');
    const username = identity === room.localParticipant.identity ? '[ You ]' : `[ user-${truncate(identity, 10)} ]`;
    pElement.innerText = `${username}: ${transcript}`;

    if (divLiveTranscript.children.length < 2) {
      divLiveTranscript.appendChild(pElement);
    } else {
      divLiveTranscript.removeChild(divLiveTranscript.firstElementChild);
      divLiveTranscript.appendChild(pElement);
    }
  }
}