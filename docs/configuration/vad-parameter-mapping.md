# VAD Configuration Parameter Mapping

**Issue**: #40 - Voice Activity Detection Implementation
**Requirement**: US-8 - Map existing volumeThreshold to VAD library settings
**Date**: 2025-11-29

## Overview

This document maps the existing `volumeThreshold` configuration parameter to the new VAD library settings, identifies equivalent sensitivity/threshold parameters, and documents reasonable default values.

## Current Configuration (Amplitude-Based)

### EmitterConfig Interface (Before VAD)

```typescript
interface EmitterConfig {
  volumeThreshold: number;  // Range: 0-1, Default: 0.5
}
```

### Amplitude-Based Threshold Behavior

The current implementation (`/workspace/src/index.ts:256-335`) uses:

1. **Input**: Frequency domain data from `analyser.getByteFrequencyData()`
2. **Calculation**: Average of all frequency bin magnitudes (normalized 0-255)
3. **Normalization**: `average / 255` → range [0-1]
4. **Threshold Logic**: Speech detected when `average > volumeThreshold`

**Characteristics**:
- **Linear response**: Threshold is directly proportional to audio amplitude
- **No speech modeling**: Pure energy-based detection
- **Environment-dependent**: Same `volumeThreshold` value behaves differently in quiet vs. noisy environments
- **No temporal context**: Each frame evaluated independently

---

## New Configuration (VAD-Enabled)

### Extended EmitterConfig Interface

```typescript
interface EmitterConfig {
  // Existing parameter (preserved for backward compatibility)
  volumeThreshold: number;     // Range: 0-1, Default: 0.5
                               // Used for: visualization, fallback mode

  // New VAD parameters
  vadEnabled?: boolean;        // Default: true
                               // Enable ML-based VAD (recommended)

  vadThreshold?: number;       // Range: 0-1, Default: 0.5
                               // Probability threshold for speech detection

  vadFallback?: boolean;       // Default: true
                               // Fall back to amplitude-based if VAD fails
}
```

### VAD-Based Threshold Behavior

The new VAD implementation uses:

1. **Input**: Time domain PCM audio data (Float32Array)
2. **Calculation**: Silero VAD neural network inference
3. **Output**: Speech probability score [0-1]
4. **Threshold Logic**: Speech detected when `probability > vadThreshold`

**Characteristics**:
- **Non-linear response**: Neural network learns speech patterns from training data
- **Speech modeling**: Distinguishes speech from non-speech audio (HVAC, typing, music)
- **Environment-adaptive**: Probability score is relative to learned speech characteristics
- **Temporal context**: Model considers multiple frames for robust detection

---

## Parameter Mapping

### volumeThreshold → vadThreshold Equivalence

| Use Case | volumeThreshold (Amplitude) | vadThreshold (Probability) | Rationale |
|----------|---------------------------|---------------------------|-----------|
| **Very Sensitive** | 0.2 | 0.3 | Detect quiet speech, high false positive risk |
| **Sensitive** | 0.3 | 0.4 | Good for quiet speakers or soft-spoken users |
| **Balanced (Default)** | 0.5 | 0.5 | Optimal trade-off for most use cases |
| **Strict** | 0.7 | 0.7 | Reduce false positives in noisy environments |
| **Very Strict** | 0.9 | 0.85 | Minimal false positives, may miss quiet speech |

**Important**: These mappings are **approximate guidelines**, not exact equivalents. VAD probability scores have different statistical properties than amplitude averages.

### Migration Strategy

**For existing users migrating from amplitude-based to VAD**:

```typescript
// Before (amplitude-based)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.6,  // User's custom setting
});

// After (VAD-enabled, automatic migration)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.6,     // Preserved for fallback/visualization
  vadEnabled: true,         // VAD enabled by default
  vadThreshold: 0.6,        // Use same value as starting point
  vadFallback: true,        // Graceful degradation
});
```

**Recommendation**: Start with same threshold value, then tune based on observed behavior.

---

## Default Values Justification

### vadThreshold: 0.5 (Default)

**Rationale**:
1. **Balanced Trade-off**: Silero VAD is trained with 0.5 as the decision boundary
2. **Empirical Validation**: @ricky0123/vad-web documentation recommends 0.5 as starting point
3. **User Expectations**: Matches existing `volumeThreshold` default, minimizing migration friction
4. **Production Testing**: Widely deployed with this default across diverse applications

**When to Adjust**:
- **Increase to 0.6-0.7**: Noisy environments (open office, cafes, outdoor)
- **Decrease to 0.3-0.4**: Quiet speakers, ASMR content, soft-spoken users

### vadEnabled: true (Default)

**Rationale**:
1. **Primary Objective**: VAD is the core improvement, should be enabled by default
2. **Graceful Degradation**: `vadFallback: true` ensures reliability even if VAD fails
3. **Opt-Out Philosophy**: Advanced users can disable if bundle size is critical

**When to Disable**:
- Bundle size constraints (< 500KB budget)
- Testing/debugging amplitude-based detection
- Environments where WASM is not supported (rare edge case)

### vadFallback: true (Default)

**Rationale**:
1. **Reliability**: Ensures UtteranceEmitter continues to function even if VAD initialization fails
2. **Network Resilience**: If model download fails, fallback to amplitude-based detection
3. **Browser Compatibility**: WASM support issues trigger automatic fallback
4. **User Experience**: Degraded detection is better than no detection

**When to Disable**:
- Strict requirement for VAD-only operation
- Testing VAD initialization error handling
- Debugging fallback behavior

---

## Configuration Examples

### Example 1: Default Configuration (Recommended)

```typescript
const emitter = new UtteranceEmitter({
  // Use all defaults
});

// Equivalent to:
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,
  vadEnabled: true,
  vadThreshold: 0.5,
  vadFallback: true,
});
```

**Use Case**: General-purpose speech detection, most applications

---

### Example 2: Noisy Environment (Office, Cafe)

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.7,  // Increase threshold to reduce false positives
});
```

**Expected Behavior**:
- ✅ Ignores background conversations
- ✅ Ignores keyboard typing, mouse clicks
- ✅ Ignores HVAC, ambient noise
- ⚠️ May miss very quiet speech

---

### Example 3: Quiet Speaker (Soft-Spoken User)

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.3,  // Decrease threshold to detect quiet speech
});
```

**Expected Behavior**:
- ✅ Detects soft-spoken users
- ✅ Captures whispered speech
- ⚠️ Higher risk of false positives from background noise

---

### Example 4: Maximize Accuracy (Minimal False Positives)

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.85,  // Very strict threshold
});
```

**Expected Behavior**:
- ✅ Minimal false positives
- ✅ Only detects clear, confident speech
- ⚠️ May miss quiet or hesitant speech

---

### Example 5: Bundle Size Sensitive (Disable VAD)

```typescript
const emitter = new UtteranceEmitter({
  vadEnabled: false,      // Disable VAD (save 1.5MB bundle)
  volumeThreshold: 0.5,   // Fall back to amplitude-based
});
```

**Expected Behavior**:
- ✅ Zero VAD bundle overhead
- ⚠️ Amplitude-based detection (lower accuracy)
- ⚠️ False positives from background noise

---

### Example 6: VAD Required (No Fallback)

```typescript
const emitter = new UtteranceEmitter({
  vadEnabled: true,
  vadThreshold: 0.5,
  vadFallback: false,     // Do not fall back to amplitude-based
});
```

**Expected Behavior**:
- ✅ VAD-only operation
- ❌ UtteranceEmitter fails to initialize if VAD loading fails
- **Use Case**: Applications with strict accuracy requirements

---

### Example 7: Migration from Amplitude-Based

```typescript
// User's existing configuration
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.6,  // Custom threshold for their environment
});

// Migration: Keep existing threshold as VAD starting point
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.6,   // Preserved for fallback
  vadThreshold: 0.6,      // Start with same value
  // vadEnabled: true (default)
  // vadFallback: true (default)
});
```

**Recommendation**: Monitor behavior and adjust `vadThreshold` based on observed false positive/negative rates.

---

## Advanced Configuration

### Fine-Tuning VAD Parameters

@ricky0123/vad-web exposes additional parameters (not surfaced in EmitterConfig by default):

```typescript
// Advanced VAD configuration (future enhancement)
interface AdvancedVADConfig {
  vadThreshold: number;           // Speech probability threshold (0-1)
  minSpeechFrames: number;        // Minimum consecutive frames for speech (default: 3)
  redemptionFrames: number;       // Frames to wait before ending speech (default: 8)
  frameSamples: number;           // Samples per VAD frame (512, 1024, 1536)
}
```

**Current Recommendation**: Do NOT expose these parameters in initial implementation. Use sensible defaults from @ricky0123/vad-web.

**Future Enhancement**: Add `advancedVADConfig` option for power users if telemetry shows demand.

---

## Sensitivity Tuning Guide

### Determining Optimal vadThreshold

**Step 1: Start with Default (0.5)**
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.5,
});
```

**Step 2: Monitor False Positives**
- If VAD triggers on background noise, **increase threshold by 0.1**
- Test: `vadThreshold: 0.6`

**Step 3: Monitor False Negatives**
- If VAD misses quiet speech, **decrease threshold by 0.1**
- Test: `vadThreshold: 0.4`

**Step 4: Iterate**
- Adjust in 0.05 increments for fine-tuning
- Test with representative audio samples

**Step 5: Validate**
- Test across different:
  - Speakers (male, female, accents)
  - Environments (quiet, noisy, outdoor)
  - Speech patterns (normal, whispered, shouted)

### Threshold Selection Matrix

| Environment | Typical Noise Level | Recommended vadThreshold |
|-------------|-------------------|------------------------|
| **Recording Studio** | < 20 dB | 0.3 (sensitive) |
| **Quiet Room** | 20-40 dB | 0.4 |
| **Home Office** | 40-50 dB | 0.5 (default) |
| **Open Office** | 50-60 dB | 0.6-0.7 |
| **Cafe, Restaurant** | 60-70 dB | 0.7 |
| **Outdoor, Street** | 70+ dB | 0.75-0.85 |

**Note**: These are guidelines. Actual optimal thresholds depend on specific acoustic characteristics.

---

## Backward Compatibility

### API Compatibility

```typescript
// Existing code (no changes required)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.6,
});

// Behavior:
// - VAD is enabled by default (vadEnabled: true)
// - volumeThreshold is used for fallback and visualization
// - vadThreshold defaults to 0.5 (can be customized)
```

**Guarantee**: Existing code continues to work without modifications.

### Behavior Changes

| Scenario | Before VAD | After VAD | Migration Note |
|----------|-----------|----------|----------------|
| **Quiet speech** | May miss | ✅ Detected | Improved accuracy |
| **Background noise** | False positives | ✅ Ignored | Improved accuracy |
| **Loud non-speech** | False positives | ✅ Ignored | Improved accuracy |
| **Initialization** | Instant | 500-2000ms delay | One-time model load |
| **Bundle size** | 0KB VAD | +1.5MB VAD | Document in migration guide |

**Breaking Change**: None (new parameters are optional)

---

## Configuration Schema

### TypeScript Interface

```typescript
/**
 * Configuration for UtteranceEmitter voice activity detection.
 */
interface EmitterConfig {
  /**
   * Volume threshold for amplitude-based detection.
   * Range: 0-1
   * Default: 0.5
   *
   * Used for:
   * - Visualization (volume graph)
   * - Fallback when VAD is disabled or fails
   */
  volumeThreshold?: number;

  /**
   * Enable ML-based Voice Activity Detection.
   * Default: true
   *
   * When enabled, uses Silero VAD neural network for speech detection.
   * When disabled, falls back to amplitude-based threshold detection.
   *
   * Disable if:
   * - Bundle size is critical (saves 1.5MB)
   * - WASM is not supported (rare edge case)
   */
  vadEnabled?: boolean;

  /**
   * VAD speech probability threshold.
   * Range: 0-1
   * Default: 0.5
   *
   * Higher values (0.6-0.85):
   * - Reduce false positives (stricter detection)
   * - May miss quiet speech
   *
   * Lower values (0.3-0.4):
   * - Detect quiet speech (more sensitive)
   * - Higher risk of false positives
   */
  vadThreshold?: number;

  /**
   * Enable fallback to amplitude-based detection if VAD fails.
   * Default: true
   *
   * When enabled:
   * - If VAD initialization fails, automatically use volumeThreshold
   * - Ensures UtteranceEmitter continues to function
   *
   * Disable only if:
   * - VAD-only operation is required
   * - Application should fail if VAD unavailable
   */
  vadFallback?: boolean;
}
```

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "volumeThreshold": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "default": 0.5,
      "description": "Amplitude threshold for fallback/visualization"
    },
    "vadEnabled": {
      "type": "boolean",
      "default": true,
      "description": "Enable ML-based VAD"
    },
    "vadThreshold": {
      "type": "number",
      "minimum": 0,
      "maximum": 1,
      "default": 0.5,
      "description": "VAD probability threshold"
    },
    "vadFallback": {
      "type": "boolean",
      "default": true,
      "description": "Fall back to amplitude-based if VAD fails"
    }
  }
}
```

---

## Testing Recommendations

### Unit Tests

```typescript
describe("VAD Configuration", () => {
  it("should use default vadThreshold: 0.5", () => {
    const emitter = new UtteranceEmitter({});
    expect(emitter.config.vadThreshold).toBe(0.5);
  });

  it("should respect custom vadThreshold", () => {
    const emitter = new UtteranceEmitter({ vadThreshold: 0.7 });
    expect(emitter.config.vadThreshold).toBe(0.7);
  });

  it("should enable VAD by default", () => {
    const emitter = new UtteranceEmitter({});
    expect(emitter.config.vadEnabled).toBe(true);
  });

  it("should enable fallback by default", () => {
    const emitter = new UtteranceEmitter({});
    expect(emitter.config.vadFallback).toBe(true);
  });
});
```

### Integration Tests

```typescript
describe("VAD Threshold Behavior", () => {
  it("should detect speech with vadThreshold: 0.5", async () => {
    const emitter = new UtteranceEmitter({ vadThreshold: 0.5 });
    // ... test with speech audio sample
  });

  it("should ignore noise with vadThreshold: 0.7", async () => {
    const emitter = new UtteranceEmitter({ vadThreshold: 0.7 });
    // ... test with background noise sample
  });

  it("should fall back to amplitude-based when VAD disabled", async () => {
    const emitter = new UtteranceEmitter({
      vadEnabled: false,
      volumeThreshold: 0.5
    });
    // ... verify amplitude-based detection is used
  });
});
```

---

## References

- [@ricky0123/vad-web Configuration](https://github.com/ricky0123/vad/tree/master/packages/web)
- [Silero VAD Parameters](https://github.com/snakers4/silero-vad#parameters)
- [ADR-001: VAD Library Selection](/workspace/docs/adr/001-vad-library-selection.md)
- [Migration Guide](/workspace/docs/migration/vad-migration-guide.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-29
**Author**: Senior Software Engineer
