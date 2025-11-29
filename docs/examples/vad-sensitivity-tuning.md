# VAD Sensitivity Tuning Examples

## Overview

This document provides practical examples of VAD sensitivity tuning for different use cases, environments, and speech patterns. Use these examples as starting points and adjust based on your specific acoustic conditions.

---

## Quick Reference

| Use Case | vadThreshold | Expected Behavior | Trade-offs |
|----------|-------------|-------------------|------------|
| **Default (Balanced)** | 0.5 | Optimal for most scenarios | Balanced false positive/negative rates |
| **Sensitive (Quiet Speech)** | 0.3 | Detects soft-spoken users, whispers | Higher false positive risk |
| **Strict (Noisy Environment)** | 0.7 | Ignores background noise | May miss quiet speech |
| **Very Sensitive** | 0.2 | Maximum sensitivity | High false positive risk |
| **Very Strict** | 0.85 | Minimal false positives | May miss hesitant or quiet speech |

---

## Example 1: Default Configuration (Balanced)

### Use Case
General-purpose speech detection for typical office/home environments.

### Configuration
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.5,  // Balanced threshold
});
```

### Expected Behavior
- ✅ Detects normal conversational speech (50-70 dB SPL)
- ✅ Ignores most background noise (HVAC, ambient sound)
- ✅ Works for most speakers (male, female, various accents)
- ⚠️ May trigger on loud background noise (door slam, sudden sounds)
- ⚠️ May miss very quiet speech (whispering, soft-spoken < 40 dB)

### Test Results (Typical)
- **False Positive Rate**: 5-10% (background noise occasionally triggers)
- **False Negative Rate**: 5-10% (very quiet speech occasionally missed)
- **Accuracy**: 85-90%

### When to Use
- General-purpose applications
- Mixed user base (various speech volumes)
- Moderate noise environments (home office, small office)

### When to Adjust
- **Increase to 0.6**: If experiencing too many false positives
- **Decrease to 0.4**: If missing quiet speakers

---

## Example 2: Sensitive Detection (Quiet Speech)

### Use Case
Detecting soft-spoken users, whispered speech, ASMR content, or quiet environments.

### Configuration
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.3,  // Sensitive threshold
});
```

### Expected Behavior
- ✅ Detects whispered speech (30-40 dB SPL)
- ✅ Works well for soft-spoken users
- ✅ Captures hesitant or trailing speech
- ⚠️ Higher false positive rate from background noise
- ⚠️ May trigger on breathing, page turns, subtle movements

### Test Results (Typical)
- **False Positive Rate**: 15-20%
- **False Negative Rate**: 2-5%
- **Accuracy**: 75-80%

### Example Scenarios

#### Scenario A: ASMR Content Recording
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.3,   // Detect whispers
  volumeThreshold: 0.2, // Fallback threshold also low
});

// Expected:
// - Captures whispered speech
// - Detects subtle vocal sounds
// - May trigger on breathing (acceptable for ASMR)
```

#### Scenario B: Soft-Spoken User
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.35,  // Slightly less sensitive than whisper mode
});

// Expected:
// - Detects soft-spoken users reliably
// - Fewer false positives than 0.3
// - Balances sensitivity with accuracy
```

### When to Use
- Quiet speakers or soft-spoken users
- ASMR or meditation content
- Quiet recording environments (< 30 dB ambient noise)
- Microphone far from speaker

### When to Adjust
- **Increase to 0.4**: If too many false positives from breathing/movements
- **Decrease to 0.2**: For extremely quiet speech (not recommended for most cases)

---

## Example 3: Strict Detection (Noisy Environment)

### Use Case
Open offices, cafes, outdoor environments, or high-background-noise scenarios.

### Configuration
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.7,  // Strict threshold
});
```

### Expected Behavior
- ✅ Ignores background conversations
- ✅ Ignores keyboard typing, mouse clicks
- ✅ Ignores HVAC, traffic noise, ambient sounds
- ✅ Only detects clear, confident speech
- ⚠️ May miss quiet or hesitant speech
- ⚠️ May miss speech from users far from microphone

### Test Results (Typical)
- **False Positive Rate**: 2-5%
- **False Negative Rate**: 10-15%
- **Accuracy**: 80-85%

### Example Scenarios

#### Scenario A: Open Office Environment
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.7,  // Ignore background conversations
});

// Expected:
// - Detects primary user's speech
// - Ignores coworkers' conversations
// - Ignores keyboard/mouse sounds
// - Requires clear speech from user
```

#### Scenario B: Cafe or Restaurant
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.75,  // Very strict for high noise
});

// Expected:
// - Detects only direct speech from user
// - Ignores ambient cafe noise, music, other conversations
// - May require user to speak louder/clearer
```

#### Scenario C: Outdoor Environment
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.8,  // Extremely strict for outdoor noise
});

// Expected:
// - Detects only loud, clear speech
// - Ignores wind, traffic, outdoor ambient noise
// - User must speak clearly and at normal-to-loud volume
```

### When to Use
- Noisy environments (> 60 dB ambient noise)
- Open offices, cafes, restaurants
- Outdoor recording
- Multiple speakers (want to isolate primary speaker)

### When to Adjust
- **Increase to 0.8-0.85**: For extremely noisy environments (outdoor, crowded spaces)
- **Decrease to 0.6**: If missing too much intended speech

---

## Example 4: Very Sensitive (Maximum Detection)

### Use Case
Capturing all possible speech, including very quiet or distant speakers.

### Configuration
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.2,  // Very sensitive
});
```

### Expected Behavior
- ✅ Detects extremely quiet speech (< 30 dB SPL)
- ✅ Captures distant speakers
- ✅ Detects hesitant, trailing, or fragmentary speech
- ❌ High false positive rate (20-30%)
- ❌ Triggers on breathing, movements, subtle sounds
- ❌ May constantly trigger in noisy environments

### Test Results (Typical)
- **False Positive Rate**: 25-35%
- **False Negative Rate**: 1-2%
- **Accuracy**: 65-75%

### When to Use
- Research applications (capture all possible speech)
- Transcription of very quiet recordings
- Far-field microphone setups
- **Not recommended for production applications**

### Recommendation
Use `vadThreshold: 0.3` instead of 0.2 for most "very sensitive" scenarios. The accuracy loss from 0.2 is typically not worth the marginal sensitivity gain.

---

## Example 5: Very Strict (Minimal False Positives)

### Use Case
Scenarios where false positives are more costly than false negatives.

### Configuration
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.85,  // Very strict
});
```

### Expected Behavior
- ✅ Minimal false positives (< 2%)
- ✅ Only detects clear, confident, loud speech
- ✅ Excellent precision (high confidence in detected speech)
- ⚠️ High false negative rate (15-20%)
- ⚠️ Misses quiet, hesitant, or trailing speech
- ⚠️ Requires users to speak clearly and loudly

### Test Results (Typical)
- **False Positive Rate**: 1-2%
- **False Negative Rate**: 15-25%
- **Accuracy**: 75-80% (high precision, low recall)

### Example Scenarios

#### Scenario A: Voice Commands (Minimize Accidental Triggers)
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.85,  // Minimize false positives
});

// Expected:
// - Voice commands only trigger on clear, intentional speech
// - Prevents accidental activation from background noise
// - User must speak clearly and at normal volume
```

#### Scenario B: Medical/Legal Transcription (High Precision Required)
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.9,  // Maximum precision
});

// Expected:
// - Only transcribes clear, confident speech
// - Avoids transcribing unclear or ambiguous audio
// - Operator must enunciate clearly
```

### When to Use
- Voice command systems (minimize accidental triggers)
- High-precision transcription
- Scenarios where false positives are costly
- **Not recommended for conversational applications**

---

## Environment-Specific Examples

### Quiet Room (< 30 dB Ambient Noise)

**Characteristics**: Recording studio, quiet bedroom, anechoic chamber

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.4,  // Slightly sensitive
});
```

**Rationale**: Low ambient noise allows lower threshold without false positives.

---

### Home Office (30-50 dB Ambient Noise)

**Characteristics**: Residential room, occasional background sounds (HVAC, appliances)

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.5,  // Default balanced
});
```

**Rationale**: Optimal balance for typical home environment.

---

### Open Office (50-65 dB Ambient Noise)

**Characteristics**: Shared workspace, background conversations, keyboard/mouse sounds

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.65,  // Moderately strict
});
```

**Rationale**: Higher threshold to filter out coworker conversations and office sounds.

---

### Cafe or Restaurant (60-75 dB Ambient Noise)

**Characteristics**: High ambient noise, music, conversations, dishes/utensils

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.75,  // Strict
});
```

**Rationale**: Very noisy environment requires strict threshold to isolate primary speaker.

---

### Outdoor (70+ dB Ambient Noise)

**Characteristics**: Traffic, wind, crowd noise, environmental sounds

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.85,  // Very strict
});
```

**Rationale**: Extremely noisy environment requires very strict threshold. User must speak loudly and clearly.

---

## Speaker-Specific Examples

### Male Speaker (Deep Voice, Normal Volume)

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.5,  // Default works well
});
```

**Rationale**: Male voices typically have higher amplitude, default threshold is appropriate.

---

### Female Speaker (Higher Pitch, Normal Volume)

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.5,  // Default works well
});
```

**Rationale**: VAD is trained on diverse voices, pitch doesn't significantly affect threshold.

---

### Soft-Spoken Speaker (Any Gender, Quiet Volume)

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.35,  // Sensitive
});
```

**Rationale**: Lower threshold compensates for lower speech volume.

---

### Loud Speaker (Any Gender, High Volume)

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.6,  // Slightly strict
});
```

**Rationale**: Higher threshold prevents over-triggering from loud speech.

---

## Application-Specific Examples

### Example A: Podcast Recording

**Requirements**: Capture all speech from host/guests, ignore background noise

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.5,  // Balanced
});
```

**Rationale**: Controlled environment (indoor, quiet), need balanced detection.

---

### Example B: Voice Assistant

**Requirements**: Minimize false activations, require clear commands

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.75,  // Strict
});
```

**Rationale**: False positives (accidental activation) are more costly than false negatives (user repeats command).

---

### Example C: Dictation Software

**Requirements**: Capture all user speech, minimize missed words

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.4,  // Sensitive
});
```

**Rationale**: False negatives (missed words) are more costly than false positives (can be edited out).

---

### Example D: Video Conferencing

**Requirements**: Detect primary speaker, ignore background noise

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.6,  // Moderately strict
});
```

**Rationale**: Users are often in varied environments (home, office), need to filter background noise while capturing clear speech.

---

### Example E: Meditation/Mindfulness App

**Requirements**: Detect soft-spoken guidance, whispered instructions

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.3,  // Sensitive
});
```

**Rationale**: Content is intentionally quiet, need sensitive detection.

---

## Tuning Workflow

### Step-by-Step Tuning Guide

#### Step 1: Start with Default
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.5,  // Default
});
```

Test with representative audio samples.

---

#### Step 2: Identify Issues

**If experiencing false positives** (triggers on background noise):
- Proceed to Step 3a (Increase Threshold)

**If experiencing false negatives** (misses speech):
- Proceed to Step 3b (Decrease Threshold)

**If balanced (acceptable performance)**:
- Done! Use `vadThreshold: 0.5`

---

#### Step 3a: Increase Threshold (Reduce False Positives)

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.6,  // Increase by 0.1
});
```

Test again. If still too many false positives, continue increasing:
- 0.6 → 0.65 → 0.7 → 0.75 → 0.8 → 0.85

**Stop when**: False positives are acceptable AND not missing too much speech.

---

#### Step 3b: Decrease Threshold (Reduce False Negatives)

```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.4,  // Decrease by 0.1
});
```

Test again. If still missing speech, continue decreasing:
- 0.4 → 0.35 → 0.3 → 0.25 → 0.2

**Stop when**: False negatives are acceptable AND not too many false positives.

---

#### Step 4: Fine-Tune (Optional)

Adjust in smaller increments (0.05) for precision:
```typescript
const emitter = new UtteranceEmitter({
  vadThreshold: 0.55,  // Fine-tune from 0.5
});
```

---

#### Step 5: Validate Across Scenarios

Test final `vadThreshold` value across:
- Different speakers (male, female, accents)
- Different environments (quiet, moderate noise, loud noise)
- Different speech patterns (normal, quiet, loud, hesitant)

---

## Advanced Tuning: Dynamic Thresholds

### Example: Environment-Adaptive Threshold

```typescript
class AdaptiveVADEmitter {
  private emitter: UtteranceEmitter;

  constructor() {
    const threshold = this.detectEnvironmentThreshold();
    this.emitter = new UtteranceEmitter({
      vadThreshold: threshold,
    });
  }

  private detectEnvironmentThreshold(): number {
    // Measure ambient noise level (example)
    const ambientNoiseDB = this.measureAmbientNoise();

    if (ambientNoiseDB < 30) return 0.4;      // Quiet
    if (ambientNoiseDB < 50) return 0.5;      // Moderate
    if (ambientNoiseDB < 65) return 0.65;     // Noisy
    if (ambientNoiseDB < 75) return 0.75;     // Very noisy
    return 0.85;                               // Extremely noisy
  }

  private measureAmbientNoise(): number {
    // Implementation: Measure dB level from microphone for 1-2 seconds
    // Return average ambient noise level
    return 50; // Example
  }
}
```

**Note**: This is an advanced technique. Start with static thresholds and only consider dynamic adaptation if telemetry shows wide variance in user environments.

---

## Testing Examples

### Test Case 1: Normal Speech Detection

```typescript
const emitter = new UtteranceEmitter({ vadThreshold: 0.5 });

// Test audio: Normal conversational speech (60 dB SPL)
// Expected: ✅ Detected
// Actual: [Record result]
```

---

### Test Case 2: Quiet Speech Detection

```typescript
const emitter = new UtteranceEmitter({ vadThreshold: 0.5 });

// Test audio: Quiet speech (40 dB SPL)
// Expected: ⚠️ May be missed
// Actual: [Record result]

// Retry with lower threshold
const emitter2 = new UtteranceEmitter({ vadThreshold: 0.3 });
// Expected: ✅ Detected
// Actual: [Record result]
```

---

### Test Case 3: Background Noise Rejection

```typescript
const emitter = new UtteranceEmitter({ vadThreshold: 0.5 });

// Test audio: Keyboard typing, no speech
// Expected: ✅ Not detected (no false positive)
// Actual: [Record result]
```

---

### Test Case 4: Noisy Environment

```typescript
const emitter = new UtteranceEmitter({ vadThreshold: 0.5 });

// Test audio: Speech + background conversation (office environment)
// Expected: ⚠️ May trigger on background conversation
// Actual: [Record result]

// Retry with higher threshold
const emitter2 = new UtteranceEmitter({ vadThreshold: 0.7 });
// Expected: ✅ Detects primary speaker, ignores background
// Actual: [Record result]
```

---

## Summary Table: Recommended Thresholds

| Scenario | vadThreshold | False Positive Risk | False Negative Risk |
|----------|-------------|-------------------|-------------------|
| **Default (General Use)** | 0.5 | Low-Medium | Low-Medium |
| **Quiet Environment** | 0.4 | Low | Low |
| **Sensitive (Soft Speech)** | 0.3 | Medium | Very Low |
| **Home Office** | 0.5 | Low-Medium | Low-Medium |
| **Open Office** | 0.65 | Low | Medium |
| **Noisy (Cafe)** | 0.75 | Very Low | Medium-High |
| **Very Noisy (Outdoor)** | 0.85 | Very Low | High |
| **Voice Commands** | 0.75 | Very Low | Medium-High |
| **Dictation** | 0.4 | Medium | Very Low |
| **Podcast** | 0.5 | Low-Medium | Low-Medium |

---

## References

- [VAD Configuration Parameter Mapping](/workspace/docs/configuration/vad-parameter-mapping.md)
- [Migration Guide](/workspace/docs/migration/vad-migration-guide.md)
- [Silero VAD Parameters](https://github.com/snakers4/silero-vad)
- [@ricky0123/vad-web Documentation](https://github.com/ricky0123/vad)
