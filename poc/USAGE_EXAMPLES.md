# VAD Integration Usage Examples

This document provides usage examples for integrating the Silero VAD wrapper with the UtteranceEmitter.

## Example 1: Use VAD with Default Settings

```typescript
import { UtteranceEmitterWithVAD } from './utterance-emitter-vad-integration'

const emitter = new UtteranceEmitterWithVAD({
  vadEnabled: true, // Default
})

await emitter.start() // VAD initializes automatically
```

## Example 2: Custom VAD Configuration

```typescript
import { UtteranceEmitterWithVAD } from './utterance-emitter-vad-integration'

const emitter = new UtteranceEmitterWithVAD({
  vadEnabled: true,
  vadConfig: {
    positiveSpeechThreshold: 0.7, // More conservative (fewer false positives)
    negativeSpeechThreshold: 0.4,
    minSpeechFrames: 15, // 150ms minimum speech
    workletPath: '/custom/path/to/vad.worklet.bundle.min.js', // Optional custom path
  },
  vadFallback: true, // Fall back to amplitude if VAD fails
})

await emitter.start()
```

## Example 3: Disable VAD (Backward Compatible)

```typescript
import { UtteranceEmitterWithVAD } from './utterance-emitter-vad-integration'

const emitter = new UtteranceEmitterWithVAD({
  vadEnabled: false,
  volumeThreshold: 40, // Use amplitude-based detection
})

await emitter.start()
```

## Example 4: Check VAD Status

```typescript
import { UtteranceEmitterWithVAD } from './utterance-emitter-vad-integration'

const emitter = new UtteranceEmitterWithVAD({
  vadEnabled: true,
})

await emitter.start()

const status = emitter.getVADStatus()
console.log({
  enabled: status.enabled,       // true
  ready: status.ready,            // true if VAD initialized successfully
  usingFallback: status.usingFallback, // false if VAD is working
  probability: status.probability, // Current VAD probability [0-1]
})
```

## Example 5: Cleanup and Memory Management

```typescript
import { UtteranceEmitterWithVAD } from './utterance-emitter-vad-integration'

const emitter = new UtteranceEmitterWithVAD({
  vadEnabled: true,
})

await emitter.start()

// ... use the emitter ...

// Clean up when done to prevent memory leaks
emitter.destroy() // Automatically destroys VAD instance and removes all callbacks
```

## Example 6: Custom Worklet Path for Production

```typescript
import { UtteranceEmitterWithVAD } from './utterance-emitter-vad-integration'

const emitter = new UtteranceEmitterWithVAD({
  vadEnabled: true,
  vadConfig: {
    // Use CDN for production
    workletPath: 'https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.7/dist/vad.worklet.bundle.min.js',
  },
})

await emitter.start()
```

## Example 7: Error Handling

```typescript
import { UtteranceEmitterWithVAD } from './utterance-emitter-vad-integration'

const emitter = new UtteranceEmitterWithVAD({
  vadEnabled: true,
  vadFallback: false, // Don't fall back, throw errors
})

try {
  await emitter.start()
  console.log('VAD initialized successfully')
} catch (error) {
  console.error('VAD initialization failed:', error)
  // Handle error (e.g., show user message, use different emitter)
}
```

## Example 8: Direct VAD Wrapper Usage

If you want to use the VAD wrapper independently without UtteranceEmitter:

```typescript
import { SileroVADWrapper } from './vad-wrapper'

const vad = new SileroVADWrapper({
  positiveSpeechThreshold: 0.6,
  negativeSpeechThreshold: 0.4,
  workletPath: '/path/to/vad.worklet.bundle.min.js',
})

// Register callbacks
const onSpeechStart = () => console.log('Speech started')
const onSpeechEnd = () => console.log('Speech ended')
const onProbability = (p: number) => console.log(`Probability: ${p}`)

vad.onSpeechStart(onSpeechStart)
vad.onSpeechEnd(onSpeechEnd)
vad.onProbabilityUpdate(onProbability)

// Initialize and start
await vad.initialize()
await vad.start()

// Later: remove specific listeners to prevent memory leaks
vad.removeSpeechStartListener(onSpeechStart)
vad.removeSpeechEndListener(onSpeechEnd)
vad.removeProbabilityListener(onProbability)

// Clean up when done
vad.destroy()
```
