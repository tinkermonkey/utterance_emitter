# VAD Migration Guide

## Overview

This guide helps existing UtteranceEmitter users transition from amplitude-based voice activity detection to the new ML-based VAD (Voice Activity Detection) system powered by Silero VAD.

**TL;DR**:
- ✅ **No breaking changes** - Your existing code continues to work
- ✅ **VAD enabled by default** - Improved accuracy out-of-box
- ✅ **Graceful fallback** - Falls back to amplitude-based if VAD fails
- ⚠️ **Bundle size impact** - +1.5MB (mitigated by lazy loading)
- ⚠️ **Initialization delay** - One-time 500-2000ms model load

---

## What's Changing

### Before: Amplitude-Based VAD

```typescript
// Your existing code
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,  // Simple amplitude threshold
});
```

**How it worked**:
1. Analyzes frequency domain audio data
2. Calculates average amplitude
3. Triggers when `average > volumeThreshold`

**Limitations**:
- ❌ False positives from background noise (HVAC, typing, traffic)
- ❌ False negatives from quiet speech
- ❌ No understanding of speech vs. non-speech audio
- ❌ Environment-dependent (same threshold behaves differently in quiet vs. noisy rooms)

---

### After: ML-Based VAD

```typescript
// Your existing code STILL WORKS (no changes required!)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,
});

// But now you can also configure VAD
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,   // Preserved for fallback/visualization
  vadEnabled: true,       // NEW (default)
  vadThreshold: 0.5,      // NEW (default)
  vadFallback: true,      // NEW (default)
});
```

**How it works**:
1. Loads Silero VAD neural network model
2. Analyzes time domain audio with speech-trained model
3. Outputs speech probability [0-1]
4. Triggers when `probability > vadThreshold`

**Improvements**:
- ✅ Ignores background noise (HVAC, keyboard, mouse clicks)
- ✅ Detects quiet speech more reliably
- ✅ Understands speech characteristics (pitch, rhythm, phonemes)
- ✅ Adapts to acoustic environment automatically
- ✅ Graceful fallback if VAD initialization fails

---

## Migration Paths

### Path 1: Zero-Change Migration (Recommended for Most Users)

**Who**: Users satisfied with default behavior, want improved accuracy

**Action**: None required

```typescript
// Before
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,
});

// After (same code!)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,
});
```

**Behavior Changes**:
- VAD is automatically enabled (default: `vadEnabled: true`)
- Improved speech detection accuracy
- One-time 500-2000ms initialization delay when starting stream
- +1.5MB bundle size (lazy-loaded when stream starts)

**Recommended For**:
- General-purpose applications
- Users experiencing false positives/negatives with amplitude-based detection
- Applications where bundle size is not critical

---

### Path 2: Explicit VAD Configuration

**Who**: Users wanting to tune VAD sensitivity for specific environments

**Action**: Add `vadThreshold` parameter

```typescript
// Before
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.7,  // Custom threshold for noisy environment
});

// After
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.7,   // Preserved for fallback
  vadThreshold: 0.7,      // Match existing sensitivity expectation
});
```

**Use Cases**:
- **Noisy environments** (office, cafe): `vadThreshold: 0.7`
- **Quiet speakers**: `vadThreshold: 0.3-0.4`
- **Maximize accuracy**: `vadThreshold: 0.85`

See [Configuration Examples](#configuration-examples) for detailed scenarios.

---

### Path 3: Disable VAD (Bundle Size Sensitive)

**Who**: Users with strict bundle size constraints (< 500KB VAD budget)

**Action**: Set `vadEnabled: false`

```typescript
// Before
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,
});

// After (explicitly disable VAD)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,
  vadEnabled: false,      // Disable VAD (save 1.5MB)
});
```

**Behavior Changes**:
- No bundle size impact (0KB VAD overhead)
- Same amplitude-based detection as before
- No initialization delay
- No accuracy improvements (same limitations as before)

**Recommended For**:
- Applications with hard bundle budget constraints
- Embedded systems with limited storage
- Testing/comparison purposes

---

### Path 4: VAD-Only (No Fallback)

**Who**: Users requiring strict VAD-only operation

**Action**: Set `vadFallback: false`

```typescript
// After (VAD-only, no fallback)
const emitter = new UtteranceEmitter({
  vadEnabled: true,
  vadThreshold: 0.5,
  vadFallback: false,      // Fail if VAD unavailable
});
```

**Behavior Changes**:
- UtteranceEmitter initialization fails if VAD cannot load
- No fallback to amplitude-based detection
- Strict accuracy guarantees (VAD-only)

**Recommended For**:
- Applications with strict accuracy requirements
- Scenarios where degraded detection is worse than failure

---

## Backward Compatibility Guarantees

### API Compatibility

✅ **No Breaking Changes**:
- All existing `EmitterConfig` parameters continue to work
- `volumeThreshold` is preserved and used for fallback/visualization
- New parameters are **optional** with sensible defaults
- Existing code runs without modifications

### Behavior Compatibility

| Aspect | Before VAD | After VAD | Breaking? |
|--------|-----------|-----------|-----------|
| **API** | EmitterConfig interface | Extended interface (backward compatible) | ❌ No |
| **Initialization** | Instant | 500-2000ms model load (async) | ⚠️ Timing change |
| **Speech Detection** | Amplitude-based | VAD-based (default) | ⚠️ Accuracy change |
| **Bundle Size** | 0KB VAD | +1.5MB VAD | ⚠️ Size change |
| **Error Handling** | N/A | Fallback to amplitude-based (default) | ❌ No |
| **Events** | SpeakingEvent | Same SpeakingEvent | ❌ No |

**Breaking Changes**: None

**Non-Breaking Changes**:
1. **Initialization timing**: Model load adds one-time delay (mitigated by async loading)
2. **Detection accuracy**: Improved (fewer false positives/negatives)
3. **Bundle size**: +1.5MB (mitigated by lazy loading)

---

## Configuration Examples

### Example 1: Default Migration (No Code Changes)

```typescript
// Existing code (unchanged)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,
});

// Effective configuration after migration:
// {
//   volumeThreshold: 0.5,
//   vadEnabled: true,      // Automatically enabled
//   vadThreshold: 0.5,     // Default threshold
//   vadFallback: true,     // Graceful degradation
// }
```

**Expected Behavior**:
- ✅ VAD enabled automatically
- ✅ Improved speech detection accuracy
- ✅ Fallback to amplitude-based if VAD fails
- ✅ One-time 500-2000ms initialization delay

---

### Example 2: Noisy Environment Migration

```typescript
// Before (noisy office environment)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.7,  // High threshold to reduce false positives
});

// After (map to equivalent VAD threshold)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.7,   // Preserved for fallback
  vadThreshold: 0.7,      // Higher threshold for noisy environment
});
```

**Expected Improvements**:
- ✅ Ignores keyboard typing, mouse clicks
- ✅ Ignores background conversations
- ✅ Ignores HVAC, ambient noise
- ✅ Detects intended speaker more reliably

---

### Example 3: Quiet Speaker Migration

```typescript
// Before (quiet/soft-spoken user)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.3,  // Low threshold to detect quiet speech
});

// After (map to sensitive VAD threshold)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.3,   // Preserved for fallback
  vadThreshold: 0.3,      // Sensitive threshold for quiet speech
});
```

**Expected Improvements**:
- ✅ Detects whispered or soft speech more reliably
- ✅ Fewer false negatives from quiet speakers
- ⚠️ Slight increase in false positives (trade-off)

---

### Example 4: Bundle-Size-Sensitive Application

```typescript
// Before
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,
});

// After (explicitly disable VAD to save bundle size)
const emitter = new UtteranceEmitter({
  volumeThreshold: 0.5,
  vadEnabled: false,      // Disable VAD (save 1.5MB)
});
```

**Expected Behavior**:
- ✅ Zero bundle size impact
- ✅ Same amplitude-based detection as before
- ⚠️ No accuracy improvements (same limitations)

---

## Bundle Size Impact

### Before VAD

```
Application bundle: ~500KB (example)
UtteranceEmitter: ~50KB
Total: ~550KB
```

### After VAD (With Lazy Loading - Recommended)

```
Initial application bundle: ~550KB (no change!)
VAD module (lazy-loaded when stream starts):
  - ONNX Runtime Web: ~500KB
  - Silero VAD Model: ~1MB
  - Wrapper: ~50KB
  - Total VAD: ~1.5MB

Total download (first recording session):
  - Initial load: 550KB
  - Stream start: 1.5MB
  - Total: ~2MB

Total download (subsequent sessions):
  - Initial load: 550KB (main app)
  - Stream start: 0KB (cached!)
  - Total: ~550KB
```

**Key Points**:
- ✅ Main application bundle **unchanged** (VAD lazy-loaded)
- ✅ VAD downloads **only when user starts recording**
- ✅ VAD cached by browser for all future sessions
- ✅ One-time 1.5MB download per user device

### Mitigation Strategies

1. **Lazy Loading** (default implementation):
   ```typescript
   // VAD loads only when handleStream() is called
   await emitter.handleStream(mediaStream);
   ```

2. **CDN Caching**:
   ```typescript
   const emitter = new UtteranceEmitter({
     vadModelURL: "https://cdn.example.com/silero_vad.onnx",
   });
   ```
   Configure CDN with:
   ```
   Cache-Control: public, max-age=31536000, immutable
   ```

3. **Disable for Bundle-Constrained Apps**:
   ```typescript
   const emitter = new UtteranceEmitter({
     vadEnabled: false,  // Save 1.5MB
   });
   ```

---

## Initialization Timing Changes

### Before VAD

```typescript
const emitter = new UtteranceEmitter({ volumeThreshold: 0.5 });
await emitter.handleStream(mediaStream);  // Instant
// Stream ready immediately
```

**Timing**: < 100ms

---

### After VAD

```typescript
const emitter = new UtteranceEmitter({ vadEnabled: true });
await emitter.handleStream(mediaStream);  // Loads VAD model
// Stream ready after model initialization
```

**Timing**:
- **First call**: 500-2000ms (model download + initialization)
- **Subsequent calls**: ~50ms (model cached, worklet initialization)

### Handling Initialization Delay

**Option 1: Show Loading Indicator**
```typescript
const emitter = new UtteranceEmitter({ vadEnabled: true });

showLoadingIndicator("Initializing voice detection...");

try {
  await emitter.handleStream(mediaStream);
  hideLoadingIndicator();
  console.log("VAD ready");
} catch (error) {
  hideLoadingIndicator();
  console.error("VAD initialization failed, using fallback", error);
}
```

**Option 2: Preload VAD Model**
```typescript
// Preload during application initialization (future enhancement)
await UtteranceEmitter.preloadVAD();

// Later, when user starts recording:
const emitter = new UtteranceEmitter({ vadEnabled: true });
await emitter.handleStream(mediaStream);  // Instant (already loaded)
```

---

## Error Handling

### VAD Initialization Failures

**Possible Causes**:
1. Network failure (model download failed)
2. WASM not supported (very rare)
3. Insufficient memory (model allocation failed)
4. Browser security restrictions (CSP, CORS)

**Default Behavior** (`vadFallback: true`):
```typescript
const emitter = new UtteranceEmitter({
  vadEnabled: true,
  vadFallback: true,  // Default
});

await emitter.handleStream(mediaStream);

// If VAD fails:
// - Console warning: "VAD initialization failed, falling back to amplitude-based detection"
// - Automatic fallback to volumeThreshold detection
// - UtteranceEmitter continues to function normally
```

**Strict Behavior** (`vadFallback: false`):
```typescript
const emitter = new UtteranceEmitter({
  vadEnabled: true,
  vadFallback: false,  // No fallback
});

try {
  await emitter.handleStream(mediaStream);
} catch (error) {
  // VAD initialization failed
  console.error("VAD required but failed to initialize", error);
  // Application must handle this error
}
```

---

## Testing Your Migration

### Verification Checklist

After migrating, verify the following:

- [ ] **Functionality**: Speech detection works as expected
- [ ] **False Positives**: Background noise is ignored (improvement over amplitude-based)
- [ ] **False Negatives**: Quiet speech is detected (improvement over amplitude-based)
- [ ] **Initialization**: One-time delay is acceptable for your UX
- [ ] **Bundle Size**: 1.5MB addition is acceptable (or VAD disabled if not)
- [ ] **Error Handling**: Fallback to amplitude-based detection works if VAD fails
- [ ] **Browser Compatibility**: Tested on Chrome, Firefox, Safari, Edge
- [ ] **Events**: SpeakingEvent emission unchanged
- [ ] **Visualization**: Volume charts still render correctly

### Test Scenarios

#### Test 1: Normal Speech Detection
```typescript
const emitter = new UtteranceEmitter({ vadThreshold: 0.5 });

// Expected:
// - Detects normal conversational speech
// - Ignores background noise
// - Emits SpeakingEvent on speech start/end
```

#### Test 2: Quiet Speech Detection
```typescript
const emitter = new UtteranceEmitter({ vadThreshold: 0.3 });

// Expected:
// - Detects soft-spoken or whispered speech
// - More sensitive than default threshold
```

#### Test 3: Noisy Environment Detection
```typescript
const emitter = new UtteranceEmitter({ vadThreshold: 0.7 });

// Expected:
// - Ignores keyboard typing, mouse clicks
// - Ignores HVAC, ambient noise
// - Only detects clear speech
```

#### Test 4: Fallback Behavior
```typescript
// Simulate VAD failure (e.g., network offline)
const emitter = new UtteranceEmitter({
  vadEnabled: true,
  vadFallback: true,
});

// Expected:
// - Console warning about VAD failure
// - Automatic fallback to amplitude-based detection
// - UtteranceEmitter continues to function
```

---

## Troubleshooting

### Issue: VAD Not Loading

**Symptoms**:
- Initialization delay > 5 seconds
- Console errors about ONNX Runtime or model loading

**Causes**:
1. Network issues (model download failed)
2. CSP (Content Security Policy) blocking WASM
3. CORS restrictions on model URL

**Solutions**:
1. Check network console for failed requests
2. Verify CSP allows `wasm-unsafe-eval`:
   ```html
   <meta http-equiv="Content-Security-Policy"
         content="script-src 'self' 'wasm-unsafe-eval';">
   ```
3. Ensure model URL is CORS-accessible
4. Enable fallback: `vadFallback: true` (default)

---

### Issue: False Positives Still Occurring

**Symptoms**:
- VAD triggers on background noise despite ML-based detection

**Causes**:
1. `vadThreshold` too low for environment
2. Background noise has speech-like characteristics (TV, radio)

**Solutions**:
1. Increase `vadThreshold`:
   ```typescript
   const emitter = new UtteranceEmitter({ vadThreshold: 0.7 });
   ```
2. Test with different threshold values (0.5 → 0.6 → 0.7)
3. If TV/radio in background, VAD correctly detects speech (not a false positive)

---

### Issue: False Negatives (Missed Speech)

**Symptoms**:
- VAD fails to detect quiet or soft-spoken users

**Causes**:
1. `vadThreshold` too high for quiet speakers

**Solutions**:
1. Decrease `vadThreshold`:
   ```typescript
   const emitter = new UtteranceEmitter({ vadThreshold: 0.3 });
   ```
2. Test with quiet speech samples
3. Consider microphone gain/sensitivity settings

---

### Issue: Bundle Size Too Large

**Symptoms**:
- Application load time significantly increased

**Solutions**:
1. **Verify lazy loading** (VAD should not be in main bundle):
   ```typescript
   // Check that VAD loads only when handleStream() is called
   ```

2. **Enable CDN caching**:
   ```typescript
   const emitter = new UtteranceEmitter({
     vadModelURL: "https://cdn.example.com/silero_vad.onnx",
   });
   ```

3. **Disable VAD** if bundle budget is critical:
   ```typescript
   const emitter = new UtteranceEmitter({ vadEnabled: false });
   ```

---

## Rollback Plan

If migration causes issues, you can easily rollback to amplitude-based detection:

```typescript
// Rollback: Disable VAD, use amplitude-based detection
const emitter = new UtteranceEmitter({
  vadEnabled: false,        // Disable VAD
  volumeThreshold: 0.5,     // Use original threshold
});
```

**Effect**:
- ✅ Instant rollback to previous behavior
- ✅ No bundle size impact
- ✅ No initialization delay
- ⚠️ Loses VAD accuracy improvements

---

## Gradual Migration Strategy

For large applications, consider gradual rollout:

### Stage 1: Opt-In (0-20% of users)
```typescript
const vadEnabled = userIsInExperimentGroup();  // 20% of users

const emitter = new UtteranceEmitter({
  vadEnabled,
  vadFallback: true,
});
```

**Monitor**: False positive/negative rates, initialization time, user feedback

---

### Stage 2: Opt-Out (80-100% of users)
```typescript
const vadEnabled = !userOptedOutOfVAD();  // Default enabled, users can opt-out

const emitter = new UtteranceEmitter({
  vadEnabled,
  vadFallback: true,
});
```

**Monitor**: Opt-out rate, support tickets, performance metrics

---

### Stage 3: Full Rollout (100% of users)
```typescript
const emitter = new UtteranceEmitter({
  vadEnabled: true,  // Enabled for all users
  vadFallback: true,
});
```

**Monitor**: Continued monitoring for edge cases

---

## Support and Feedback

### Getting Help

- **Documentation**: [VAD Configuration Parameter Mapping](/workspace/docs/configuration/vad-parameter-mapping.md)
- **Examples**: [Sensitivity Tuning Examples](/workspace/docs/examples/vad-sensitivity-tuning.md)
- **ADR**: [Architecture Decision Record](/workspace/docs/adr/001-vad-library-selection.md)

### Reporting Issues

If you encounter issues during migration:

1. Check [Troubleshooting](#troubleshooting) section
2. Verify your configuration matches [Configuration Examples](#configuration-examples)
3. Test with default values (`vadThreshold: 0.5`)
4. Enable fallback (`vadFallback: true`)
5. Report issue with:
   - EmitterConfig values
   - Browser version
   - Console errors
   - Reproduction steps

---

## Summary

### Key Takeaways

- ✅ **No breaking changes**: Existing code continues to work
- ✅ **VAD enabled by default**: Improved accuracy out-of-box
- ✅ **Graceful fallback**: Falls back to amplitude-based if VAD fails
- ⚠️ **Bundle size**: +1.5MB (mitigated by lazy loading + CDN caching)
- ⚠️ **Initialization**: One-time initialization delay when starting stream

### Recommended Migration Path

1. **Start with defaults** (no code changes)
2. **Monitor behavior** in your environment
3. **Tune vadThreshold** if needed (0.3-0.85 range)
4. **Disable VAD** if bundle size is critical
5. **Report feedback** to improve VAD integration

### Next Steps

1. Review [Configuration Parameter Mapping](/workspace/docs/configuration/vad-parameter-mapping.md)
2. Explore [Sensitivity Tuning Examples](/workspace/docs/examples/vad-sensitivity-tuning.md)
3. Read [Implementation Recommendations](/workspace/docs/implementation/vad-implementation-recommendations.md)
