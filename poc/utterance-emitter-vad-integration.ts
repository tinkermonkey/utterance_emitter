/**
 * Proof of Concept: VAD Integration with UtteranceEmitter
 *
 * This demonstrates how to integrate Silero VAD into the existing UtteranceEmitter
 * architecture with minimal breaking changes and graceful fallback.
 *
 * Integration Strategy:
 * 1. Extend EmitterConfig with optional VAD parameters
 * 2. Initialize VAD asynchronously in handleStream()
 * 3. Replace threshold signal calculation (line 276) with VAD probability
 * 4. Maintain existing quiet period filter and visualization
 * 5. Fall back to amplitude-based detection if VAD fails
 */

import { createVADWrapper, type VADWrapper, type VADWrapperConfig } from "./vad-wrapper"
import type { EmitterConfig } from "../src/types/emitter-config"
import type { SpeakingEvent } from "../src/types/events"
import { UtteranceEmitter } from "../src/index"

// ========================================================================
// Configuration Extension
// ========================================================================

/**
 * Extended configuration with VAD options
 * All VAD fields are optional for backward compatibility
 */
export interface EmitterConfigWithVAD extends EmitterConfig {
  /**
   * Enable ML-based Voice Activity Detection
   * Falls back to amplitude-based detection if initialization fails
   * Default: true
   */
  vadEnabled?: boolean

  /**
   * VAD-specific configuration
   * Only used if vadEnabled is true
   */
  vadConfig?: VADWrapperConfig

  /**
   * Whether to use amplitude-based detection as fallback
   * If true and VAD fails, uses volumeThreshold
   * If false and VAD fails, throws error
   * Default: true
   */
  vadFallback?: boolean
}

// ========================================================================
// UtteranceEmitter with VAD Integration
// ========================================================================

export class UtteranceEmitterWithVAD extends UtteranceEmitter {
  private vad: VADWrapper | null = null
  private vadEnabled = false
  private vadReady = false
  private vadProbability = 0 // Current VAD probability [0-1]
  private usingFallback = false

  constructor(config?: EmitterConfigWithVAD) {
    super(config)

    // Default to VAD enabled unless explicitly disabled
    this.vadEnabled = config?.vadEnabled !== false
  }

  /**
   * Extended handleStream to initialize VAD asynchronously
   * Original implementation at /workspace/src/index.ts:145-247
   */
  async handleStream(stream: MediaStream): Promise<void> {
    console.log("[UtteranceEmitterWithVAD] Handling stream")

    // Call parent implementation to set up audio context and analyser
    // (This would need to be refactored to extract initialization logic)

    // Initialize VAD if enabled
    if (this.vadEnabled) {
      await this.initializeVAD(stream)
    } else {
      console.log("[UtteranceEmitterWithVAD] VAD disabled, using amplitude detection")
      this.usingFallback = true
    }

    // Continue with existing stream setup...
    // (MediaRecorder, visualization, etc.)
  }

  /**
   * Initialize VAD with error handling and fallback
   */
  private async initializeVAD(stream: MediaStream): Promise<void> {
    const vadConfig = (this.config as EmitterConfigWithVAD).vadConfig
    const vadFallback = (this.config as EmitterConfigWithVAD).vadFallback !== false

    console.log("[UtteranceEmitterWithVAD] Initializing VAD...")
    const startTime = performance.now()

    try {
      this.vad = await createVADWrapper(vadConfig)

      if (!this.vad) {
        throw new Error("VAD wrapper creation returned null")
      }

      // Register event handlers
      this.vad.onSpeechStart(() => {
        console.log("[UtteranceEmitterWithVAD] VAD speech start")
        // This maps to the existing speaking event
        const event: SpeakingEvent = {
          speaking: true,
          timestamp: Date.now(),
        }
        this.emit("speaking", event)
      })

      this.vad.onSpeechEnd(() => {
        console.log("[UtteranceEmitterWithVAD] VAD speech end")
        const event: SpeakingEvent = {
          speaking: false,
          timestamp: Date.now(),
        }
        this.emit("speaking", event)
      })

      this.vad.onProbabilityUpdate((probability) => {
        this.vadProbability = probability
      })

      // Start VAD processing
      await this.vad.start()

      const initTime = performance.now() - startTime
      console.log(`[UtteranceEmitterWithVAD] VAD initialized in ${initTime.toFixed(0)}ms`)
      this.vadReady = true
      this.usingFallback = false
    } catch (error) {
      console.error("[UtteranceEmitterWithVAD] VAD initialization failed:", error)

      if (vadFallback) {
        console.warn("[UtteranceEmitterWithVAD] Falling back to amplitude-based detection")
        this.usingFallback = true
        this.vadReady = false
      } else {
        throw error
      }
    }
  }

  /**
   * Modified processAudio to use VAD probability instead of amplitude threshold
   * Original implementation at /workspace/src/index.ts:256-335
   */
  processAudio(): void {
    if (!this.analysers) return

    const levelAnalyser = this.analysers.volume
    levelAnalyser.node.getByteFrequencyData(levelAnalyser.dataArray)

    // Calculate average volume (KEEP for visualization)
    let sum = 0
    for (let i = 0; i < levelAnalyser.bufferLength; i++) {
      sum += levelAnalyser.dataArray[i]
    }
    const average = sum / levelAnalyser.bufferLength

    // Store volume data for visualization (KEEP)
    if (this.volumeData.length >= this.maxSignalPoints) {
      this.volumeData.shift()
    }
    this.volumeData.push(average)

    // ========================================================================
    // MODIFIED SECTION: Use VAD probability or fallback to amplitude
    // ========================================================================

    let thresholdSignal: number

    if (this.vadReady && !this.usingFallback) {
      // Use VAD probability
      // vadProbability is updated by VAD onProbabilityUpdate callback
      const vadThreshold = (this.config as EmitterConfigWithVAD).vadConfig?.positiveSpeechThreshold ?? 0.5
      thresholdSignal = this.vadProbability > vadThreshold ? 1 : 0
    } else {
      // Fallback to amplitude-based detection (ORIGINAL LOGIC)
      thresholdSignal = average > this.volumeThreshold ? 1 : 0
    }

    // Store threshold signal for visualization (KEEP)
    if (this.thresholdSignalData.length >= this.maxSignalPoints) {
      this.thresholdSignalData.shift()
    }
    this.thresholdSignalData.push(thresholdSignal)

    // ========================================================================
    // KEEP: Quiet period filter (lines 283-294)
    // This smoothing logic remains unchanged
    // ========================================================================

    if (thresholdSignal === 1) {
      this.aboveThreshold = true
      this.belowThresholdDuration = 0
    } else {
      this.belowThresholdDuration += 16.67 // ~60 FPS
      if (this.belowThresholdDuration >= (this.config.quietPeriod || 400)) {
        this.aboveThreshold = false
      }
    }

    // Store speaking signal (KEEP)
    const speakingSignal = this.aboveThreshold ? 1 : 0

    // Emit speaking events (KEEP - but only if NOT using VAD event handlers)
    // When using VAD, speech start/end events are emitted via callbacks
    if (this.usingFallback) {
      if (
        speakingSignal === 1 &&
        this.speakingSignalData[this.speakingSignalData.length - 1] === 0
      ) {
        const event: SpeakingEvent = {
          speaking: true,
          timestamp: Date.now(),
        }
        this.emit("speaking", event)
      } else if (
        speakingSignal === 0 &&
        this.speakingSignalData[this.speakingSignalData.length - 1] === 1
      ) {
        const event: SpeakingEvent = {
          speaking: false,
          timestamp: Date.now(),
        }
        this.emit("speaking", event)
      }
    }

    if (this.speakingSignalData.length >= this.maxSignalPoints) {
      this.speakingSignalData.shift()
    }
    this.speakingSignalData.push(speakingSignal)

    // Control MediaRecorder based on speaking signal (KEEP)
    if (speakingSignal && this.mediaRecorder?.state === "inactive") {
      console.log("Starting media recorder")
      this.mediaRecorder.start()
    } else if (!speakingSignal && this.mediaRecorder?.state === "recording") {
      console.log("Stopping media recorder")
      this.mediaRecorder.stop()
    }

    this.animationFrameId = requestAnimationFrame(this.processAudio.bind(this))
  }

  /**
   * Clean up VAD resources on destroy
   */
  destroy(): void {
    if (this.vad) {
      this.vad.destroy()
      this.vad = null
    }

    // Call parent destroy
    super.destroy()
  }

  /**
   * Get current VAD status for diagnostics
   */
  getVADStatus(): {
    enabled: boolean
    ready: boolean
    usingFallback: boolean
    probability: number
  } {
    return {
      enabled: this.vadEnabled,
      ready: this.vadReady,
      usingFallback: this.usingFallback,
      probability: this.vadProbability,
    }
  }
}
