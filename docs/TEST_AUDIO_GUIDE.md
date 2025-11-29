# Test Audio Sample Guide

This guide explains how to create and prepare test audio samples for VAD accuracy testing.

## Required Test Samples

For comprehensive accuracy testing, you need audio samples representing different noise conditions:

### 1. Quiet Speech (`quiet_speech.wav`)

**Purpose**: Test VAD sensitivity to low-volume speech

**Characteristics**:
- Clean speech at low volume (conversational level, not shouting)
- Silent background (< 30 dB ambient noise)
- Duration: 3-5 seconds
- Contains at least one utterance with pauses before/after

**Recording Tips**:
- Record in a quiet room
- Speak naturally at conversational volume
- Position microphone 1-2 feet from mouth
- Use a pop filter to reduce plosives

**Ground Truth**:
```javascript
{
  name: 'quiet-speech',
  expectedSegments: [
    { startTime: 0, endTime: 500, isSpeech: false },    // Initial silence
    { startTime: 500, endTime: 2500, isSpeech: true },  // Speech
    { startTime: 2500, endTime: 3000, isSpeech: false }, // Final silence
  ]
}
```

### 2. Normal Speech (`hello.wav`, `hello_hello.wav`)

**Purpose**: Baseline accuracy with typical speech

**Characteristics**:
- Normal conversational volume
- Quiet background (office ambient noise acceptable)
- Duration: 1-5 seconds
- Clear utterance boundaries

**Existing Samples**:
- `hello.wav`: Single "hello" utterance
- `hello_hello.wav`: Two "hello" utterances with pause
- `hello_and_goodbye.wav`: Two different utterances

**Ground Truth Example**:
```javascript
{
  name: 'hello_hello',
  expectedSegments: [
    { startTime: 0, endTime: 300, isSpeech: false },
    { startTime: 300, endTime: 1300, isSpeech: true },  // "Hello"
    { startTime: 1300, endTime: 2000, isSpeech: false }, // Pause
    { startTime: 2000, endTime: 3000, isSpeech: true },  // "Hello"
    { startTime: 3000, endTime: 3500, isSpeech: false },
  ]
}
```

### 3. Speech with Keyboard Typing (`speech_with_typing.wav`)

**Purpose**: Test false positive rejection (keyboard clicks should not trigger VAD)

**Characteristics**:
- Normal speech volume
- Mechanical keyboard typing sounds
- Typing should occur both during speech and during silence
- Duration: 5-7 seconds

**Recording Tips**:
- Use a mechanical keyboard for distinct click sounds
- Record: typing alone → speech while typing → typing alone → speech without typing
- Keep microphone distance consistent

**Ground Truth**:
```javascript
{
  name: 'keyboard-typing',
  expectedSegments: [
    { startTime: 0, endTime: 500, isSpeech: false },     // Typing only
    { startTime: 500, endTime: 2500, isSpeech: true },   // Speech + typing
    { startTime: 2500, endTime: 3500, isSpeech: false }, // Typing only
    { startTime: 3500, endTime: 5000, isSpeech: true },  // Speech only
    { startTime: 5000, endTime: 5500, isSpeech: false },
  ]
}
```

### 4. Speech with HVAC Noise (`speech_with_hvac.wav`)

**Purpose**: Test false positive rejection (HVAC hum should not trigger VAD)

**Characteristics**:
- Normal speech volume
- Constant HVAC/air conditioning background hum
- HVAC noise should be present throughout recording
- Duration: 4-6 seconds

**Recording Tips**:
- Record near air vent or air conditioner
- Ensure HVAC noise is audible but not overwhelming
- Record: HVAC alone → speech with HVAC → HVAC alone

**Ground Truth**:
```javascript
{
  name: 'hvac-noise',
  expectedSegments: [
    { startTime: 0, endTime: 1000, isSpeech: false },    // HVAC only
    { startTime: 1000, endTime: 3000, isSpeech: true },  // Speech + HVAC
    { startTime: 3000, endTime: 4000, isSpeech: false }, // HVAC only
  ]
}
```

## Creating Test Samples

### Option 1: Record Your Own

**Tools Needed**:
- Audio recording software (Audacity is free and cross-platform)
- Microphone (built-in laptop mic is acceptable for testing)
- Quiet environment

**Recording Process**:

1. **Setup Audacity**:
   - Sample rate: 44100 Hz (matches DEFAULT_SAMPLE_RATE)
   - Format: 16-bit PCM
   - Channels: Mono

2. **Record**:
   - Click red record button
   - Follow recording tips above for each sample type
   - Stop recording

3. **Trim and Export**:
   - Select silence at beginning/end and trim
   - File → Export → Export as WAV
   - Format: WAV (Microsoft) 16-bit PCM
   - Save to `cypress/test_data/`

### Option 2: Synthetic Audio Generation

For consistent, reproducible test samples:

```javascript
// Example: Generate synthetic speech with noise
const AudioContext = require('web-audio-api').AudioContext
const fs = require('fs')

function generateTestAudio() {
  const sampleRate = 44100
  const duration = 5 // seconds
  const bufferSize = sampleRate * duration

  const audioContext = new AudioContext()
  const buffer = audioContext.createBuffer(1, bufferSize, sampleRate)
  const data = buffer.getChannelData(0)

  // Generate speech simulation (sine waves at speech frequencies)
  for (let i = 0; i < bufferSize; i++) {
    const t = i / sampleRate

    // Speech segment: 0.5s - 2.5s
    if (t >= 0.5 && t <= 2.5) {
      // Fundamental frequency ~150 Hz (typical male voice)
      const f0 = 150
      // Add harmonics
      data[i] =
        0.5 * Math.sin(2 * Math.PI * f0 * t) +
        0.3 * Math.sin(2 * Math.PI * f0 * 2 * t) +
        0.2 * Math.sin(2 * Math.PI * f0 * 3 * t)

      // Add amplitude envelope
      const envelope = Math.sin(Math.PI * (t - 0.5) / 2.0)
      data[i] *= envelope * 0.5
    }

    // Add HVAC noise (low-frequency hum)
    const hvacNoise = 0.05 * Math.sin(2 * Math.PI * 60 * t) // 60 Hz hum
    data[i] += hvacNoise
  }

  // Export to WAV (requires additional library like 'wav')
  // ... implementation details ...
}
```

### Option 3: Use Existing Audio Samples

If you have existing audio recordings:

1. **Convert to WAV**:
   ```bash
   # Using ffmpeg
   ffmpeg -i input.mp3 -ar 44100 -ac 1 -sample_fmt s16 output.wav
   ```

2. **Trim to Appropriate Length**:
   ```bash
   # Trim to 5 seconds starting at 0
   ffmpeg -i input.wav -ss 0 -t 5 output.wav
   ```

3. **Add Background Noise** (optional):
   ```bash
   # Mix speech with noise file
   ffmpeg -i speech.wav -i noise.wav -filter_complex amix=inputs=2:duration=first output.wav
   ```

## Annotating Ground Truth

After creating test samples, you need to annotate the speech segments.

### Manual Annotation

1. **Open in Audacity**
2. **View Waveform**: Look for clear amplitude changes
3. **Mark Segments**:
   - Zoom in to see precise boundaries
   - Note timestamp when amplitude rises (speech starts)
   - Note timestamp when amplitude drops (speech ends)
   - Use labels (Ctrl+B) to mark segments

4. **Export Labels**:
   - Tracks → Edit Labels
   - Note start/end times
   - Translate to milliseconds for ground truth

### Automated Annotation

For more precision, use the existing amplitude-based detector:

```javascript
// Play test audio through UtteranceEmitter
const emitter = new UtteranceEmitter({
  volumeThreshold: 7,
  onSpeaking: (event) => {
    console.log(`Speaking ${event.speaking ? 'started' : 'stopped'} at ${event.timestamp}`)
  }
})

emitter.start()
// Play test audio through audio system
// Record speaking events
// Use as initial ground truth, then manually refine
```

## Validating Test Samples

Before using samples in accuracy tests:

### 1. Visual Inspection

Open in Audacity and verify:
- Clear speech segments visible in waveform
- Background noise levels appropriate
- No clipping or distortion
- Proper silence before/after utterances

### 2. Playback Test

Listen to each sample:
- Speech is intelligible
- Noise characteristics are as intended
- Segment boundaries sound correct

### 3. Ground Truth Verification

```javascript
// Test that ground truth matches audio
const testCase = {
  name: 'test-sample',
  audioFile: 'cypress/test_data/test-sample.wav',
  expectedSegments: [
    { startTime: 0, endTime: 500, isSpeech: false },
    { startTime: 500, endTime: 2500, isSpeech: true },
    // ...
  ]
}

// Play audio and visually confirm timing matches
```

## Storage and Organization

### File Naming Convention

```
{description}_{condition}.wav
```

Examples:
- `quiet_speech.wav`
- `hello.wav`
- `speech_with_typing.wav`
- `speech_with_hvac.wav`
- `multiple_utterances.wav`

### Directory Structure

```
cypress/
  test_data/
    hello.wav                    # Existing
    hello_hello.wav             # Existing
    hello_and_goodbye.wav       # Existing
    quiet_speech.wav            # New - quiet speech
    speech_with_typing.wav      # New - keyboard noise
    speech_with_hvac.wav        # New - HVAC noise
    multiple_utterances.wav     # New - multiple utterances
    README.md                   # Documentation
```

### Metadata File

Create `cypress/test_data/README.md`:

```markdown
# Test Audio Samples

## Samples

### hello.wav
- Duration: 1.2s
- Content: Single "hello" utterance
- Noise: Quiet office ambient
- Ground Truth: See accuracy-tester.ts

### quiet_speech.wav
- Duration: 3.0s
- Content: Conversational speech at low volume
- Noise: Silent background
- Ground Truth: See accuracy-tester.ts
- Purpose: Test sensitivity to low-volume speech

[... etc for each sample]
```

## Next Steps

Once you have created test samples:

1. **Place in `cypress/test_data/`**
2. **Update `src/accuracy-tester.ts`** with ground truth annotations
3. **Run accuracy tests** following TESTING_GUIDE.md
4. **Document results** in issue comments

## Troubleshooting

### Issue: Ground truth doesn't match audio

**Solution**:
- Use Audacity to precisely measure segment boundaries
- Account for recording delay/offset
- Verify timestamps are in milliseconds

### Issue: Test fails with both amplitude and VAD

**Solution**:
- Audio sample may be corrupted
- Check ground truth annotations
- Verify audio format (44100 Hz, mono, 16-bit)

### Issue: Inconsistent results across test runs

**Solution**:
- Ensure audio playback is deterministic
- Check for timing drift in test framework
- Use synthetic audio for reproducibility

## References

- [Audacity Documentation](https://manual.audacityteam.org/)
- [ffmpeg Audio Filtering](https://ffmpeg.org/ffmpeg-filters.html#Audio-Filters)
- [WAV File Format](https://en.wikipedia.org/wiki/WAV)
- [Speech Analysis Basics](https://en.wikipedia.org/wiki/Speech_processing)
