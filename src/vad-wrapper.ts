/**
 * VAD Wrapper
 *
 * This module integrates @ricky0123/vad-web (Silero VAD) with the
 * existing audio processing pipeline. It provides a clean abstraction over the VAD
 * library with proper error handling and graceful degradation.
 */

import { MicVAD, type RealTimeVADOptions } from "@ricky0123/vad-web"

// Define locally to avoid deep import issues
interface SpeechProbabilities {
  notSpeech: number;
  isSpeech: number;
}

// Minimal interface for ONNX Runtime configuration
interface Ort {
  env: {
    wasm: {
      numThreads: number
      simd: boolean
      wasmPaths?: string | object
    }
  }
}

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
  minSpeechMs?: number

  /**
   * Number of redemption milliseconds after speech ends
   * Prevents premature cutoff during brief pauses
   * Default: 80ms
   */
  redemptionMs?: number

  /**
   * Whether to use AudioWorklet mode (recommended)
   * Falls back to ScriptProcessorNode if false
   * Default: true
   */
  useWorklet?: boolean

  /**
   * Custom base path for VAD assets (worklet, wasm, onnx)
   * Default: Auto-detects based on environment (node_modules or CDN)
   */
  baseAssetPath?: string
}

export interface VADWrapper {
  /**
   * Asynchronously initialize the VAD model
   * Must be called before processing audio
   * @throws Error if model fails to load
   */
  initialize(): Promise<void>

  /**
   * Start VAD processing
   * Note: MicVAD handles its own stream acquisition via getUserMedia()
   */
  start(): Promise<void>

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

  /**
   * Remove speech start callback
   * @param callback Function to remove
   */
  removeSpeechStartListener(callback: () => void): void

  /**
   * Remove speech end callback
   * @param callback Function to remove
   */
  removeSpeechEndListener(callback: () => void): void

  /**
   * Remove probability update callback
   * @param callback Function to remove
   */
  removeProbabilityListener(callback: (probability: number) => void): void
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
      minSpeechMs: config.minSpeechMs ?? 250,
      redemptionMs: config.redemptionMs ?? 80,
      useWorklet: config.useWorklet ?? true,
      baseAssetPath:
        config.baseAssetPath ??
        this.detectBaseAssetPath(),
    }
  }

  /**
   * Auto-detect base asset path based on environment
   */
  private detectBaseAssetPath(): string {
    // Try to detect if running from node_modules or CDN
    if (typeof window !== "undefined" && window.location) {
      const origin = window.location.origin
      // Default to CDN path for production, node_modules for development
      return origin.includes("localhost") || origin.includes("127.0.0.1")
        ? "/node_modules/@ricky0123/vad-web/dist/"
        : "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.7/dist/"
    }
    return "/node_modules/@ricky0123/vad-web/dist/"
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
      const options: Partial<RealTimeVADOptions> = {
        // Model loading configuration
        ortConfig: (ortInstance: any) => {
          const ort = ortInstance as Ort
          // Configure ONNX Runtime for optimal browser performance
          ort.env.wasm.numThreads = 1
          ort.env.wasm.simd = true
          
          // Set WASM paths if baseAssetPath is provided
          if (this.config.baseAssetPath) {
            ort.env.wasm.wasmPaths = this.config.baseAssetPath
          }
        },

        // VAD configuration
        positiveSpeechThreshold: this.config.positiveSpeechThreshold,
        negativeSpeechThreshold: this.config.negativeSpeechThreshold,
        minSpeechMs: this.config.minSpeechMs,
        redemptionMs: this.config.redemptionMs,

        // Asset configuration
        baseAssetPath: this.config.baseAssetPath,

        // Event handlers
        onSpeechStart: () => {
          console.log("[VADWrapper] Speech start detected")
          this.speechStartCallbacks.forEach((cb) => cb())
        },

        onSpeechEnd: () => {
          console.log("[VADWrapper] Speech end detected")
          this.speechEndCallbacks.forEach((cb) => cb())
        },

        onFrameProcessed: (probabilities: SpeechProbabilities) => {
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

  async start(): Promise<void> {
    if (!this._isReady || !this.vad) {
      throw new Error("VAD not initialized. Call initialize() first.")
    }

    console.log("[VADWrapper] Starting VAD")
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

  removeSpeechStartListener(callback: () => void): void {
    const index = this.speechStartCallbacks.indexOf(callback)
    if (index > -1) {
      this.speechStartCallbacks.splice(index, 1)
    }
  }

  removeSpeechEndListener(callback: () => void): void {
    const index = this.speechEndCallbacks.indexOf(callback)
    if (index > -1) {
      this.speechEndCallbacks.splice(index, 1)
    }
  }

  removeProbabilityListener(callback: (probability: number) => void): void {
    const index = this.probabilityCallbacks.indexOf(callback)
    if (index > -1) {
      this.probabilityCallbacks.splice(index, 1)
    }
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
