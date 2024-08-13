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
const KEY_CHANGE_MODE = 'keyCount'
let changeKeyTimeout = null
let silenceBackgroundTimeout = null
let isBackgroundPlaying = false
let keyPressesUpperBoundary = 20
let keyPresses = 0
let currentKey = 'C'
let transposition = 0
const previousNote = {
  baseNote: null,
  octave: null
}

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

//make window resize
window.addEventListener('resize', resizeCanvas)
window.onload = resizeCanvas;
function resizeCanvas() {
  canvas.width = window.innerWidth * 4 / 10;
  canvas.height = window.innerWidth * 3 / 10;
}

//initialize canvas element
const videoElement = document.getElementById('input_video');
const canvas = document.getElementById('output_canvas');
const canvasCtx = canvas.getContext('2d');

// set canvas to 4:3 aspect ratio
canvas.width = window.innerWidth * 4 / 10;
canvas.height = window.innerWidth * 3 / 10;

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
    "release": 10
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
const playButton = document.querySelector("button");
playButton.addEventListener("click", () => {
  changeKey();
  setChangeKeyTimeout();
  setSilenceBackgroundTimeout();
  console.log("is pressed")
});

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
  canvasCtx.globalCompositeOperation = 'multiply'; // Set the blending mode here
  canvasCtx.fillStyle = keyToColorDict[currentKey];
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);

  canvasCtx.globalCompositeOperation = 'source-over';

  // drawConnectors(canvasCtx, results.poseLandmarks, POSE_CONNECTIONS,
  //   { color: '#00FF00', lineWidth: 4 });
  // drawLandmarks(canvasCtx, results.poseLandmarks,
  //   { color: '#FF0000', lineWidth: 2 });

  // Draw ellipses for the specific keypoints (0, 15, 16)
  const specificIndices = [0, 15, 16];
  specificIndices.forEach(index => {
    const landmark = results.poseLandmarks[index];
    const x = landmark.x * canvas.width;
    const y = landmark.y * canvas.height;
    canvasCtx.font = "18px Arial";
    canvasCtx.fillStyle = "#0000FF";
    canvasCtx.fillText(index, x + 5, y - 5);

    // Draw the ellipse
    canvasCtx.beginPath();
    canvasCtx.ellipse(x, y, 10, 10, 0, 0, 2 * Math.PI); // Adjust the ellipse size as needed
    canvasCtx.fillStyle = "#FFFF00"; // Yellow color for the ellipse
    canvasCtx.fill();
  })
  // mapToTone(nose, leftWrist, rightWrist);
  canvasCtx.restore();

}

function mapToTone(results) {
  const nose = results.poseLandmarks[0];
  const leftWrist = results.poseLandmarks[15];
  const rightWrist = results.poseLandmarks[16];

  // if (KEY_CHANGE_MODE === 'timeout') {
  //   setChangeKeyTimeout()
  // }
  // if (KEY_CHANGE_MODE === 'keyCount') {
  //   handlePose()
  //   setSilenceBackgroundTimeout()
  // }

  // const handlePose = () => {
  //   keyPresses++
  //   if (keyPresses > keyPressesUpperBoundary) {
  //     keyPresses = 0;
  //     keyPressesUpperBoundary = getRandom(8, 30)
  //     changeKey()
  //   }
  // }

  //it's actually width to 0 because video is flipped
  // console.log(leftWrist.x * canvas.width, rightWrist.x * canvas.width, nose.x * canvas.width);
  console.log((leftWrist.x - rightWrist.x) * canvas.width)
  if ((leftWrist.x - rightWrist.x) * canvas.width < 150) {
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
    }
    const transposedNote = Tone.Frequency(note).transpose(transposition).toNote()
    const splitTransposedNote = transposedNote.split('')
    const accidental = Number.isNaN(Number(splitTransposedNote[1])) ? splitTransposedNote[1] : ''
    const transposedBaseNote = splitTransposedNote[0] + accidental
    synth.triggerAttackRelease(`${transposedBaseNote}${octave}`, '16n')

  }
  else {
    setSilenceBackgroundTimeout();
  }
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

const setChangeKeyTimeout = () => {
  if (changeKeyTimeout) {
    clearTimeout(changeKeyTimeout)
  }
  changeKeyTimeout = setTimeout(() => {
    changeKey()
  }, 2000)
}
const setSilenceBackgroundTimeout = () => {
  if (silenceBackgroundTimeout) {
    clearTimeout(silenceBackgroundTimeout)
  }
  silenceBackgroundTimeout = setTimeout(() => {
    bgSynth.releaseAll()
    isBackgroundPlaying = false
  }, 3000)
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
camera.start();


