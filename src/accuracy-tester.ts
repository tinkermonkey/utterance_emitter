/**
 * Accuracy testing framework for comparing VAD implementations
 * Tests false positive and false negative rates under various conditions
 */

export interface AudioTestCase {
  name: string
  description: string
  audioFile: string // Path to test audio file
  expectedSegments: SpeechSegment[] // Ground truth speech segments
  noiseCondition: 'quiet' | 'normal' | 'noisy'
}

export interface SpeechSegment {
  startTime: number // Milliseconds from start
  endTime: number // Milliseconds from start
  isSpeech: boolean // true = speech, false = silence
}

export interface DetectionResult {
  timestamp: number
  detected: boolean // Whether speech was detected
  expected: boolean // Whether speech was expected (ground truth)
  volume?: number // Volume level (for amplitude-based)
  vadProbability?: number // VAD probability (for ML-based)
}

export interface AccuracyMetrics {
  truePositives: number // Correctly detected speech
  trueNegatives: number // Correctly detected silence
  falsePositives: number // Incorrectly detected speech (noise)
  falseNegatives: number // Missed speech
  precision: number // TP / (TP + FP)
  recall: number // TP / (TP + FN)
  f1Score: number // Harmonic mean of precision and recall
  accuracy: number // (TP + TN) / total
}

export interface ComparisonReport {
  testCase: AudioTestCase
  amplitudeBasedMetrics: AccuracyMetrics
  vadBasedMetrics?: AccuracyMetrics
  improvement: {
    precisionDelta: number
    recallDelta: number
    f1ScoreDelta: number
    falsePositiveReduction: number
    falseNegativeReduction: number
  }
  detectionResults: {
    amplitude: DetectionResult[]
    vad?: DetectionResult[]
  }
}

export class AccuracyTester {
  private testCases: AudioTestCase[] = []

  /**
   * Add a test case to the suite
   */
  addTestCase(testCase: AudioTestCase): void {
    this.testCases.push(testCase)
  }

  /**
   * Create standard test cases for VAD evaluation
   *
   * NOTE: Test audio files should be created per docs/TEST_AUDIO_GUIDE.md
   * and placed in the test_data/ directory. Update paths below if needed.
   */
  static createStandardTestSuite(): AudioTestCase[] {
    return [
      {
        name: 'quiet-speech',
        description: 'Quiet speech in silent environment',
        audioFile: 'test_data/quiet_speech.wav',
        noiseCondition: 'quiet',
        expectedSegments: [
          { startTime: 0, endTime: 500, isSpeech: false },
          { startTime: 500, endTime: 2500, isSpeech: true },
          { startTime: 2500, endTime: 3000, isSpeech: false },
        ],
      },
      {
        name: 'normal-speech',
        description: 'Normal volume speech',
        audioFile: 'test_data/hello.wav',
        noiseCondition: 'normal',
        expectedSegments: [
          { startTime: 0, endTime: 200, isSpeech: false },
          { startTime: 200, endTime: 1200, isSpeech: true },
          { startTime: 1200, endTime: 1500, isSpeech: false },
        ],
      },
      {
        name: 'keyboard-typing',
        description: 'Speech with keyboard typing noise',
        audioFile: 'test_data/speech_with_typing.wav',
        noiseCondition: 'noisy',
        expectedSegments: [
          { startTime: 0, endTime: 500, isSpeech: false }, // Typing only
          { startTime: 500, endTime: 2500, isSpeech: true }, // Speech + typing
          { startTime: 2500, endTime: 3500, isSpeech: false }, // Typing only
          { startTime: 3500, endTime: 5000, isSpeech: true }, // Speech
          { startTime: 5000, endTime: 5500, isSpeech: false },
        ],
      },
      {
        name: 'hvac-noise',
        description: 'Speech with HVAC background noise',
        audioFile: 'test_data/speech_with_hvac.wav',
        noiseCondition: 'noisy',
        expectedSegments: [
          { startTime: 0, endTime: 1000, isSpeech: false }, // HVAC only
          { startTime: 1000, endTime: 3000, isSpeech: true }, // Speech + HVAC
          { startTime: 3000, endTime: 4000, isSpeech: false }, // HVAC only
        ],
      },
      {
        name: 'multiple-utterances',
        description: 'Multiple utterances with pauses',
        audioFile: 'test_data/hello_hello.wav',
        noiseCondition: 'normal',
        expectedSegments: [
          { startTime: 0, endTime: 300, isSpeech: false },
          { startTime: 300, endTime: 1300, isSpeech: true }, // First "hello"
          { startTime: 1300, endTime: 2000, isSpeech: false }, // Pause
          { startTime: 2000, endTime: 3000, isSpeech: true }, // Second "hello"
          { startTime: 3000, endTime: 3500, isSpeech: false },
        ],
      },
    ]
  }

  /**
   * Calculate accuracy metrics from detection results
   */
  static calculateMetrics(results: DetectionResult[]): AccuracyMetrics {
    let truePositives = 0
    let trueNegatives = 0
    let falsePositives = 0
    let falseNegatives = 0

    for (const result of results) {
      if (result.detected && result.expected) {
        truePositives++
      } else if (!result.detected && !result.expected) {
        trueNegatives++
      } else if (result.detected && !result.expected) {
        falsePositives++
      } else if (!result.detected && result.expected) {
        falseNegatives++
      }
    }

    const precision = truePositives + falsePositives > 0
      ? truePositives / (truePositives + falsePositives)
      : 0

    const recall = truePositives + falseNegatives > 0
      ? truePositives / (truePositives + falseNegatives)
      : 0

    const f1Score = precision + recall > 0
      ? 2 * ((precision * recall) / (precision + recall))
      : 0

    const accuracy = results.length > 0
      ? (truePositives + trueNegatives) / results.length
      : 0

    return {
      truePositives,
      trueNegatives,
      falsePositives,
      falseNegatives,
      precision,
      recall,
      f1Score,
      accuracy,
    }
  }

  /**
   * Determine expected detection state at a given timestamp
   */
  static getExpectedState(
    timestamp: number,
    segments: SpeechSegment[]
  ): boolean {
    for (const segment of segments) {
      if (timestamp >= segment.startTime && timestamp < segment.endTime) {
        return segment.isSpeech
      }
    }
    return false
  }

  /**
   * Compare two sets of accuracy metrics
   */
  static compareMetrics(
    baseline: AccuracyMetrics,
    improved: AccuracyMetrics
  ): ComparisonReport['improvement'] {
    return {
      precisionDelta: improved.precision - baseline.precision,
      recallDelta: improved.recall - baseline.recall,
      f1ScoreDelta: improved.f1Score - baseline.f1Score,
      falsePositiveReduction:
        baseline.falsePositives > 0
          ? ((baseline.falsePositives - improved.falsePositives) /
              baseline.falsePositives) *
            100
          : 0,
      falseNegativeReduction:
        baseline.falseNegatives > 0
          ? ((baseline.falseNegatives - improved.falseNegatives) /
              baseline.falseNegatives) *
            100
          : 0,
    }
  }

  /**
   * Format comparison report as human-readable string
   */
  static formatComparisonReport(report: ComparisonReport): string {
    const lines: string[] = [
      '========================================',
      `Accuracy Comparison: ${report.testCase.name}`,
      '========================================',
      `Description: ${report.testCase.description}`,
      `Noise Condition: ${report.testCase.noiseCondition}`,
      '',
      'Amplitude-Based Detection:',
      `  Precision: ${(report.amplitudeBasedMetrics.precision * 100).toFixed(2)}%`,
      `  Recall: ${(report.amplitudeBasedMetrics.recall * 100).toFixed(2)}%`,
      `  F1 Score: ${(report.amplitudeBasedMetrics.f1Score * 100).toFixed(2)}%`,
      `  Accuracy: ${(report.amplitudeBasedMetrics.accuracy * 100).toFixed(2)}%`,
      `  False Positives: ${report.amplitudeBasedMetrics.falsePositives}`,
      `  False Negatives: ${report.amplitudeBasedMetrics.falseNegatives}`,
    ]

    if (report.vadBasedMetrics) {
      lines.push(
        '',
        'VAD-Based Detection:',
        `  Precision: ${(report.vadBasedMetrics.precision * 100).toFixed(2)}%`,
        `  Recall: ${(report.vadBasedMetrics.recall * 100).toFixed(2)}%`,
        `  F1 Score: ${(report.vadBasedMetrics.f1Score * 100).toFixed(2)}%`,
        `  Accuracy: ${(report.vadBasedMetrics.accuracy * 100).toFixed(2)}%`,
        `  False Positives: ${report.vadBasedMetrics.falsePositives}`,
        `  False Negatives: ${report.vadBasedMetrics.falseNegatives}`,
        '',
        'Improvement:',
        `  Precision: ${report.improvement.precisionDelta > 0 ? '+' : ''}${(report.improvement.precisionDelta * 100).toFixed(2)}%`,
        `  Recall: ${report.improvement.recallDelta > 0 ? '+' : ''}${(report.improvement.recallDelta * 100).toFixed(2)}%`,
        `  F1 Score: ${report.improvement.f1ScoreDelta > 0 ? '+' : ''}${(report.improvement.f1ScoreDelta * 100).toFixed(2)}%`,
        `  False Positive Reduction: ${report.improvement.falsePositiveReduction.toFixed(2)}%`,
        `  False Negative Reduction: ${report.improvement.falseNegativeReduction.toFixed(2)}%`
      )
    }

    lines.push('========================================')
    return lines.join('\n')
  }

  /**
   * Export comparison report as JSON
   */
  static exportComparisonReport(report: ComparisonReport): string {
    return JSON.stringify(report, null, 2)
  }

  /**
   * Generate a test report summary for multiple test cases
   */
  static generateSummaryReport(reports: ComparisonReport[]): string {
    const lines: string[] = [
      '========================================',
      'VAD Accuracy Test Suite Summary',
      '========================================',
      `Total Test Cases: ${reports.length}`,
      '',
    ]

    // Calculate averages
    let totalPrecisionDelta = 0
    let totalRecallDelta = 0
    let totalF1Delta = 0
    let totalFPReduction = 0
    let totalFNReduction = 0

    for (const report of reports) {
      totalPrecisionDelta += report.improvement.precisionDelta
      totalRecallDelta += report.improvement.recallDelta
      totalF1Delta += report.improvement.f1ScoreDelta
      totalFPReduction += report.improvement.falsePositiveReduction
      totalFNReduction += report.improvement.falseNegativeReduction
    }

    const avgPrecisionDelta = totalPrecisionDelta / reports.length
    const avgRecallDelta = totalRecallDelta / reports.length
    const avgF1Delta = totalF1Delta / reports.length
    const avgFPReduction = totalFPReduction / reports.length
    const avgFNReduction = totalFNReduction / reports.length

    lines.push(
      'Average Improvements:',
      `  Precision: ${avgPrecisionDelta > 0 ? '+' : ''}${(avgPrecisionDelta * 100).toFixed(2)}%`,
      `  Recall: ${avgRecallDelta > 0 ? '+' : ''}${(avgRecallDelta * 100).toFixed(2)}%`,
      `  F1 Score: ${avgF1Delta > 0 ? '+' : ''}${(avgF1Delta * 100).toFixed(2)}%`,
      `  False Positive Reduction: ${avgFPReduction.toFixed(2)}%`,
      `  False Negative Reduction: ${avgFNReduction.toFixed(2)}%`,
      '',
      'By Noise Condition:',
      ''
    )

    // Group by noise condition
    const byCondition: Record<string, ComparisonReport[]> = {}
    for (const report of reports) {
      const condition = report.testCase.noiseCondition
      if (!byCondition[condition]) {
        byCondition[condition] = []
      }
      byCondition[condition].push(report)
    }

    for (const [condition, conditionReports] of Object.entries(byCondition)) {
      const conditionF1Delta =
        conditionReports.reduce((sum, r) => sum + r.improvement.f1ScoreDelta, 0) /
        conditionReports.length

      lines.push(
        `  ${condition}:`,
        `    Test Cases: ${conditionReports.length}`,
        `    Avg F1 Improvement: ${conditionF1Delta > 0 ? '+' : ''}${(conditionF1Delta * 100).toFixed(2)}%`
      )
    }

    lines.push('========================================')
    return lines.join('\n')
  }
}
