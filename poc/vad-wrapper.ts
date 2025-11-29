/**
 * VAD Wrapper - Proof of Concept
 *
 * This module demonstrates integration of @ricky0123/vad-web (Silero VAD) with the
 * existing audio processing pipeline. It provides a clean abstraction over the VAD
 * library with proper error handling and graceful degradation.
 *
 * Bundle Size Impact:
 * - @ricky0123/vad-web: ~50KB (wrapper code)
 * - onnxruntime-web: ~480KB (WASM runtime)
 * - Silero VAD v5 model: ~1.9MB (lazy-loaded)
 * Total: ~2.43MB (vs 500KB initial estimate)
 *
 * Performance Characteristics:
 * - Initialization: 500ms-2s (one-time, async)
 * - Processing latency: 1-5ms per frame (AudioWorklet offloaded)
 * - Memory overhead: ~10-12MB (model + runtime)
 */

import { MicVAD, type MicVADOptions } from "@ricky0123/vad-web"

export interface VADWrapperConfig {
  /**
   * Probability threshold for voice detection [0-1]
   * Lower = more sensitive (more false positives)
   * Higher = less sensitive (more false negatives)
   * Default: 0.5
   */
  positiveSpeechThreshold?: number

  /**
   * Probability threshold for silence detection [0-1]
   * Should be lower than positiveSpeechThreshold
   * Default: 0.35
   */
  negativeSpeechThreshold?: number

  /**
   * Minimum speech duration in milliseconds before triggering
   * Helps filter out transient noises
   * Default: 250ms
   */
  minSpeechFrames?: number

  /**
   * Number of redemption frames after speech ends
   * Prevents premature cutoff during brief pauses
   * Default: 8 frames (~80ms at 10fps)
   */
  redemptionFrames?: number

  /**
   * Whether to use AudioWorklet mode (recommended)
   * Falls back to ScriptProcessorNode if false
   * Default: true
   */
  useWorklet?: boolean
}

export interface VADWrapper {
  /**
   * Asynchronously initialize the VAD model
   * Must be called before processing audio
   * @throws Error if model fails to load
   */
  initialize(): Promise<void>

  /**
   * Start VAD processing on audio stream
   * @param stream MediaStream from getUserMedia()
   */
  start(stream: MediaStream): Promise<void>

  /**
   * Stop VAD processing and release resources
   */
  stop(): Promise<void>

  /**
   * Destroy VAD instance and free all resources
   */
  destroy(): void

  /**
   * Check if VAD is ready to process audio
   */
  isReady: boolean

  /**
   * Register callback for speech start events
   * @param callback Function called when speech begins
   */
  onSpeechStart(callback: () => void): void

  /**
   * Register callback for speech end events
   * @param callback Function called when speech ends
   */
  onSpeechEnd(callback: () => void): void

  /**
   * Register callback for VAD probability updates
   * @param callback Function called with probability [0-1] on each frame
   */
  onProbabilityUpdate(callback: (probability: number) => void): void
}

export class SileroVADWrapper implements VADWrapper {
  private vad: MicVAD | null = null
  private config: Required<VADWrapperConfig>
  private _isReady = false
  private speechStartCallbacks: Array<() => void> = []
  private speechEndCallbacks: Array<() => void> = []
  private probabilityCallbacks: Array<(probability: number) => void> = []
  private initStartTime = 0
  private initEndTime = 0

  constructor(config: VADWrapperConfig = {}) {
    this.config = {
      positiveSpeechThreshold: config.positiveSpeechThreshold ?? 0.5,
      negativeSpeechThreshold: config.negativeSpeechThreshold ?? 0.35,
      minSpeechFrames: config.minSpeechFrames ?? 10,
      redemptionFrames: config.redemptionFrames ?? 8,
      useWorklet: config.useWorklet ?? true,
    }
  }

  get isReady(): boolean {
    return this._isReady
  }

  get initializationTime(): number {
    return this.initEndTime - this.initStartTime
  }

  async initialize(): Promise<void> {
    if (this._isReady) {
      console.warn("[VADWrapper] Already initialized")
      return
    }

    this.initStartTime = performance.now()
    console.log("[VADWrapper] Initializing Silero VAD...")

    try {
      const options: Partial<MicVADOptions> = {
        // Model loading configuration
        ortConfig: (ort) => {
          // Configure ONNX Runtime for optimal browser performance
          ort.env.wasm.numThreads = 1
          ort.env.wasm.simd = true
        },

        // VAD configuration
        positiveSpeechThreshold: this.config.positiveSpeechThreshold,
        negativeSpeechThreshold: this.config.negativeSpeechThreshold,
        minSpeechFrames: this.config.minSpeechFrames,
        redemptionFrames: this.config.redemptionFrames,

        // Processing mode
        workletURL: this.config.useWorklet
          ? "/node_modules/@ricky0123/vad-web/dist/vad.worklet.bundle.min.js"
          : undefined,

        // Event handlers
        onSpeechStart: () => {
          console.log("[VADWrapper] Speech start detected")
          this.speechStartCallbacks.forEach((cb) => cb())
        },

        onSpeechEnd: () => {
          console.log("[VADWrapper] Speech end detected")
          this.speechEndCallbacks.forEach((cb) => cb())
        },

        onFrameProcessed: (probabilities) => {
          // probabilities.isSpeech is the probability [0-1]
          const probability = probabilities.isSpeech
          this.probabilityCallbacks.forEach((cb) => cb(probability))
        },
      }

      // Note: MicVAD.new() automatically loads the model and initializes
      // This is the async step that takes 500ms-2s
      this.vad = await MicVAD.new(options)

      this.initEndTime = performance.now()
      this._isReady = true

      console.log(
        `[VADWrapper] Initialized in ${this.initializationTime.toFixed(0)}ms`
      )
    } catch (error) {
      this.initEndTime = performance.now()
      console.error("[VADWrapper] Initialization failed:", error)
      throw new Error(
        `Failed to initialize VAD: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  async start(stream: MediaStream): Promise<void> {
    if (!this._isReady || !this.vad) {
      throw new Error("VAD not initialized. Call initialize() first.")
    }

    console.log("[VADWrapper] Starting VAD on audio stream")
    await this.vad.start()
  }

  async stop(): Promise<void> {
    if (!this.vad) {
      return
    }

    console.log("[VADWrapper] Stopping VAD")
    this.vad.pause()
  }

  destroy(): void {
    if (!this.vad) {
      return
    }

    console.log("[VADWrapper] Destroying VAD instance")
    this.vad.destroy()
    this.vad = null
    this._isReady = false
    this.speechStartCallbacks = []
    this.speechEndCallbacks = []
    this.probabilityCallbacks = []
  }

  onSpeechStart(callback: () => void): void {
    this.speechStartCallbacks.push(callback)
  }

  onSpeechEnd(callback: () => void): void {
    this.speechEndCallbacks.push(callback)
  }

  onProbabilityUpdate(callback: (probability: number) => void): void {
    this.probabilityCallbacks.push(callback)
  }
}

/**
 * Factory function to create VAD wrapper with error handling
 * Gracefully degrades if VAD initialization fails
 */
export async function createVADWrapper(
  config: VADWrapperConfig = {}
): Promise<VADWrapper | null> {
  const wrapper = new SileroVADWrapper(config)

  try {
    await wrapper.initialize()
    return wrapper
  } catch (error) {
    console.error(
      "[VADWrapper] Failed to create VAD wrapper, falling back to amplitude-based detection:",
      error
    )
    return null
  }
}
