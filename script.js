class AnalyserByteData extends Tone.Analyser {

  getValue() {
    this._analysers.forEach((analyser, index) => {
      const buffer = this._buffers[index];
      if (this._type === "fft") {
        analyser.getByteFrequencyData(buffer);
      } else if (this._type === "waveform") {
        analyser.getByteTimeDomainData(buffer);
      }
    });
    if (this.channels === 1) {
      return this._buffers[0];
    } else {
      return this._buffers;
    }
  }

  get size() {
    return this._analysers[0].frequencyBinCount;
  }

  set size(size) {
    this._analysers.forEach((analyser, index) => {
      analyser.fftSize = size * 2;
      this._buffers[index] = new Uint8Array(size);
    });
  }
} //overwrite default
// 'timeout' or 'keyCount'
const KEY_CHANGE_MODE = 'keyCount';
let counter = 0;
let counter1 = 0;
let changeKeyTimeout = null;
let silenceBackgroundTimeout = null;
let isBackgroundPlaying = false;
let counterUpperBoundary = 3;
let currentKey = 'C';
let transposition = 0;
let lastAddedWord = "";
let nose;
let noseHue = 80;
let lastLeftWristX = 0;
let lastRightWristX = 0;
let lastLeftWristY = 0;
let lastRightWristY = 0;
let lastLeftHipX = 0;
let lastRightHipX = 0;
let debounceTimeout = null;
let poseDeteced = false;
let ReverbRoomSize;
const previousNote = {
  baseNote: null,
  octave: null
}

const container = document.querySelector("main");
const poem = document.getElementById("poem");
let poemContent = ["....", "what happens when", "we reverse the role", "and your body becomes", "a musical console?", "...", "throw your hands up", "or hold them close", "let your movements make", "the music that moves you"];
const keyToColorDict = {
  'C': '#FFC0CB',
  'G': '#EB6662',
  'D': '#F7B172',
  'A': '#ffe375',
  'E': '#F7D37E',
  'B': '#82C881',
  'F#': '#81c896',
  'C#': '#1D8F94',
  'G#': '#33a4b5',
  'D#': '#203d85',
  'A#': '#632085',
  'F': '#c42bcc'
}
const keyToPitch = ['C', 'D', 'E', 'G', 'A']
const poseToPitch = {
  '0': 'C',
  '1': 'D',
  '2': 'E',
  '3': 'G',
  '4': 'C',
  '5': 'E',
  '6': 'C',
  '7': 'A',
  '8': 'C',
  '9': 'G',
  '10': 'E',
  '11': 'G',
  '12': 'D',
  '13': 'A',
  '14': 'C',
  '15': 'G',
  '16': 'E',
  '17': 'D',
  '18': 'E',
  '19': 'D',
  '20': 'G',
  '21': 'A',
  '22': 'A',
  '23': 'D',
  '24': 'C',
  '25': 'A'
}

//initialize canvas element
const videoElement = document.getElementById('input_video');
const canvas = document.getElementById('output_canvas');
const canvasCtx = canvas.getContext('2d');

// set canvas to 4:3 aspect ratio
canvas.width = window.innerWidth * 4 / 10;
canvas.height = window.innerWidth * 3 / 10;

//make window resize
window.addEventListener('resize', resizeCanvas)
window.onload = resizeCanvas;
function resizeCanvas() {
  canvas.width = window.innerWidth * 4 / 10;
  canvas.height = window.innerWidth * 3 / 10;
}

//=== MAKE MUSIC ===
Tone.Transport.bpm.value = 120;
const synth = new Tone.PolySynth().toDestination();
synth.set({
  "portamento": 0.0,
  "oscillator": {
    "type": "square4"
  },
  "envelope": {
    "attack": 2,
    "decay": 3,
    "sustain": 0.6,
    "release": 2
  }
})
synth.volume.value = -2

const bgSynth = new Tone.PolySynth();
bgSynth.set({
  "portamento": 0.0,
  "oscillator": {
    "type": "square4"
  },
  "envelope": {
    "attack": 2,
    "decay": 3,
    "sustain": 0.6,
    "release": 5
  }
})
bgSynth.volume.value = -18

// effects and routing

const chorus = new Tone.Chorus(0.3, 1.5, 0.7).start();
const widener = new Tone.StereoWidener(1).toDestination()
const delay = new Tone.PingPongDelay("4n", 0.2)
const reverb = new Tone.Reverb(6.5).toDestination()
const analyser = new AnalyserByteData('fft', 256)

bgSynth.connect(chorus)
chorus.connect(widener)
synth.connect(delay)
delay.connect(reverb)
synth.connect(reverb)
bgSynth.connect(reverb)
bgSynth.connect(delay)
synth.connect(analyser)


//do a user gesture

const landmarkContainer = document.getElementsByClassName('landmark-grid-container')[0];
function onResults(results) {
  if (!results.poseLandmarks) {
    return;
  }
  createCanvas(results);
  mapToTone(results);
}


function createCanvas(results) {
  canvasCtx.save();
  canvasCtx.scale(-1, 1);
  canvasCtx.translate(-canvas.width, 0);

  canvasCtx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
  // canvasCtx.globalCompositeOperation = 'multiply'; 
  canvasCtx.fillStyle = keyToColorDict[currentKey];
  canvasCtx.globalAlpha = 0.5;
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  canvasCtx.globalCompositeOperation = 'source-over';
  canvasCtx.globalAlpha = 1;
  drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
    { color: hsbToHsl(noseHue, 60, 80), lineWidth: 8 });
  // drawLandmarks(canvasCtx, results.poseLandmarks,
  //   { color: '#FF0000', lineWidth: 2 });

  // Draw ellipses for the specific keypoints
  const specificIndices = [0, 15, 16, 23, 24, 25, 26];
  specificIndices.forEach((index) => {
    const landmark = results.poseLandmarks[index];
    const x = landmark.x * canvas.width;
    const y = landmark.y * canvas.height;
    // canvasCtx.font = "18px Arial";
    // canvasCtx.fillStyle = "#0000FF";
    // canvasCtx.fillText(index, x + 5, y - 5);

    canvasCtx.beginPath();
    canvasCtx.ellipse(x, y, 12, 12, 0, 0, 2 * Math.PI);
    canvasCtx.fillStyle = "#FFFF00";
    canvasCtx.fill();
  })
  // mapToTone(nose, leftWrist, rightWrist);
  canvasCtx.restore();

}


function mapToTone(results) {
  nose = results.poseLandmarks[0];
  noseHue = map(nose.x, 0, 1, 0, 360);
  container.style.background = keyToColorDict[currentKey];
  const leftWrist = results.poseLandmarks[15];
  const rightWrist = results.poseLandmarks[16];
  const rightHip = results.poseLandmarks[24];
  const leftHip = results.poseLandmarks[23];
  //it's actually width to 0 because video is flipped

  if ((leftWrist.x - rightWrist.x) * canvas.width < 150) {
    if (Math.abs(lastLeftWristX - leftWrist.x) > 0.08 || Math.abs(lastRightWristX - rightWrist.x) > 0.08) {
      makeMusic();
      setSilenceBackgroundTimeout();
      counter += 0.2;

      if (Math.abs(counter - Math.round(counter)) < 0.2 && Math.floor(counter) < poemContent.length) {
        makeWords();
      }
      lastLeftWristX = leftWrist.x;
      lastRightWristX = rightWrist.x;
    }

  }
  //check wrist height
  if ((leftWrist.y && rightWrist.y) * canvas.height < 150) {
    if (Math.abs(lastLeftWristY - leftWrist.y) > 0.08 || Math.abs(lastRightWristY - rightWrist.y) > 0.08) {
      counter1 += 0.1;
      changeKey();
      // currentKey = (keyToPitch[Math.floor(Math.random()*keyToPitch.length)])
      handleIncrement();
      console.log(counter1);
    }
    lastLeftWristY = leftWrist.y;
    lastRightWristY = rightWrist.y;
  }
  // applyPulseEffect(leftWrist, rightWrist);
}

function applyPulseEffect(leftWrist, rightWrist) {
  const dx = (leftWrist.x - rightWrist.x) * canvas.width;
  const dy = (leftWrist.y - rightWrist.y) * canvas.height;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const hypotenuse = Math.sqrt(canvas.width * canvas.width + canvas.height * canvas.height);
  const vol = map(distance, 10, hypotenuse, -60, 0);
  console.log(Math.floor(Math.abs(distance)), Math.floor(Math.abs(hypotenuse)));
  // Check if the distance is greater than the hypotenuse
  if (distance > hypotenuse - 200) {
    bgSynth.volume.value = vol;
  } else {
    bgSynth.volume.value = -18;
  }
}


function handleIncrement() {
  if (counter1 > counterUpperBoundary) {
    counter1 = 0;
    counterUpperBoundary = getRandom(4, 10)
    changeKey();
  }
}

function makeWords() {
  const currentWord = poemContent[Math.floor(counter)];
  // Check if the current word is different from the last added word
  if (currentWord !== lastAddedWord) {
    const newWord = document.createElement("span");
    newWord.classList.add("fade-in");
    newWord.innerHTML = currentWord + "<br>";

    poem.appendChild(newWord);
    lastAddedWord = currentWord; // Update last added word
  }
}

function makeMusic() {
  console.log(currentKey);
  const octaves = [4, 5]
  let octave = octaves[Math.floor(Math.random() * octaves.length)]
  let baseNote = keyToPitch[Math.floor(Math.random() * keyToPitch.length)];
  if (!baseNote) return
  if (octave === previousNote.octave) {
    const filteredOctaves = octaves.filter(octaveOption => octaveOption !== octave)
    octave = filteredOctaves[Math.floor(Math.random() * filteredOctaves.length)]
  }
  previousNote.octave = octave
  previousNote.baseNote = baseNote
  const note = `${baseNote}${octave}`
  const now = Tone.now()
  if (!isBackgroundPlaying) {
    Tone.Transport.start()
    isPulsingIn = true
    triggerBackgroundChord()
    // currentKey = keyToPitch[Math.floor(Math.random() * keyToPitch.length)];
  }
  const transposedNote = Tone.Frequency(note).transpose(transposition).toNote();
  const splitTransposedNote = transposedNote.split('')
  const accidental = Number.isNaN(Number(splitTransposedNote[1])) ? splitTransposedNote[1] : '';
  const transposedBaseNote = splitTransposedNote[0] + accidental;
  synth.triggerAttackRelease(`${transposedBaseNote}${octave}`, '16n');
}


const triggerBackgroundChord = () => {
  bgSynth.releaseAll()
  const baseNote = `${currentKey}2`
  const baseNoteFrequency = Tone.Frequency(baseNote)
  const notes = [
    baseNote,
    baseNoteFrequency.transpose(7),
    baseNoteFrequency.transpose(12),
    baseNoteFrequency.transpose(16)
  ]
  bgSynth.triggerAttack(notes)
  isBackgroundPlaying = true
}

const setSilenceBackgroundTimeout = () => {
  if (silenceBackgroundTimeout) {
    clearTimeout(silenceBackgroundTimeout)
  }
  silenceBackgroundTimeout = setTimeout(() => {
    bgSynth.releaseAll();
    isBackgroundPlaying = false;
  }, 3000);
}

const changeKey = () => {
  transposition += 7
  const transposedNote = Tone.Frequency(`${currentKey}4`).transpose(7).toNote()
  const splitTransposedNote = transposedNote.split('')
  const accidental = Number.isNaN(Number(splitTransposedNote[1])) ? splitTransposedNote[1] : ''
  const transposedBaseNote = splitTransposedNote[0] + accidental
  currentKey = transposedBaseNote
  triggerBackgroundChord()
}


const setChangeKeyTimeout = () => {
  if (changeKeyTimeout) {
    clearTimeout(changeKeyTimeout)
  }
  changeKeyTimeout = setTimeout(() => {
    changeKey()
  }, 2000)
}

//set up video and initialize poses dataset 
const pose = new Pose({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
  }
});
pose.setOptions({
  modelComplexity: 1,
  smoothLandmarks: true,
  enableSegmentation: false,
  smoothSegmentation: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5
});
pose.onResults(onResults);

const camera = new Camera(videoElement, {
  onFrame: async () => {
    await pose.send({ image: videoElement });
  },
});
const playButton = document.querySelector("button");
playButton.addEventListener("click", () => {
  camera.stop();
});

camera.start();


//helper functions
function map(value, low1, high1, low2, high2) {
  return low2 + (high2 - low2) * (value - low1) / (high1 - low1);
}

function getRandom(min, max) {
  return Math.random() * (max - min) + min;
}

function hsbToHsl(hue, saturation, brightness) {
  // Normalize saturation and brightness from 0-100 to 0-1
  saturation /= 100;
  brightness /= 100;

  let lightness = (2 - saturation) * brightness / 2;
  let newSaturation;

  if (lightness === 0 || lightness === 1) {
    newSaturation = 0;
  } else {
    newSaturation = (brightness - lightness) / Math.min(lightness, 1 - lightness);
  }

  // Convert hue from 0-360 to a percentage for HSL
  hue = Math.round(hue);
  newSaturation = Math.round(newSaturation * 100);
  lightness = Math.round(lightness * 100);

  // Return HSL values
  return `hsl(${hue}, ${newSaturation}%, ${lightness}%)`;
}



// function setDebounceTimeout(results) {
//   if (debounceTimeout) {
//     clearTimeout(debounceTimeout)
//   }
//   debounceTimeout = setTimeout(() => {
//   mapToTone(results)
//   }, 100)
// }