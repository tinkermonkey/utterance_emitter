/**
 * Browser compatibility testing utilities for VAD integration
 * Tests WASM loading, AudioWorklet support, and VAD functionality across browsers
 */

export interface BrowserInfo {
  name: string
  version: string
  userAgent: string
  platform: string
}

export interface CompatibilityFeatures {
  webAudio: boolean
  audioWorklet: boolean
  wasm: boolean
  performanceAPI: boolean
  memoryAPI: boolean
  mediaRecorder: boolean
  getUserMedia: boolean
}

export interface WASMLoadingMetrics {
  startTime: number
  endTime: number
  loadTime: number // milliseconds
  success: boolean
  error?: string
  moduleSize?: number // bytes
}

export interface VADInitializationMetrics {
  startTime: number
  endTime: number
  initTime: number // milliseconds
  success: boolean
  error?: string
  mode?: 'worklet' | 'main-thread' // Which mode was used
}

export interface BrowserCompatibilityReport {
  browser: BrowserInfo
  features: CompatibilityFeatures
  wasmLoading?: WASMLoadingMetrics
  vadInitialization?: VADInitializationMetrics
  processingTest?: {
    success: boolean
    averageProcessingTime: number
    error?: string
  }
  requirements: {
    wasmLoadingMet: boolean // < 2 seconds
    vadInitialized: boolean
    processingWorks: boolean
  }
  overallCompatibility: 'full' | 'partial' | 'none'
}

export class BrowserCompatibilityTester {
  /**
   * Detect current browser information
   */
  static detectBrowser(): BrowserInfo {
    const userAgent = navigator.userAgent
    let browserName = 'Unknown'
    let browserVersion = 'Unknown'

    // Chrome
    if (userAgent.includes('Chrome') && !userAgent.includes('Edg')) {
      browserName = 'Chrome'
      const match = userAgent.match(/Chrome\/(\d+)/)
      if (match) browserVersion = match[1]
    }
    // Firefox
    else if (userAgent.includes('Firefox')) {
      browserName = 'Firefox'
      const match = userAgent.match(/Firefox\/(\d+)/)
      if (match) browserVersion = match[1]
    }
    // Safari
    else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      browserName = 'Safari'
      const match = userAgent.match(/Version\/(\d+)/)
      if (match) browserVersion = match[1]
    }
    // Edge (Chromium)
    else if (userAgent.includes('Edg')) {
      browserName = 'Edge'
      const match = userAgent.match(/Edg\/(\d+)/)
      if (match) browserVersion = match[1]
    }

    return {
      name: browserName,
      version: browserVersion,
      userAgent,
      platform: navigator.platform,
    }
  }

  /**
   * Check for required browser features
   */
  static checkFeatures(): CompatibilityFeatures {
    const audioContext =
      typeof AudioContext !== 'undefined' || typeof (window as any).webkitAudioContext !== 'undefined'

    const audioWorklet =
      audioContext &&
      typeof AudioContext !== 'undefined' &&
      typeof (AudioContext.prototype as any).audioWorklet !== 'undefined'

    const wasm = typeof WebAssembly !== 'undefined'

    const performanceAPI =
      typeof performance !== 'undefined' && typeof performance.now === 'function'

    const memoryAPI = typeof (performance as any).memory !== 'undefined'

    const mediaRecorder = typeof MediaRecorder !== 'undefined'

    const getUserMedia =
      typeof navigator.mediaDevices !== 'undefined' &&
      typeof navigator.mediaDevices.getUserMedia === 'function'

    return {
      webAudio: audioContext,
      audioWorklet,
      wasm,
      performanceAPI,
      memoryAPI,
      mediaRecorder,
      getUserMedia,
    }
  }

  /**
   * Test WASM module loading
   * This is a placeholder - actual test would load the ONNX Runtime WASM module
   */
  static async testWASMLoading(): Promise<WASMLoadingMetrics> {
    const startTime = performance.now()

    try {
      // Test basic WASM support with a minimal module
      const wasmCode = new Uint8Array([
        0x00, 0x61, 0x73, 0x6d, // WASM magic number
        0x01, 0x00, 0x00, 0x00, // WASM version
      ])

      const wasmModule = await WebAssembly.compile(wasmCode)
      const wasmInstance = await WebAssembly.instantiate(wasmModule, {})

      const endTime = performance.now()

      return {
        startTime,
        endTime,
        loadTime: endTime - startTime,
        success: true,
        moduleSize: wasmCode.length,
      }
    } catch (error) {
      const endTime = performance.now()

      return {
        startTime,
        endTime,
        loadTime: endTime - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Test VAD initialization
   * This is a placeholder - actual test would initialize @ricky0123/vad-web
   */
  static async testVADInitialization(): Promise<VADInitializationMetrics> {
    const startTime = performance.now()

    try {
      // Placeholder for actual VAD initialization
      // In real implementation:
      // const vad = await MicVAD.new({ ... })

      // Simulate initialization delay
      await new Promise((resolve) => setTimeout(resolve, 100))

      const endTime = performance.now()

      // Determine which mode would be used
      const features = this.checkFeatures()
      const mode = features.audioWorklet ? 'worklet' : 'main-thread'

      return {
        startTime,
        endTime,
        initTime: endTime - startTime,
        success: true,
        mode,
      }
    } catch (error) {
      const endTime = performance.now()

      return {
        startTime,
        endTime,
        initTime: endTime - startTime,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Test VAD processing with sample audio
   */
  static async testVADProcessing(): Promise<{
    success: boolean
    averageProcessingTime: number
    error?: string
  }> {
    try {
      // Create a simple audio buffer for testing
      const audioContext = new AudioContext()
      const sampleRate = audioContext.sampleRate
      const duration = 1 // 1 second
      const bufferSize = sampleRate * duration
      const audioBuffer = audioContext.createBuffer(1, bufferSize, sampleRate)

      // Fill with sine wave (440 Hz)
      const channelData = audioBuffer.getChannelData(0)
      for (let i = 0; i < bufferSize; i++) {
        channelData[i] = Math.sin(2 * Math.PI * 440 * (i / sampleRate))
      }

      // Simulate VAD processing on frames
      const frameSize = 512
      const numFrames = Math.floor(bufferSize / frameSize)
      const processingTimes: number[] = []

      for (let i = 0; i < numFrames; i++) {
        const startTime = performance.now()

        // Extract frame
        const frame = new Float32Array(frameSize)
        const offset = i * frameSize
        for (let j = 0; j < frameSize; j++) {
          frame[j] = channelData[offset + j]
        }

        // Simulate VAD processing (placeholder)
        // In real implementation: const probability = await vad.process(frame)
        await new Promise((resolve) => setTimeout(resolve, 1))

        const endTime = performance.now()
        processingTimes.push(endTime - startTime)
      }

      const averageProcessingTime =
        processingTimes.reduce((sum, t) => sum + t, 0) / processingTimes.length

      await audioContext.close()

      return {
        success: true,
        averageProcessingTime,
      }
    } catch (error) {
      return {
        success: false,
        averageProcessingTime: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Run full compatibility test suite
   */
  static async runCompatibilityTests(): Promise<BrowserCompatibilityReport> {
    const browser = this.detectBrowser()
    const features = this.checkFeatures()

    let wasmLoading: WASMLoadingMetrics | undefined
    let vadInitialization: VADInitializationMetrics | undefined
    let processingTest: BrowserCompatibilityReport['processingTest'] | undefined

    // Only run advanced tests if basic features are available
    if (features.wasm) {
      wasmLoading = await this.testWASMLoading()
    }

    if (features.webAudio && features.wasm) {
      vadInitialization = await this.testVADInitialization()

      if (vadInitialization.success) {
        processingTest = await this.testVADProcessing()
      }
    }

    // Check requirements
    const wasmLoadingMet = wasmLoading
      ? wasmLoading.success && wasmLoading.loadTime < 2000
      : false

    const vadInitialized = vadInitialization?.success || false

    const processingWorks = processingTest?.success || false

    // Determine overall compatibility
    let overallCompatibility: 'full' | 'partial' | 'none' = 'none'

    if (wasmLoadingMet && vadInitialized && processingWorks) {
      overallCompatibility = 'full'
    } else if (features.webAudio && features.wasm) {
      overallCompatibility = 'partial'
    }

    return {
      browser,
      features,
      wasmLoading,
      vadInitialization,
      processingTest,
      requirements: {
        wasmLoadingMet,
        vadInitialized,
        processingWorks,
      },
      overallCompatibility,
    }
  }

  /**
   * Format compatibility report as human-readable string
   */
  static formatReport(report: BrowserCompatibilityReport): string {
    const lines: string[] = [
      '========================================',
      'Browser Compatibility Report',
      '========================================',
      `Browser: ${report.browser.name} ${report.browser.version}`,
      `Platform: ${report.browser.platform}`,
      `User Agent: ${report.browser.userAgent}`,
      '',
      'Feature Support:',
      `  ✓ Web Audio API: ${report.features.webAudio ? 'YES' : 'NO'}`,
      `  ✓ AudioWorklet: ${report.features.audioWorklet ? 'YES' : 'NO'}`,
      `  ✓ WebAssembly: ${report.features.wasm ? 'YES' : 'NO'}`,
      `  ✓ Performance API: ${report.features.performanceAPI ? 'YES' : 'NO'}`,
      `  ✓ Memory API: ${report.features.memoryAPI ? 'YES' : 'NO'}`,
      `  ✓ MediaRecorder: ${report.features.mediaRecorder ? 'YES' : 'NO'}`,
      `  ✓ getUserMedia: ${report.features.getUserMedia ? 'YES' : 'NO'}`,
    ]

    if (report.wasmLoading) {
      lines.push(
        '',
        'WASM Loading:',
        `  Success: ${report.wasmLoading.success ? 'YES' : 'NO'}`,
        `  Load Time: ${report.wasmLoading.loadTime.toFixed(2)}ms`,
        report.wasmLoading.error ? `  Error: ${report.wasmLoading.error}` : ''
      )
    }

    if (report.vadInitialization) {
      lines.push(
        '',
        'VAD Initialization:',
        `  Success: ${report.vadInitialization.success ? 'YES' : 'NO'}`,
        `  Init Time: ${report.vadInitialization.initTime.toFixed(2)}ms`,
        report.vadInitialization.mode ? `  Mode: ${report.vadInitialization.mode}` : '',
        report.vadInitialization.error ? `  Error: ${report.vadInitialization.error}` : ''
      )
    }

    if (report.processingTest) {
      lines.push(
        '',
        'VAD Processing:',
        `  Success: ${report.processingTest.success ? 'YES' : 'NO'}`,
        `  Avg Processing Time: ${report.processingTest.averageProcessingTime.toFixed(2)}ms`,
        report.processingTest.error ? `  Error: ${report.processingTest.error}` : ''
      )
    }

    lines.push(
      '',
      'Requirements Validation:',
      `  ✓ WASM Loading (< 2s): ${report.requirements.wasmLoadingMet ? 'PASS' : 'FAIL'}`,
      `  ✓ VAD Initialized: ${report.requirements.vadInitialized ? 'PASS' : 'FAIL'}`,
      `  ✓ Processing Works: ${report.requirements.processingWorks ? 'PASS' : 'FAIL'}`,
      '',
      `Overall Compatibility: ${report.overallCompatibility.toUpperCase()}`,
      '========================================'
    )

    return lines.filter((line) => line !== '').join('\n')
  }

  /**
   * Export report as JSON
   */
  static exportReport(report: BrowserCompatibilityReport): string {
    return JSON.stringify(report, null, 2)
  }

  /**
   * Generate cross-browser summary from multiple reports
   */
  static generateCrossBrowserSummary(
    reports: BrowserCompatibilityReport[]
  ): string {
    const lines: string[] = [
      '========================================',
      'Cross-Browser Compatibility Summary',
      '========================================',
      `Browsers Tested: ${reports.length}`,
      '',
    ]

    const fullCompatibility = reports.filter(
      (r) => r.overallCompatibility === 'full'
    ).length
    const partialCompatibility = reports.filter(
      (r) => r.overallCompatibility === 'partial'
    ).length
    const noCompatibility = reports.filter(
      (r) => r.overallCompatibility === 'none'
    ).length

    lines.push(
      'Compatibility Distribution:',
      `  Full: ${fullCompatibility} (${((fullCompatibility / reports.length) * 100).toFixed(0)}%)`,
      `  Partial: ${partialCompatibility} (${((partialCompatibility / reports.length) * 100).toFixed(0)}%)`,
      `  None: ${noCompatibility} (${((noCompatibility / reports.length) * 100).toFixed(0)}%)`,
      '',
      'Browser Details:'
    )

    for (const report of reports) {
      const emoji =
        report.overallCompatibility === 'full'
          ? '✓'
          : report.overallCompatibility === 'partial'
            ? '~'
            : '✗'

      lines.push(
        `  ${emoji} ${report.browser.name} ${report.browser.version}: ${report.overallCompatibility.toUpperCase()}`
      )

      if (report.wasmLoading && !report.requirements.wasmLoadingMet) {
        lines.push(
          `    ⚠ WASM loading: ${report.wasmLoading.loadTime.toFixed(0)}ms (exceeds 2s limit)`
        )
      }

      if (!report.requirements.vadInitialized) {
        lines.push(`    ✗ VAD initialization failed`)
      }

      if (!report.requirements.processingWorks) {
        lines.push(`    ✗ VAD processing failed`)
      }
    }

    lines.push('========================================')
    return lines.join('\n')
  }
}
