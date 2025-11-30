# Utterance Emitter

![CI](https://github.com/tinkermonkey/utterance_emitter/actions/workflows/ci.yml/badge.svg)
[![Known Vulnerabilities](https://snyk.io/test/github/tinkermonkey/utterance_emitter/badge.svg)](https://snyk.io/test/github/tinkermonkey/utterance_emitter)
[![npm version](https://badge.fury.io/js/@tinkermonkey%2Futterance-emitter.svg)](https://badge.fury.io/js/@tinkermonkey%2Futterance-emitter)

Utterance Emitter is a library for recording audio in the browser, performing speaker detection, and emitting chunks of mp3 encoded audio representing utterances for further processing.

This has been kept deliberately simple with minimal dependencies, if you're looking for extensibility that doesn't exist in order to enable more elaborate use cases, put up an MR.

## Installation

```sh
npm install utterance-emitter
```

## Usage
First, import the UtteranceEmitter class and create an instance. Then, start recording audio and handle the emitted audio chunks.

```javascript
import { UtteranceEmitter } from 'utterance-emitter';

const emitter = new UtteranceEmitter({
  emitRawAudio: true,
  emitMP3Audio: true,
  onUtterance: (utterance) => {
    if (utterance.mp3) {
      const url = URL.createObjectURL(utterance.mp3);
      const audio = new Audio(url);
      audio.controls = true;
      document.body.appendChild(audio);
    }

    if (utterance.raw) {
      const url = URL.createObjectURL(utterance.raw);
      const audio = new Audio(url);
      audio.controls = true;
      document.body.appendChild(audio);
    }
  },
});

document.getElementById('startButton').addEventListener('click', () => emitter.start());
document.getElementById('stopButton').addEventListener('click', () => emitter.stop());
```

## Algorithm for Speaker Detection

The *UtteranceEmitter* library supports two methods for detecting when someone is speaking:

### 1. Voice Activity Detection (VAD) - Recommended
This method uses the `@ricky0123/vad-web` library (Silero VAD) to detect human speech using machine learning. This is significantly more accurate than simple volume analysis, especially in noisy environments or with non-speech background noise (typing, HVAC, etc.).

To use this method, ensure you have the necessary VAD worklet files available (see `vadWorkletPath` in configuration).

### 2. Amplitude-Based Detection (Fallback)
This is an unsophisticated but lightweight algorithm that works reasonably well in quiet environments:

1. **Volume Analysis**: The audio stream is analyzed in real-time to calculate the average volume level.
2. **Threshold Comparison**: The average volume level is compared against a predefined volume threshold.
3. **Filtered Signal**: A filtered signal is generated based on the threshold comparison.

The library is designed to attempt VAD initialization first and gracefully fall back to amplitude-based detection if VAD fails to load or is disabled.

### Detection Process (Common Steps)

Regardless of the detection method:

1. **Signal Filtering**: If the signal (VAD probability or Volume) is above the threshold, it is considered speaking. If it drops below for a short duration (quiet period), it is still considered speaking to bridge pauses.
2. **Recording Control**: The media recorder starts recording when the filtered signal indicates speaking and stops when it indicates silence.
3. **Utterance Emission**: Once recording stops, the audio is processed and emitted as an utterance.

## Optional Charts

*UtteranceEmitter* can also visualize the audio data using optional charts. These charts can help in understanding the audio signal and the detection process. These charts are kept deliberately simple and free of dependencies.

The following charts are available, they can be individually enabled:

1. **Waveform Chart**: Displays the time-domain representation of the audio signal.
2. **Frequency Chart**: Displays the frequency-domain representation of the audio signal.
3. **Volume Chart**: Displays the average volume level of the audio signal.
4. **Threshold Signal Chart**: Displays the threshold signal used for detecting speech.
5. **Speaking Signal Chart**: Displays the filtered signal indicating when someone is speaking.

To enable these charts, pass the corresponding HTML canvas elements in the `charts` configuration option:

```javascript
const emitter = new UtteranceEmitter({
  emitRawAudio: true,
  emitMP3Audio: true,
  charts: {
    width: 400,
    height: 100,
    barMargin: 1,
    barWidthNominal: 2.5,
    waveform: document.getElementById("waveform"),
    frequency: document.getElementById("frequency"),
    volume: document.getElementById("volume"),
    threshold: document.getElementById("threshold"),
    speaking: document.getElementById("speaking"),
  },
  onUtterance: (utterance) => {
    // Handle the utterance
  },
});
```

Ensure that the canvas elements are present in your HTML (obviously you can use any selector you like, you're passing in the element reference):

```html
<canvas id="waveform"></canvas>
<canvas id="frequency"></canvas>
<canvas id="volume"></canvas>
<canvas id="threshold"></canvas>
<canvas id="speaking"></canvas>
```

## EmitterConfig Options

The `EmitterConfig` interface provides several options to customize the behavior of the `UtteranceEmitter`:

- **onUtterance**: A callback function that is called when an utterance is detected. The callback function receives an `Utterance` object as the argument. This is triggered at the same time that an `Utterance` event is fired, there's no difference so use the one you like.
- **volumeThreshold**: The volume threshold at which to start recording. Default is `7`.
- **preRecordingDuration**: The number of milliseconds to keep in a buffer before the volume threshold is reached. Default is `100`.
- **emitRawAudio**: Whether to emit raw audio data. Default is `false`.
- **emitMP3Audio**: Whether to emit MP3 audio data. Default is `true`.
- **emitText**: Whether to emit text data. Default is `false`.
- **sampleRate**: The sample rate to use for audio recording. Default is `44100`.
- **mp3BitRate**: The bit rate in kbps to use for MP3 encoding. Default is `128`.
- **vadWorkletPath**: Optional path to the VAD worklet script. If not provided, the library attempts to load it from default locations.
- **enablePerformanceMonitoring**: Whether to enable internal performance monitoring (frame timing, etc.). Default is `false`.
- **charts**: An optional object to configure the charts. The object can have the following properties:
  - **width**: The width of the charts. Default is `400`.
  - **height**: The height of the charts. Default is `100`.
  - **barMargin**: The margin between bars in the charts. Default is `1`.
  - **barWidthNominal**: The nominal width of the bars in the charts. Default is `2.5`.
  - **waveform**: An HTML canvas element to display the waveform chart.
  - **frequency**: An HTML canvas element to display the frequency chart.
  - **volume**: An HTML canvas element to display the volume chart.
  - **threshold**: An HTML canvas element to display the threshold signal chart.
  - **speaking**: An HTML canvas element to display the speaking signal chart.
  - **foregroundColor**: Color for the chart elements.
  - **backgroundColor**: Background color for the charts.

## Events

The UtteranceEmitter emits the following events:

### speaking

Emitted when the speaking state changes (both when starting and stopping speaking). Subscribe to this event to be notified in real-time when speaking is detected.

```javascript
emitter.on('speaking', (event) => {
  // event.speaking: boolean - true when speaking starts, false when it stops
  // event.timestamp: number - milliseconds since epoch when the event occurred
  console.log(`Speaking changed to: ${event.speaking} at ${event.timestamp}`);
});
```

### utterance

Emitted when a complete utterance has been detected and processed. This occurs after speaking stops and the audio has been processed.

```javascript
emitter.on('utterance', (event) => {
  // event.utterance: {
  //   raw?: Blob - Raw audio data (if emitRawAudio is true)
  //   mp3?: Blob - MP3 encoded audio (if emitMP3Audio is true)
  //   text?: string - Transcribed text (if emitText is true)
  //   timestamp: number - milliseconds since epoch when utterance was recorded
  // }
  
  if (event.utterance.mp3) {
    // Handle MP3 audio...
  }
});
```

You can subscribe to events either using the `.on()` method as shown above, or by providing an `onUtterance` callback in the config. The `onUtterance` callback is equivalent to subscribing to the 'utterance' event but only receives the utterance object, not the full event.
