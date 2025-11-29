# VAD Integration Design Document

## Executive Summary

This document specifies the integration points between @ricky0123/vad-web and the existing audio processing pipeline in `/workspace/src/index.ts`. The design preserves backward compatibility, maintains existing event flows, and provides graceful degradation.

## 1. Current Implementation Analysis

### 1.1 Audio Processing Pipeline (lines 256-335)

**Data Flow:**
```
MediaStream → AudioContext → AnalyserNode → getByteFrequencyData() → Frequency Domain (Uint8Array)
                                          ↓
                                    Volume Calculation (average of frequency bins)
                                          ↓
                                    Threshold Comparison (binary signal)
                                          ↓
                                    Quiet Period Filter (400ms hysteresis)
                                          ↓
                                    MediaRecorder Control (start/stop)
```

**Key Line Ranges:**
- **Lines 260-267**: Volume calculation from frequency domain data
- **Line 276**: Threshold signal generation (`average > this.volumeThreshold`)
- **Lines 283-294**: Quiet period filter (prevents premature stop)
- **Lines 300-318**: SpeakingEvent emission (state change detection)
- **Lines 326-332**: MediaRecorder state control

**Performance Constraints:**
- Frame budget: 16.67ms at 60 FPS (requestAnimationFrame loop)
- Current overhead: ~0.1-0.5ms per frame
- Buffer size: 2048 samples (default from AnalyserNode)

### 1.2 Configuration Interface (types.ts)

Current `EmitterConfig` interface:
- `volumeThreshold`: Number (amplitude threshold)
- `quietPeriod`: Number (400ms default)
- `sampleRate`: Number (audio sample rate)
- `charts`: Optional visualization canvases
- `onUtterance`: Callback for utterance events

**Extension Points:**
- No breaking changes allowed
- Must support optional VAD parameters
- Backward compatibility required

## 2. VAD Wrapper Interface Design

### 2.1 Interface Definition

Create `/workspace/src/vad-wrapper.ts`:

```typescript
import { MicVAD, Message } from '@ricky0123/vad-web'

export interface VADConfig {
  threshold: number // Probability threshold [0-1], default 0.5
  sampleRate: number // Audio sample rate (16000, 24000, 32000, 48000)
  workletMode: boolean // Use AudioWorklet for processing, default true
}

export interface VADWrapper {
  /**
   * Initialize the VAD model (async)
   * @returns Promise that resolves when model is loaded
   * @throws Error if initialization fails
   */
  initialize(audioContext: AudioContext, source: MediaStreamAudioSourceNode): Promise<void>

  /**
   * Get current VAD probability
   * @returns Probability [0-1] or null if not ready
   */
  getProbability(): number | null

  /**
   * Check if VAD is initialized and ready
   */
  isReady: boolean

  /**
   * Destroy VAD instance and cleanup resources
   */
  destroy(): void
}

export class RickyVADWrapper implements VADWrapper {
  private vad: MicVAD | null = null
  private currentProbability: number = 0
  private _isReady: boolean = false
  private config: VADConfig

  constructor(config: Partial<VADConfig> = {}) {
    this.config = {
      threshold: config.threshold ?? 0.5,
      sampleRate: config.sampleRate ?? 16000,
      workletMode: config.workletMode ?? true
    }
  }

  async initialize(audioContext: AudioContext, source: MediaStreamAudioSourceNode): Promise<void> {
    try {
      this.vad = await MicVAD.new({
        positiveSpeechThreshold: this.config.threshold,
        redemptionFrames: 8, // ~160ms at 20ms per frame
        stream: source.mediaStream,
        workletURL: '/vad-worklet.js', // Bundle from @ricky0123/vad-web
        onSpeechStart: () => {
          this.currentProbability = 1.0 // Speech detected
        },
        onSpeechEnd: () => {
          this.currentProbability = 0.0 // No speech
        },
        onVADMisfire: () => {
          this.currentProbability = 0.0 // False positive correction
        }
      })
      this._isReady = true
    } catch (error) {
      console.error('VAD initialization failed:', error)
      throw error
    }
  }

  getProbability(): number | null {
    if (!this._isReady) return null
    return this.currentProbability
  }

  get isReady(): boolean {
    return this._isReady
  }

  destroy(): void {
    if (this.vad) {
      this.vad.destroy()
      this.vad = null
    }
    this._isReady = false
  }
}
```

**Design Rationale:**
- **Abstraction**: Interface allows swapping VAD implementations
- **Async initialization**: Non-blocking model loading
- **Probability access**: Returns null if not ready (enables fallback)
- **Lifecycle management**: Explicit destroy() for cleanup

### 2.2 Alternative: Direct Audio Processing

If MicVAD's built-in stream processing doesn't fit the existing pipeline, use frame-based processing:

```typescript
export class FrameBasedVADWrapper implements VADWrapper {
  private vad: any // ONNX Runtime session
  private _isReady: boolean = false

  async initialize(): Promise<void> {
    // Load ONNX model directly
    const ort = await import('onnxruntime-web')
    this.vad = await ort.InferenceSession.create('/silero_vad.onnx')
    this._isReady = true
  }

  async processFrame(audioData: Float32Array): Promise<number> {
    // Run inference on 512-sample frames
    const tensor = new ort.Tensor('float32', audioData, [1, audioData.length])
    const results = await this.vad.run({ input: tensor })
    return results.output.data[0] // Probability [0-1]
  }
}
```

**Recommendation**: Start with MicVAD's stream-based approach for simplicity. Switch to frame-based if latency issues arise.

## 3. Configuration Extension

### 3.1 EmitterConfig Extension

Modify `/workspace/src/types.ts`:

```typescript
export interface EmitterConfig {
  // ... existing fields ...

  // VAD Configuration (backward compatible)
  vadEnabled?: boolean // Enable VAD (default: true)
  vadThreshold?: number // VAD probability threshold 0-1 (default: 0.5)
  vadFallback?: boolean // Fallback to amplitude if VAD fails (default: true)
  vadSampleRate?: number // VAD model sample rate (default: 16000)
}
```

**Default Values:**
- `vadEnabled`: `true` (use VAD by default for better accuracy)
- `vadThreshold`: `0.5` (balanced sensitivity)
- `vadFallback`: `true` (graceful degradation)
- `vadSampleRate`: `16000` (Silero VAD native rate)

**Backward Compatibility:**
- All new fields are optional
- Existing code continues working without changes
- `volumeThreshold` still used for visualization and fallback

### 3.2 Usage Examples

```typescript
// Default behavior (VAD enabled)
const emitter = new UtteranceEmitter({
  onUtterance: handleUtterance
})

// Disable VAD (use amplitude-based detection)
const emitter = new UtteranceEmitter({
  vadEnabled: false,
  volumeThreshold: 50
})

// Tune VAD sensitivity
const emitter = new UtteranceEmitter({
  vadEnabled: true,
  vadThreshold: 0.3, // More sensitive (earlier detection)
  vadFallback: true
})
```

## 4. Integration Points

### 4.1 Initialization Sequence (handleStream - line 163)

**Current Code (lines 163-194):**
```typescript
handleStream(stream: MediaStream): void {
  this.audioContext = new AudioContext()
  // ... create analysers ...
  // ... setup charts ...
}
```

**Modified Code:**
```typescript
async handleStream(stream: MediaStream): Promise<void> {
  this.audioContext = new AudioContext()
  this.audioChunks = []

  // Create audio source
  const source = this.audioContext.createMediaStreamSource(stream)

  // Create analysers (UNCHANGED)
  this.analysers = {
    volume: new AudioAnalyser(this.audioContext, source),
    waveform: this.config.charts?.waveform
      ? new AudioAnalyser(this.audioContext, source, 2048)
      : undefined,
    frequency: this.config.charts?.frequency
      ? new AudioAnalyser(this.audioContext, source, 2048)
      : undefined,
  }

  // [NEW] Initialize VAD asynchronously
  if (this.config.vadEnabled !== false) {
    try {
      this.vadWrapper = new RickyVADWrapper({
        threshold: this.config.vadThreshold ?? 0.5,
        sampleRate: this.config.vadSampleRate ?? 16000,
        workletMode: true
      })
      await this.vadWrapper.initialize(this.audioContext, source)
      console.log('VAD initialized successfully')
    } catch (error) {
      console.error('VAD initialization failed, using amplitude fallback:', error)
      this.vadWrapper = null // Signal fallback mode
    }
  }

  // ... rest of setup (UNCHANGED) ...
  this.processAudio()
}
```

**Key Changes:**
- Line 163: Change signature to `async handleStream(stream: MediaStream): Promise<void>`
- After line 179: Add VAD initialization block
- Non-blocking: VAD loads while UI remains responsive
- Error handling: Catches initialization failures

**Breaking Change Consideration:**
- Changing `handleStream` to async is technically breaking
- However, it's called internally from `start()` (line 156)
- External callers unlikely (internal method)
- Alternative: Initialize VAD in background, start processing immediately

### 4.2 Signal Generation (processAudio - line 276)

**Current Code (lines 275-280):**
```typescript
// Store the threshold signal
const thresholdSignal = average > this.volumeThreshold ? 1 : 0
if (this.thresholdSignalData.length >= this.maxSignalPoints) {
  this.thresholdSignalData.shift()
}
this.thresholdSignalData.push(thresholdSignal)
```

**Modified Code:**
```typescript
// Generate threshold signal (VAD or amplitude-based)
let thresholdSignal: number
if (this.vadWrapper?.isReady) {
  // Use VAD probability
  const probability = this.vadWrapper.getProbability()
  thresholdSignal = (probability !== null && probability > (this.config.vadThreshold ?? 0.5)) ? 1 : 0
} else {
  // Fallback to amplitude-based detection
  thresholdSignal = average > this.volumeThreshold ? 1 : 0
}

// Store threshold signal (UNCHANGED)
if (this.thresholdSignalData.length >= this.maxSignalPoints) {
  this.thresholdSignalData.shift()
}
this.thresholdSignalData.push(thresholdSignal)
```

**Key Changes:**
- Line 276: Replace direct comparison with VAD probability check
- Fallback: Use `average > this.volumeThreshold` if VAD not ready
- No changes to data storage or visualization

**Performance Impact:**
- VAD probability access: ~0.1ms (simple property read)
- Total overhead: < 0.5ms per frame
- Fits within 16.67ms frame budget

### 4.3 Quiet Period Filter (lines 283-294)

**NO CHANGES REQUIRED**

The quiet period filter operates on the `thresholdSignal` value, which now comes from VAD instead of amplitude comparison. The logic remains identical:

```typescript
// Calculate the speaking signal by filtering the threshold signal
if (average > this.volumeThreshold) { // [KEEP] Used for visualization
  this.aboveThreshold = true
  this.belowThresholdDuration = 0
} else {
  this.belowThresholdDuration += 16.67
  if (this.belowThresholdDuration >= (this.config.quietPeriod || DEFAULT_QUIET_PERIOD)) {
    this.aboveThreshold = false
  }
}
```

**Note:** This block still references `average > this.volumeThreshold` to update `aboveThreshold`. This should actually use `thresholdSignal`:

**Corrected Code:**
```typescript
// Calculate the speaking signal by filtering the threshold signal
if (thresholdSignal === 1) {
  this.aboveThreshold = true
  this.belowThresholdDuration = 0
} else {
  this.belowThresholdDuration += 16.67
  if (this.belowThresholdDuration >= (this.config.quietPeriod || DEFAULT_QUIET_PERIOD)) {
    this.aboveThreshold = false
  }
}
```

**Key Change:**
- Line 283: Replace `average > this.volumeThreshold` with `thresholdSignal === 1`
- Ensures quiet period filter uses VAD signal, not amplitude

### 4.4 MediaRecorder Control (lines 326-332)

**NO CHANGES REQUIRED**

MediaRecorder control depends on `speakingSignal`, which is derived from the filtered `thresholdSignal`:

```typescript
// Start or stop recording based on filtered signal
if (speakingSignal && this.mediaRecorder?.state === "inactive") {
  console.log("Starting media recorder")
  this.mediaRecorder.start()
} else if (!speakingSignal && this.mediaRecorder?.state === "recording") {
  console.log("Stopping media recorder")
  this.mediaRecorder.stop()
}
```

This code remains unchanged because it operates on `speakingSignal`, not the raw threshold.

### 4.5 Event Emission (lines 300-318)

**NO CHANGES REQUIRED**

SpeakingEvent emission detects state changes in `speakingSignal`:

```typescript
// If the speaking state has changed from 0 to 1, emit the speaking event
if (
  speakingSignal === 1 &&
  this.speakingSignalData[this.speakingSignalData.length - 1] === 0
) {
  const event: SpeakingEvent = {
    speaking: true,
    timestamp: Date.now(),
  }
  this.emit("speaking", event)
}
```

This logic remains unchanged because it operates on the final `speakingSignal` value.

## 5. Audio Format Conversion

### 5.1 Current Format

**Frequency Domain (getByteFrequencyData):**
- Output: `Uint8Array` (0-255 range)
- Data: FFT magnitude spectrum (frequency bins)
- Usage: Volume calculation via bin averaging

**Problem:** VAD models expect time-domain PCM samples, not frequency data.

### 5.2 Conversion Strategy

**Option 1: Use Separate AnalyserNode (Recommended)**

Create dedicated analyser for time-domain data:

```typescript
// In handleStream()
this.analysers = {
  volume: new AudioAnalyser(this.audioContext, source), // Frequency domain (existing)
  vadInput: new AudioAnalyser(this.audioContext, source, 512), // Time domain for VAD
  // ... other analysers
}
```

In `processAudio()`:
```typescript
// Get time-domain data for VAD
const vadAnalyser = this.analysers.vadInput
const timeDomainData = new Float32Array(vadAnalyser.bufferLength)
vadAnalyser.node.getFloatTimeDomainData(timeDomainData)

// Process with VAD (if using frame-based wrapper)
if (this.vadWrapper?.isReady) {
  const probability = await this.vadWrapper.processFrame(timeDomainData)
  thresholdSignal = probability > (this.config.vadThreshold ?? 0.5) ? 1 : 0
}
```

**Pros:**
- Clean separation of concerns
- No impact on existing volume calculation
- Optimized buffer size for VAD (512 samples = 32ms at 16kHz)

**Cons:**
- Additional AnalyserNode (minimal overhead)

**Option 2: Use MicVAD's Built-in Stream Processing**

MicVAD handles audio format conversion internally:

```typescript
this.vad = await MicVAD.new({
  stream: source.mediaStream, // Directly pass MediaStream
  // VAD handles time-domain extraction
})
```

**Pros:**
- Zero conversion code required
- Handles sample rate conversion automatically

**Cons:**
- Less control over processing pipeline
- May not fit frame-by-frame processing model

**Recommendation:** Use Option 2 (MicVAD built-in) for Phase 1. Switch to Option 1 if we need frame-level control.

### 5.3 Sample Rate Considerations

**Current System:**
- Configurable via `EmitterConfig.sampleRate` (default 48kHz)
- AudioContext runs at native hardware rate

**VAD Requirements:**
- Silero VAD supports: 16kHz, 24kHz, 32kHz, 48kHz
- Optimal: 16kHz (smallest model, fastest processing)

**Strategy:**
- Let MicVAD handle resampling internally (Option 2)
- If using frame-based processing (Option 1), resample manually:

```typescript
// Resample from 48kHz to 16kHz using Web Audio
const resampler = this.audioContext.createScriptProcessor(4096, 1, 1)
resampler.onaudioprocess = (event) => {
  const inputData = event.inputBuffer.getChannelData(0)
  const outputData = this.resample(inputData, 48000, 16000)
  // Feed to VAD
}
```

**Recommendation:** Use MicVAD's built-in resampling to avoid complexity.

## 6. Fallback Logic

### 6.1 Failure Scenarios

1. **VAD initialization fails**: Network error, unsupported browser, WASM failure
2. **VAD processing errors**: Runtime exceptions during inference
3. **User disables VAD**: `vadEnabled: false` in config

### 6.2 Fallback Strategy

```typescript
// In processAudio()
let thresholdSignal: number

if (this.config.vadEnabled === false) {
  // User explicitly disabled VAD
  thresholdSignal = average > this.volumeThreshold ? 1 : 0
} else if (this.vadWrapper?.isReady) {
  // VAD available, use it
  try {
    const probability = this.vadWrapper.getProbability()
    thresholdSignal = (probability !== null && probability > (this.config.vadThreshold ?? 0.5)) ? 1 : 0
  } catch (error) {
    console.error('VAD processing error, falling back to amplitude:', error)
    thresholdSignal = average > this.volumeThreshold ? 1 : 0
  }
} else {
  // VAD not ready or initialization failed
  if (this.config.vadFallback !== false) {
    // Fallback to amplitude-based detection
    thresholdSignal = average > this.volumeThreshold ? 1 : 0
  } else {
    // No fallback, wait for VAD
    thresholdSignal = 0
  }
}
```

**Fallback Behavior:**
- Default: Seamless fallback to amplitude-based detection
- User control: `vadFallback: false` disables fallback (strict VAD mode)
- Logging: Warnings when fallback occurs

### 6.3 User Feedback

Emit events to inform users of VAD status:

```typescript
// In handleStream() after VAD initialization
if (this.vadWrapper?.isReady) {
  this.emit('vad:ready', { timestamp: Date.now() })
} else {
  this.emit('vad:fallback', {
    reason: 'initialization_failed',
    timestamp: Date.now()
  })
}
```

**New Event Types:**
- `vad:ready`: VAD successfully initialized
- `vad:fallback`: Using amplitude-based detection
- `vad:error`: Runtime processing error

## 7. Preserved Components

### 7.1 No Changes Required

- **AudioAnalyser** (`/workspace/src/audio-analyser.ts`): Used for volume visualization
- **EventEmitter** (`/workspace/src/event-emitter.ts`): Event system unchanged
- **Signal Arrays**: `volumeData`, `thresholdSignalData`, `speakingSignalData` (visualization)
- **Chart Rendering** (lines 413-621): All chart drawing code unchanged
- **processUtterance()** (line 340+): Audio blob processing unchanged

### 7.2 Minimal Changes

- **processAudio()**: Single line change at 276 (threshold signal generation)
- **handleStream()**: Add VAD initialization block after line 179
- **EmitterConfig**: Add optional VAD fields (backward compatible)

## 8. Implementation Checklist

### 8.1 Phase 1: Core Integration

- [ ] Add @ricky0123/vad-web to package.json
- [ ] Create `/workspace/src/vad-wrapper.ts` with `VADWrapper` interface and `RickyVADWrapper` implementation
- [ ] Extend `EmitterConfig` in `/workspace/src/types.ts` with `vadEnabled`, `vadThreshold`, `vadFallback`, `vadSampleRate`
- [ ] Modify `handleStream()` (line 163) to async, add VAD initialization after line 179
- [ ] Modify `processAudio()` line 276: replace threshold calculation with VAD probability check
- [ ] Modify `processAudio()` line 283: replace `average > this.volumeThreshold` with `thresholdSignal === 1`
- [ ] Add `vadWrapper` property to UtteranceEmitter class
- [ ] Add cleanup in `cleanup()` method: `this.vadWrapper?.destroy()`

### 8.2 Phase 2: Testing & Validation

- [ ] Unit tests for VADWrapper initialization
- [ ] Integration tests for fallback logic
- [ ] Performance tests: measure processAudio() latency with VAD
- [ ] Browser compatibility tests (Chrome, Firefox, Safari, Edge)
- [ ] Memory leak tests (long-running sessions)

### 8.3 Phase 3: Documentation

- [ ] Update README.md with VAD configuration examples
- [ ] Add JSDoc comments to new VAD fields in EmitterConfig
- [ ] Create migration guide for existing users
- [ ] Document bundle size impact

## 9. Performance Budget

### 9.1 Latency Targets

| Operation | Current | With VAD | Target | Status |
|-----------|---------|----------|--------|--------|
| Frame processing | 0.1-0.5ms | 1-5ms | < 10ms | ✅ Within budget |
| VAD initialization | 0ms | 500-2000ms | < 3000ms | ✅ Async, non-blocking |
| Memory overhead | ~5MB | ~15MB | < 50MB | ✅ Acceptable |

### 9.2 Bundle Size Impact

| Component | Size | Compression | CDN Cacheable |
|-----------|------|-------------|---------------|
| ONNX Runtime WASM | 500KB | Brotli | Yes |
| Silero VAD Model | 1-2MB | None (binary) | Yes |
| Wrapper code | 5KB | Brotli | Yes |
| **Total** | **~1.5MB** | **~800KB compressed** | **Yes** |

**Mitigation:**
- Lazy load VAD model (only when `start()` called)
- Use CDN for model hosting (shared cache across sites)
- Consider ORT format conversion (Phase 2 optimization)

## 10. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| VAD initialization fails | Medium | High | Fallback to amplitude-based detection |
| WASM not supported | Low | High | Browser detection, fallback mode |
| Performance regression | Low | Medium | Frame timing validation, worklet mode |
| Breaking changes | Low | High | Backward compatible config, extensive testing |
| Bundle size concerns | Medium | Low | Lazy loading, CDN caching, documentation |

## 11. Success Metrics

- [ ] Zero breaking changes to existing API
- [ ] VAD initialization success rate > 95%
- [ ] Frame processing latency < 10ms (p95)
- [ ] Fallback activation < 5% of sessions
- [ ] Bundle size increase < 2MB uncompressed
- [ ] All existing Cypress tests pass
- [ ] New VAD-specific tests pass

## 12. Code Review Checklist

- [ ] All integration points documented with line numbers
- [ ] VADWrapper interface clearly defined
- [ ] EmitterConfig extension is backward compatible
- [ ] Audio format conversion strategy specified
- [ ] Async initialization sequence documented
- [ ] Fallback logic handles all failure scenarios
- [ ] No changes to preserved components (AudioAnalyser, EventEmitter, charts)
- [ ] Performance budget maintained
- [ ] Error handling comprehensive
- [ ] Logging appropriate (no console spam)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-29
**Author:** Software Architect Agent
**Status:** Ready for Implementation
