# VAD Implementation Recommendations

**Issue**: #40 - Voice Activity Detection Implementation
**Phase**: Phase 5 - Integration (Next Steps)
**Date**: 2025-11-29

## Overview

This document provides implementation recommendations for integrating @ricky0123/vad-web into the UtteranceEmitter component, referencing the Phase 2 design and incorporating all research findings from Phases 1-4.

**Target**: Implement production-ready VAD integration with minimal code changes, graceful fallback, and optimal performance.

---

## Implementation Plan Summary

### Phase Overview

| Phase | Timeline | Deliverables | Status |
|-------|----------|--------------|--------|
| **Phase 1: Research** | Complete | Library evaluation, ADR | ✅ Complete |
| **Phase 2: Design** | Complete | Integration architecture | ✅ Complete |
| **Phase 3: Evaluation** | Complete | Performance validation | ✅ Complete |
| **Phase 4: Documentation** | Complete | ADR, migration guide, examples | ✅ Complete |
| **Phase 5: Integration** | **Next** | VAD implementation | ⏸️ Ready to start |
| **Phase 6: Testing** | Future | Unit, integration, E2E tests | 📋 Planned |
| **Phase 7: Deployment** | Future | Production rollout | 📋 Planned |

---

## Phase 5: Integration Implementation

### Objectives

1. Integrate @ricky0123/vad-web with minimal changes to existing architecture
2. Implement lazy loading for zero main bundle impact
3. Provide graceful fallback to amplitude-based detection
4. Extend EmitterConfig with VAD parameters
5. Maintain backward compatibility (no breaking changes)
6. Add comprehensive error handling

### Deliverables

- [ ] Install @ricky0123/vad-web npm package
- [ ] Create VADWrapper abstraction (`src/vad-wrapper.ts`)
- [ ] Extend EmitterConfig interface (`src/types.ts`)
- [ ] Modify `handleStream()` for async VAD initialization
- [ ] Replace threshold calculation with VAD probability
- [ ] Implement fallback logic for initialization failures
- [ ] Add lazy loading for VAD module
- [ ] Update unit tests for new configuration parameters
- [ ] Add integration tests for VAD detection
- [ ] Update README with VAD documentation

---

## Step-by-Step Implementation Guide

### Step 1: Install Dependencies

**File**: `package.json`

```bash
npm install @ricky0123/vad-web
```

**Expected changes**:
```json
{
  "dependencies": {
    "@ricky0123/vad-web": "^0.0.19"
  }
}
```

**Verification**:
```bash
npm list @ricky0123/vad-web
# Should show installed version
```

---

### Step 2: Extend EmitterConfig Interface

**File**: `/workspace/src/types.ts`

**Current interface** (reference from Phase 2 design):
```typescript
interface EmitterConfig {
  volumeThreshold: number;
}
```

**Add VAD parameters**:
```typescript
/**
 * Configuration for UtteranceEmitter voice activity detection.
 */
export interface EmitterConfig {
  /**
   * Volume threshold for amplitude-based detection.
   * Range: 0-1, Default: 0.5
   * Used for visualization and fallback when VAD is disabled or fails.
   */
  volumeThreshold?: number;

  /**
   * Enable ML-based Voice Activity Detection.
   * Default: true
   * When enabled, uses Silero VAD for speech detection.
   * When disabled, falls back to amplitude-based threshold.
   */
  vadEnabled?: boolean;

  /**
   * VAD speech probability threshold.
   * Range: 0-1, Default: 0.5
   * Higher values = stricter detection (fewer false positives)
   * Lower values = more sensitive (detect quiet speech)
   */
  vadThreshold?: number;

  /**
   * Enable fallback to amplitude-based detection if VAD fails.
   * Default: true
   * Ensures UtteranceEmitter continues to function even if VAD initialization fails.
   */
  vadFallback?: boolean;
}
```

**Implementation notes**:
- All VAD parameters are optional (backward compatibility)
- Provide sensible defaults in UtteranceEmitter constructor
- Document each parameter clearly

---

### Step 3: Create VAD Wrapper Module

**File**: `/workspace/src/vad-wrapper.ts` (new file)

**Purpose**: Abstraction layer for @ricky0123/vad-web to simplify integration and enable future library swaps.

```typescript
import type { MicVAD } from "@ricky0123/vad-web";

/**
 * Wrapper interface for Voice Activity Detection.
 * Provides abstraction over @ricky0123/vad-web for easier testing and future library changes.
 */
export interface VADWrapper {
  /**
   * Initialize VAD model asynchronously.
   * @throws Error if initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Process audio frame and return speech probability.
   * @param audioData Float32Array of PCM audio samples
   * @returns Speech probability [0-1], or null if VAD not ready
   */
  process(audioData: Float32Array): Promise<number | null>;

  /**
   * Destroy VAD instance and free resources.
   */
  destroy(): void;

  /**
   * Check if VAD is initialized and ready.
   */
  readonly isReady: boolean;
}

/**
 * Implementation of VADWrapper using @ricky0123/vad-web (Silero VAD).
 */
export class SileroVADWrapper implements VADWrapper {
  private vad: MicVAD | null = null;
  private _isReady: boolean = false;
  private threshold: number;

  constructor(threshold: number = 0.5) {
    this.threshold = threshold;
  }

  async initialize(): Promise<void> {
    try {
      // Lazy import @ricky0123/vad-web (keeps it out of main bundle)
      const { MicVAD } = await import("@ricky0123/vad-web");

      // Initialize VAD with worklet mode for off-main-thread processing
      this.vad = await MicVAD.new({
        positiveSpeechThreshold: this.threshold,
        minSpeechFrames: 3,          // Debouncing: require 3 consecutive frames
        redemptionFrames: 8,          // Wait 8 frames before ending speech
        onSpeechStart: () => {},      // Handled externally
        onSpeechEnd: () => {},        // Handled externally
        // Model and worklet URLs (default to CDN)
        modelURL: "/models/silero_vad.onnx",  // Override in production with CDN
        workletURL: "/vad.worklet.bundle.min.js",
      });

      this._isReady = true;
      console.log("VAD initialized successfully");
    } catch (error) {
      console.error("VAD initialization failed:", error);
      throw new Error(`VAD initialization failed: ${error.message}`);
    }
  }

  async process(audioData: Float32Array): Promise<number | null> {
    if (!this._isReady || !this.vad) {
      return null;
    }

    // Note: @ricky0123/vad-web processes audio internally via AudioWorklet
    // For manual frame processing, we'll use a different approach
    // This is a simplified interface; actual implementation may vary based on library API

    // Placeholder: Return mock probability
    // TODO: Implement actual VAD processing based on @ricky0123/vad-web API
    return 0.5;
  }

  destroy(): void {
    if (this.vad) {
      this.vad.pause();  // Stop processing
      this.vad = null;
      this._isReady = false;
      console.log("VAD destroyed");
    }
  }

  get isReady(): boolean {
    return this._isReady;
  }
}
```

**Implementation notes**:
- Lazy import `@ricky0123/vad-web` to keep it out of main bundle
- Provide abstraction interface `VADWrapper` for future flexibility
- Handle initialization errors gracefully
- Document all public methods clearly

**TODO**: Refine `process()` method based on actual @ricky0123/vad-web API. The library uses AudioWorklet for continuous processing; integration may require different approach than frame-by-frame processing.

---

### Step 4: Modify UtteranceEmitter Constructor

**File**: `/workspace/src/index.ts`

**Current constructor** (reference):
```typescript
constructor(config: Partial<EmitterConfig> = {}) {
  this.config = {
    volumeThreshold: 0.5,
    ...config,
  };
}
```

**Add VAD defaults**:
```typescript
constructor(config: Partial<EmitterConfig> = {}) {
  this.config = {
    volumeThreshold: 0.5,
    vadEnabled: true,       // NEW: Enable VAD by default
    vadThreshold: 0.5,      // NEW: Balanced threshold
    vadFallback: true,      // NEW: Graceful degradation
    ...config,              // User overrides
  };

  // Initialize VAD wrapper (will be initialized lazily in handleStream)
  this.vadWrapper = null;
  this.vadMode = this.config.vadEnabled ? "pending" : "disabled";
}
```

**Add instance variables**:
```typescript
private vadWrapper: VADWrapper | null = null;
private vadMode: "disabled" | "pending" | "ready" | "failed" = "disabled";
```

---

### Step 5: Implement Async VAD Initialization in handleStream()

**File**: `/workspace/src/index.ts`

**Current handleStream()** (simplified reference from `/workspace/src/index.ts:163`):
```typescript
async handleStream(stream: MediaStream) {
  // Setup AudioContext, AnalyserNode, MediaRecorder
  this.setupAudioPipeline(stream);

  // Start processing loop
  this.processAudio();
}
```

**Add VAD initialization**:
```typescript
async handleStream(stream: MediaStream) {
  // Setup AudioContext, AnalyserNode, MediaRecorder
  this.setupAudioPipeline(stream);

  // Initialize VAD if enabled
  if (this.config.vadEnabled && this.vadMode === "pending") {
    try {
      console.log("Initializing VAD...");
      const startTime = performance.now();

      this.vadWrapper = new SileroVADWrapper(this.config.vadThreshold);
      await this.vadWrapper.initialize();

      const elapsed = performance.now() - startTime;
      console.log(`VAD initialized in ${elapsed.toFixed(0)}ms`);

      this.vadMode = "ready";
    } catch (error) {
      console.error("VAD initialization failed:", error);
      this.vadMode = "failed";

      if (!this.config.vadFallback) {
        // No fallback allowed, propagate error
        throw new Error(`VAD required but failed to initialize: ${error.message}`);
      }

      // Fallback to amplitude-based detection
      console.warn("Falling back to amplitude-based detection");
    }
  }

  // Start processing loop
  this.processAudio();
}
```

**Implementation notes**:
- Measure initialization time for telemetry
- Handle errors gracefully with try/catch
- Respect `vadFallback` configuration
- Log state transitions for debugging

---

### Step 6: Replace Threshold Calculation with VAD

**File**: `/workspace/src/index.ts`

**Current threshold calculation** (reference from `/workspace/src/index.ts:276`):
```typescript
// Calculate threshold signal (amplitude-based)
const thresholdSignal = average > this.config.volumeThreshold ? 1 : 0;
```

**Replace with VAD-based calculation**:
```typescript
// Calculate threshold signal (VAD-based if ready, else amplitude-based)
let thresholdSignal: number;

if (this.vadMode === "ready" && this.vadWrapper) {
  // Use VAD probability
  const timeDomainData = new Float32Array(this.analyser.fftSize);
  this.analyser.getFloatTimeDomainData(timeDomainData);

  const probability = await this.vadWrapper.process(timeDomainData);

  if (probability !== null) {
    thresholdSignal = probability > this.config.vadThreshold ? 1 : 0;
  } else {
    // VAD not ready, fallback to amplitude
    thresholdSignal = average > this.config.volumeThreshold ? 1 : 0;
  }
} else {
  // VAD disabled or failed, use amplitude-based
  thresholdSignal = average > this.config.volumeThreshold ? 1 : 0;
}
```

**Implementation notes**:
- Convert frequency domain data to time domain for VAD: `getFloatTimeDomainData()`
- Handle async `process()` call (may require restructuring processAudio loop)
- Fallback to amplitude-based if VAD not ready or returns null
- Preserve existing quiet period filter logic (lines 283-294)

**TODO**: Refactor `processAudio()` to handle async VAD processing. Current implementation uses `requestAnimationFrame` which is synchronous. Consider:
1. Using AudioWorklet for VAD processing (offload from main thread)
2. Caching VAD results for current frame
3. Alternative integration approach based on @ricky0123/vad-web API

---

### Step 7: Implement Cleanup in destroy()

**File**: `/workspace/src/index.ts`

**Add VAD cleanup**:
```typescript
destroy() {
  // Existing cleanup (MediaRecorder, AudioContext, etc.)
  // ...

  // NEW: Cleanup VAD wrapper
  if (this.vadWrapper) {
    this.vadWrapper.destroy();
    this.vadWrapper = null;
    this.vadMode = "disabled";
  }
}
```

---

### Step 8: Update README Documentation

**File**: `/workspace/README.md`

**Add VAD section**:
````markdown
## Voice Activity Detection

UtteranceEmitter uses ML-based Voice Activity Detection (VAD) powered by Silero VAD for accurate speech detection.

### Default Configuration

```typescript
const emitter = new UtteranceEmitter({
  vadEnabled: true,       // Enable VAD (default)
  vadThreshold: 0.5,      // Balanced threshold (default)
  vadFallback: true,      // Fallback to amplitude-based if VAD fails (default)
});
```

### Configuration Options

- **`vadEnabled`**: Enable/disable VAD (default: `true`)
- **`vadThreshold`**: Speech probability threshold, range 0-1 (default: `0.5`)
  - Lower values (0.3-0.4): More sensitive, detect quiet speech
  - Higher values (0.6-0.8): Stricter, reduce false positives
- **`vadFallback`**: Fall back to amplitude-based detection if VAD fails (default: `true`)

### Examples

**Noisy environment** (reduce false positives):
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.7,
});
```

**Quiet speaker** (increase sensitivity):
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.3,
});
```

**Disable VAD** (save bundle size):
```typescript
const emitter = new UtteranceEmitter({
  vadEnabled: false,
  volumeThreshold: 0.5,  // Use amplitude-based detection
});
```

### Bundle Size Impact

VAD adds ~1.5MB to your bundle:
- ONNX Runtime Web: ~500KB
- Silero VAD Model: ~1MB
- Wrapper: ~50KB

**Mitigation**: VAD is lazy-loaded when `handleStream()` is called, keeping your main bundle small. The model is cached by the browser for all future sessions.

### Migration from Amplitude-Based

No code changes required! VAD is enabled by default with backward-compatible configuration:

```typescript
// Before (amplitude-based)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,
});

// After (VAD-enabled, same code!)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,  // Preserved for fallback
  // vadEnabled: true (default)
  // vadThreshold: 0.5 (default)
});
```

See [Migration Guide](docs/migration/vad-migration-guide.md) for detailed transition guidance.
````

---

## Testing Recommendations

### Unit Tests

**File**: `/workspace/test/unit/emitter-config.test.ts` (new file)

```typescript
import { UtteranceEmitter } from "../../src/index";

describe("VAD Configuration", () => {
  it("should use default VAD settings", () => {
    const emitter = new UtteranceEmitter();
    expect(emitter.config.vadEnabled).toBe(true);
    expect(emitter.config.vadThreshold).toBe(0.5);
    expect(emitter.config.vadFallback).toBe(true);
  });

  it("should respect custom vadThreshold", () => {
    const emitter = new UtteranceEmitter({ vadThreshold: 0.7 });
    expect(emitter.config.vadThreshold).toBe(0.7);
  });

  it("should allow disabling VAD", () => {
    const emitter = new UtteranceEmitter({ vadEnabled: false });
    expect(emitter.config.vadEnabled).toBe(false);
  });

  it("should preserve volumeThreshold for backward compatibility", () => {
    const emitter = new UtteranceEmitter({ volumeThreshold: 0.6 });
    expect(emitter.config.volumeThreshold).toBe(0.6);
  });
});
```

### Integration Tests

**File**: `/workspace/test/integration/vad-detection.test.ts` (new file)

```typescript
import { UtteranceEmitter } from "../../src/index";

describe("VAD Speech Detection", () => {
  it("should detect speech with VAD enabled", async () => {
    const emitter = new UtteranceEmitter({ vadEnabled: true });

    // Mock MediaStream with speech audio
    const mockStream = createMockMediaStream("speech.wav");

    await emitter.handleStream(mockStream);

    // Verify VAD detects speech
    // (Implementation depends on test infrastructure)
  });

  it("should fall back to amplitude-based if VAD fails", async () => {
    const emitter = new UtteranceEmitter({
      vadEnabled: true,
      vadFallback: true,
    });

    // Mock VAD initialization failure
    jest.spyOn(SileroVADWrapper.prototype, "initialize").mockRejectedValue(
      new Error("Model load failed")
    );

    const mockStream = createMockMediaStream("speech.wav");

    await emitter.handleStream(mockStream);

    // Verify falls back to amplitude-based detection
    expect(emitter.vadMode).toBe("failed");
  });
});
```

### E2E Tests (Cypress)

**File**: `/workspace/cypress/e2e/vad-integration.cy.ts` (new file)

```typescript
describe("VAD E2E", () => {
  it("should initialize VAD and detect speech", () => {
    cy.visit("/");

    // Start recording
    cy.get("#start-recording").click();

    // Wait for VAD initialization
    cy.contains("Initializing voice detection", { timeout: 3000 });

    // Simulate speech input
    cy.window().then((win) => {
      // Inject speech audio into MediaStream
      // (Implementation depends on test infrastructure)
    });

    // Verify speech detection
    cy.contains("Speaking").should("be.visible");
  });
});
```

---

## Performance Considerations

### Frame Budget Analysis

**Current system** (amplitude-based):
- Frame processing: 16.67ms budget at 60 FPS
- Volume calculation: ~0.1-0.5ms
- Available budget: ~16ms

**With VAD**:
- VAD processing: 1-5ms per frame (WASM, AudioWorklet)
- Main thread impact: 0ms (AudioWorklet offloads processing)
- Available budget: ~16ms (unchanged)

**Conclusion**: VAD fits within existing frame budget via AudioWorklet isolation.

### Memory Profile

**Current system**:
- AudioContext: ~5MB
- AnalyserNode buffers: ~2MB
- Total: ~7MB

**With VAD**:
- ONNX Runtime: ~5MB
- Silero VAD model: ~5MB
- AudioWorklet buffers: ~2MB
- Total VAD overhead: ~12MB

**Total with VAD**: ~19MB (acceptable for browser application)

### Initialization Latency

**Measured latency** (based on @ricky0123/vad-web benchmarks):
- First load: 500-2000ms (model download + initialization)
- Cached: ~50ms (model cached, worklet initialization only)

**Mitigation**:
- Show loading indicator during initialization
- Consider preloading VAD during application idle time (future enhancement)

---

## Known Issues and Limitations

### Issue 1: AudioWorklet Integration

**Problem**: Current `processAudio()` loop uses `requestAnimationFrame` (60 FPS synchronous). @ricky0123/vad-web uses AudioWorklet for continuous processing.

**Impact**: Integration approach needs refinement to align with library's AudioWorklet architecture.

**Solution Options**:
1. **Option A**: Use @ricky0123/vad-web's built-in event handlers (`onSpeechStart`, `onSpeechEnd`) instead of manual frame processing
2. **Option B**: Extract VAD model and implement custom AudioWorklet processing
3. **Option C**: Hybrid approach: Use @ricky0123/vad-web for detection, maintain existing visualization loop

**Recommendation**: Option C (hybrid approach) balances integration simplicity with existing architecture.

### Issue 2: Browser Compatibility Edge Cases

**Problem**: WASM support in very old browsers (< 2020) may be limited.

**Impact**: VAD initialization may fail on legacy browsers.

**Mitigation**: `vadFallback: true` (default) ensures amplitude-based detection works as fallback.

### Issue 3: CDN Configuration for Model Files

**Problem**: Model files (1MB) should be hosted on CDN for optimal loading.

**Impact**: Default file paths may not be production-ready.

**Solution**: Document CDN configuration in README:
```typescript
const emitter = new UtteranceEmitter({
  vadModelURL: "https://cdn.example.com/silero_vad.onnx",
  vadWorkletURL: "https://cdn.example.com/vad.worklet.bundle.min.js",
});
```

---

## Next Steps

### Immediate Actions (Phase 5)

1. [ ] Install @ricky0123/vad-web: `npm install @ricky0123/vad-web`
2. [ ] Create `src/vad-wrapper.ts` with VADWrapper abstraction
3. [ ] Extend `src/types.ts` with VAD configuration parameters
4. [ ] Modify `src/index.ts` constructor to add VAD defaults
5. [ ] Implement async VAD initialization in `handleStream()`
6. [ ] Refine integration approach based on @ricky0123/vad-web API
   - Test hybrid approach (library events + existing visualization)
   - Validate frame timing and main thread impact
7. [ ] Add VAD cleanup in `destroy()`
8. [ ] Update README with VAD documentation
9. [ ] Write unit tests for configuration
10. [ ] Write integration tests for VAD detection

### Future Enhancements (Phase 6+)

1. [ ] Add telemetry for VAD initialization time
2. [ ] Implement dynamic threshold adaptation based on environment noise
3. [ ] Add preloading API for VAD model (`UtteranceEmitter.preloadVAD()`)
4. [ ] Expose advanced VAD parameters (`minSpeechFrames`, `redemptionFrames`)
5. [ ] Create visual indicator for VAD vs. amplitude-based mode
6. [ ] Add performance profiling for frame timing validation
7. [ ] Consider custom ONNX build if bundle size telemetry shows user impact

---

## Reference Documents

- [ADR-001: VAD Library Selection](/workspace/docs/adr/001-vad-library-selection.md)
- [VAD Library Comparison](/workspace/docs/research/vad-library-comparison.md)
- [Bundle Size Optimization Analysis](/workspace/docs/research/bundle-size-optimization-analysis.md)
- [Configuration Parameter Mapping](/workspace/docs/configuration/vad-parameter-mapping.md)
- [Migration Guide](/workspace/docs/migration/vad-migration-guide.md)
- [Sensitivity Tuning Examples](/workspace/docs/examples/vad-sensitivity-tuning.md)
- [Phase 2 Design: VAD Integration Architecture](/workspace/docs/design/phase2-vad-integration.md) (from software_architect agent output)

---

## Success Criteria

### Phase 5 Complete When:

- [x] All acceptance criteria from Issue #40 Phase 4 are met:
  - [x] Architecture Decision Record created with full ADR structure
  - [x] Research findings summary documenting all evaluated libraries
  - [x] Bundle size optimization analysis explaining decision
  - [x] Configuration parameter mapping documented
  - [x] Migration guidance created for existing users
  - [x] Sensitivity tuning examples provided
  - [x] Implementation recommendation provided with clear next steps

### Phase 5 Success Metrics:

- [ ] @ricky0123/vad-web successfully integrated
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] VAD detection accuracy > 85% (vs. 70-75% for amplitude-based)
- [ ] False positive rate < 10%
- [ ] False negative rate < 10%
- [ ] Frame processing time < 16.67ms (60 FPS maintained)
- [ ] Initialization time < 2000ms (first load)
- [ ] Zero breaking changes to public API
- [ ] README documentation complete and accurate

---

**Document Version**: 1.0
**Last Updated**: 2025-11-29
**Author**: Senior Software Engineer
**Status**: Ready for Phase 5 Implementation
