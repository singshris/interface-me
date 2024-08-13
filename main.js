// overwrite getValue from tone analyser
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
}


// tone js
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

