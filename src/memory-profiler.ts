/**
 * Memory profiling and leak detection for VAD integration
 * Tests memory usage patterns during continuous recording sessions
 */

export interface MemorySnapshot {
  timestamp: number // ms from session start
  usedJSHeapSize: number // bytes
  totalJSHeapSize: number // bytes
  jsHeapSizeLimit: number // bytes
}

export interface MemoryTrend {
  startSnapshot: MemorySnapshot
  endSnapshot: MemorySnapshot
  duration: number // ms
  heapGrowth: number // bytes
  heapGrowthRate: number // bytes per second
  growthPercentage: number // percentage
}

export interface LeakDetectionResult {
  sessionDuration: number // ms
  snapshots: MemorySnapshot[]
  trend: MemoryTrend
  leakDetected: boolean
  leakConfidence: 'high' | 'medium' | 'low' | 'none'
  analysis: {
    averageGrowthRate: number // bytes/sec
    maxHeapSize: number // bytes
    minHeapSize: number // bytes
    heapSizeRange: number // bytes
    garbageCollectionObserved: boolean
  }
  recommendation: string
}

export class MemoryProfiler {
  private snapshots: MemorySnapshot[] = []
  private startTime: number = 0
  private monitoring: boolean = false
  private snapshotInterval?: number

  // Thresholds for leak detection
  private static readonly LEAK_GROWTH_THRESHOLD_PERCENT = 20 // 20% growth indicates potential leak
  private static readonly LEAK_GROWTH_RATE_THRESHOLD = 10 * 1024 // 10 KB/sec sustained growth
  private static readonly SNAPSHOT_INTERVAL_MS = 1000 // Take snapshot every second
  private static readonly MIN_MONITORING_DURATION_MS = 5 * 60 * 1000 // 5 minutes minimum

  /**
   * Start memory profiling
   */
  start(): void {
    if (this.monitoring) {
      console.warn('MemoryProfiler already started')
      return
    }

    if (!this.isMemoryAPIAvailable()) {
      throw new Error('Performance.memory API not available in this browser')
    }

    this.monitoring = true
    this.startTime = performance.now()
    this.snapshots = []

    // Take initial snapshot
    this.takeSnapshot()

    // Set up periodic snapshots
    this.snapshotInterval = window.setInterval(() => {
      this.takeSnapshot()
    }, MemoryProfiler.SNAPSHOT_INTERVAL_MS)

    console.log('MemoryProfiler started')
  }

  /**
   * Stop memory profiling and analyze results
   */
  stop(): LeakDetectionResult {
    if (!this.monitoring) {
      throw new Error('MemoryProfiler not started')
    }

    this.monitoring = false

    // Clear interval
    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval)
      this.snapshotInterval = undefined
    }

    // Take final snapshot
    this.takeSnapshot()

    const sessionDuration = performance.now() - this.startTime

    // Analyze memory trend
    const trend = this.calculateTrend()

    // Detect leaks
    const leakDetected = this.detectLeak(trend, sessionDuration)
    const leakConfidence = this.assessLeakConfidence(trend, sessionDuration)

    // Analyze memory patterns
    const analysis = this.analyzeMemoryPattern()

    // Generate recommendation
    const recommendation = this.generateRecommendation(leakDetected, leakConfidence, trend)

    const result: LeakDetectionResult = {
      sessionDuration,
      snapshots: this.snapshots,
      trend,
      leakDetected,
      leakConfidence,
      analysis,
      recommendation,
    }

    console.log('MemoryProfiler stopped. Result:', result)

    return result
  }

  /**
   * Take a memory snapshot
   */
  private takeSnapshot(): void {
    if (!this.monitoring) return

    const memoryInfo = (performance as any).memory
    if (!memoryInfo) return

    const snapshot: MemorySnapshot = {
      timestamp: performance.now() - this.startTime,
      usedJSHeapSize: memoryInfo.usedJSHeapSize,
      totalJSHeapSize: memoryInfo.totalJSHeapSize,
      jsHeapSizeLimit: memoryInfo.jsHeapSizeLimit,
    }

    this.snapshots.push(snapshot)
  }

  /**
   * Calculate overall memory trend
   */
  private calculateTrend(): MemoryTrend {
    if (this.snapshots.length < 2) {
      throw new Error('Not enough snapshots to calculate trend')
    }

    const startSnapshot = this.snapshots[0]
    const endSnapshot = this.snapshots[this.snapshots.length - 1]
    const duration = endSnapshot.timestamp - startSnapshot.timestamp

    const heapGrowth = endSnapshot.usedJSHeapSize - startSnapshot.usedJSHeapSize
    const heapGrowthRate = duration > 0 ? (heapGrowth / duration) * 1000 : 0 // bytes per second
    const growthPercentage =
      startSnapshot.usedJSHeapSize > 0
        ? (heapGrowth / startSnapshot.usedJSHeapSize) * 100
        : 0

    return {
      startSnapshot,
      endSnapshot,
      duration,
      heapGrowth,
      heapGrowthRate,
      growthPercentage,
    }
  }

  /**
   * Detect if there's a memory leak
   */
  private detectLeak(trend: MemoryTrend, sessionDuration: number): boolean {
    // Not enough data for reliable leak detection
    if (sessionDuration < MemoryProfiler.MIN_MONITORING_DURATION_MS) {
      console.warn(
        `Session duration (${(sessionDuration / 1000).toFixed(0)}s) is less than minimum (${(MemoryProfiler.MIN_MONITORING_DURATION_MS / 1000).toFixed(0)}s) for reliable leak detection`
      )
      return false
    }

    // Check for sustained growth
    const sustainedGrowth = trend.heapGrowthRate > MemoryProfiler.LEAK_GROWTH_RATE_THRESHOLD

    // Check for significant percentage growth
    const significantGrowth =
      trend.growthPercentage > MemoryProfiler.LEAK_GROWTH_THRESHOLD_PERCENT

    // Leak detected if both conditions are met
    return sustainedGrowth && significantGrowth
  }

  /**
   * Assess confidence level of leak detection
   */
  private assessLeakConfidence(
    trend: MemoryTrend,
    sessionDuration: number
  ): 'high' | 'medium' | 'low' | 'none' {
    if (!this.detectLeak(trend, sessionDuration)) {
      return 'none'
    }

    // Check for garbage collection events (drops in heap size)
    const gcObserved = this.detectGarbageCollection()

    // High confidence: sustained growth even after GC
    if (trend.growthPercentage > 50 && gcObserved) {
      return 'high'
    }

    // Medium confidence: significant growth with GC
    if (trend.growthPercentage > 30 || trend.heapGrowthRate > 50 * 1024) {
      return 'medium'
    }

    // Low confidence: borderline growth
    return 'low'
  }

  /**
   * Analyze memory usage patterns
   */
  private analyzeMemoryPattern(): LeakDetectionResult['analysis'] {
    const heapSizes = this.snapshots.map((s) => s.usedJSHeapSize)
    const maxHeapSize = Math.max(...heapSizes)
    const minHeapSize = Math.min(...heapSizes)
    const heapSizeRange = maxHeapSize - minHeapSize

    // Calculate average growth rate across all snapshots
    let totalGrowth = 0
    let totalDuration = 0

    for (let i = 1; i < this.snapshots.length; i++) {
      const prev = this.snapshots[i - 1]
      const curr = this.snapshots[i]
      const growth = curr.usedJSHeapSize - prev.usedJSHeapSize
      const duration = curr.timestamp - prev.timestamp

      totalGrowth += growth
      totalDuration += duration
    }

    const averageGrowthRate = totalDuration > 0 ? (totalGrowth / totalDuration) * 1000 : 0

    const garbageCollectionObserved = this.detectGarbageCollection()

    return {
      averageGrowthRate,
      maxHeapSize,
      minHeapSize,
      heapSizeRange,
      garbageCollectionObserved,
    }
  }

  /**
   * Detect if garbage collection occurred (drop in heap size)
   */
  private detectGarbageCollection(): boolean {
    for (let i = 1; i < this.snapshots.length; i++) {
      const prev = this.snapshots[i - 1]
      const curr = this.snapshots[i]

      // Significant drop in heap size indicates GC
      const drop = prev.usedJSHeapSize - curr.usedJSHeapSize
      const dropPercentage = (drop / prev.usedJSHeapSize) * 100

      if (dropPercentage > 5) {
        // 5% drop threshold
        return true
      }
    }

    return false
  }

  /**
   * Generate recommendation based on leak detection
   */
  private generateRecommendation(
    leakDetected: boolean,
    confidence: string,
    trend: MemoryTrend
  ): string {
    if (!leakDetected) {
      return 'No memory leaks detected. Memory usage is stable.'
    }

    const recommendations: string[] = [
      `Memory leak detected with ${confidence} confidence.`,
      `Heap grew by ${(trend.heapGrowth / 1024 / 1024).toFixed(2)} MB (${trend.growthPercentage.toFixed(2)}%) during session.`,
      'Recommendations:',
    ]

    if (trend.heapGrowthRate > 50 * 1024) {
      recommendations.push(
        '- High growth rate detected. Check for event listeners not being removed.'
      )
      recommendations.push('- Verify VAD resources are properly released in stop() method.')
    }

    if (trend.growthPercentage > 30) {
      recommendations.push(
        '- Significant heap growth. Check for accumulating audio buffers or data arrays.'
      )
      recommendations.push('- Review signal data arrays (volumeData, etc.) for unbounded growth.')
    }

    recommendations.push('- Run profiler with Chrome DevTools for detailed analysis.')
    recommendations.push('- Check for closures capturing large objects.')

    return recommendations.join('\n')
  }

  /**
   * Check if memory API is available
   */
  private isMemoryAPIAvailable(): boolean {
    return typeof (performance as any).memory !== 'undefined'
  }

  /**
   * Format leak detection result as human-readable string
   */
  static formatResult(result: LeakDetectionResult): string {
    const lines: string[] = [
      '========================================',
      'Memory Leak Detection Report',
      '========================================',
      `Session Duration: ${(result.sessionDuration / 1000).toFixed(2)}s`,
      `Snapshots Taken: ${result.snapshots.length}`,
      '',
      'Memory Trend:',
      `  Initial Heap: ${(result.trend.startSnapshot.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      `  Final Heap: ${(result.trend.endSnapshot.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
      `  Heap Growth: ${(result.trend.heapGrowth / 1024 / 1024).toFixed(2)} MB (${result.trend.growthPercentage.toFixed(2)}%)`,
      `  Growth Rate: ${(result.trend.heapGrowthRate / 1024).toFixed(2)} KB/sec`,
      '',
      'Analysis:',
      `  Max Heap: ${(result.analysis.maxHeapSize / 1024 / 1024).toFixed(2)} MB`,
      `  Min Heap: ${(result.analysis.minHeapSize / 1024 / 1024).toFixed(2)} MB`,
      `  Range: ${(result.analysis.heapSizeRange / 1024 / 1024).toFixed(2)} MB`,
      `  Avg Growth Rate: ${(result.analysis.averageGrowthRate / 1024).toFixed(2)} KB/sec`,
      `  GC Observed: ${result.analysis.garbageCollectionObserved ? 'YES' : 'NO'}`,
      '',
      'Leak Detection:',
      `  Leak Detected: ${result.leakDetected ? 'YES' : 'NO'}`,
      `  Confidence: ${result.leakConfidence.toUpperCase()}`,
      '',
      'Recommendation:',
      result.recommendation,
      '========================================',
    ]

    return lines.join('\n')
  }

  /**
   * Export result as JSON
   */
  static exportResult(result: LeakDetectionResult): string {
    return JSON.stringify(result, null, 2)
  }

  /**
   * Check if browser supports memory profiling
   */
  static checkSupport(): boolean {
    return typeof (performance as any).memory !== 'undefined'
  }
}
