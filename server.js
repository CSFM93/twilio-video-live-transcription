const express = require('express');
const { v4: uuidv4 } = require('uuid');
const multer = require('multer');
const twilio = require('twilio');
require('dotenv').config();

const { AccessToken } = twilio.jwt;
const { VideoGrant } = AccessToken;

const app = express();
const port = 3000;

const twilioClient = twilio(
  process.env.TWILIO_API_KEY_SID,
  process.env.TWILIO_API_KEY_SECRET,
  { accountSid: process.env.TWILIO_ACCOUNT_SID },
);

const storage = multer.diskStorage({
  destination: 'uploads/',
  // eslint-disable-next-line func-names
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

const { initialize, transcribe } = require('./whisper');

initialize();

app.use(express.json());
app.use(express.static('public'));

async function findOrCreateRoom(roomName) {
  try {
    await twilioClient.video.rooms(roomName).fetch();
  } catch (error) {
    if (error.code === 20404) {
      await twilioClient.video.rooms.create({
        uniqueName: roomName,
        type: 'group',
      });
    } else {
      throw error;
    }
  }
}

function getAccessToken(roomName) {
  const token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY_SID,
    process.env.TWILIO_API_KEY_SECRET,
    { identity: uuidv4() },
  );

  const videoGrant = new VideoGrant({
    room: roomName,
  });

  token.addGrant(videoGrant);

  return token.toJwt();
}

app.post('/join-room', async (req, res) => {
  if (!req.body || !req.body.roomName) {
    return res.status(400).send('Must include roomName argument.');
  }
  const { roomName } = req.body;
  findOrCreateRoom(roomName);
  const token = getAccessToken(roomName);
  res.send({
    token,
  });
});

app.post('/uploadAudio', upload.single('audio'), async (req, res) => {
  if (req.file === undefined) {
    res.send({
      success: false,
    });
  } else {
    const transcript = await transcribe(req.file.path);
    res.send({
      success: true,
      transcript: transcript === undefined ? '' : transcript.text,
    });
  }
});

app.listen(port, () => {
  console.log(`Express server running on port ${port}`);
});
