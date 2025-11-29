# VAD Integration Testing Guide

This guide documents the comprehensive testing procedures for Phase 3 of the VAD integration, covering performance validation, accuracy measurement, browser compatibility testing, and memory leak detection.

## Overview

Phase 3 validates that the VAD integration meets all functional requirements:

- **FR-2**: Processing latency under 10ms per audio frame, non-blocking execution
- **FR-7**: Cross-browser compatibility (Chrome, Firefox, Safari, Edge)
- **FR-9**: Efficient resource management and memory leak prevention
- **US-3**: Browser compatibility with WASM loading < 2 seconds
- **US-10**: Frame processing < 16.67ms at 60 FPS
- **US-11**: Improved accuracy over amplitude-based detection

## Testing Framework Components

### 1. Performance Monitor (`src/performance-monitor.ts`)

Measures real-time performance characteristics of the VAD integration.

#### Features

- **Frame Timing**: Tracks processAudio() execution time for each frame
- **FPS Monitoring**: Calculates actual frames per second
- **Dropped Frame Detection**: Identifies frames exceeding 16.67ms budget
- **CPU Usage**: Monitors CPU utilization (when available)
- **Memory Sampling**: Periodic memory usage snapshots

#### Usage

```typescript
import { PerformanceMonitor } from './performance-monitor'

// Create monitor instance
const monitor = new PerformanceMonitor()

// Start monitoring
monitor.start()

// In your processAudio() method:
processAudio(): void {
  const frameStart = this.monitor.recordFrameStart()

  // ... existing processing logic ...

  this.monitor.recordFrameEnd(frameStart)
}

// Stop and get report (after 5+ minutes)
const report = monitor.stop()

// Display report
console.log(PerformanceMonitor.formatReport(report))

// Export for automated testing
const json = PerformanceMonitor.exportReport(report)
```

#### Requirements Validation

The performance report includes automatic validation:

- ✓ **Frame Timing**: All frames < 16.67ms (no dropped frames)
- ✓ **CPU Usage**: Average < 10%
- ✓ **No Memory Leaks**: Heap growth < 20% over session

### 2. Accuracy Tester (`src/accuracy-tester.ts`)

Compares VAD accuracy against the current amplitude-based implementation.

#### Test Cases

Five standard test cases covering various noise conditions:

1. **Quiet Speech**: Quiet speech in silent environment
2. **Normal Speech**: Normal volume speech
3. **Keyboard Typing**: Speech with keyboard noise (tests false positive reduction)
4. **HVAC Noise**: Speech with HVAC background noise
5. **Multiple Utterances**: Multiple utterances with pauses

#### Ground Truth Format

Each test case includes expected speech segments:

```typescript
{
  name: 'test-name',
  description: 'Test description',
  audioFile: 'path/to/audio.wav',
  noiseCondition: 'quiet' | 'normal' | 'noisy',
  expectedSegments: [
    { startTime: 0, endTime: 500, isSpeech: false },    // Silence
    { startTime: 500, endTime: 2500, isSpeech: true },  // Speech
    { startTime: 2500, endTime: 3000, isSpeech: false }, // Silence
  ]
}
```

#### Usage

```typescript
import { AccuracyTester } from './accuracy-tester'

// Create test suite
const tester = new AccuracyTester()
const testCases = AccuracyTester.createStandardTestSuite()

// Run tests and collect results
const comparisonReports: ComparisonReport[] = []

for (const testCase of testCases) {
  // Run with amplitude-based detection
  const amplitudeResults = runAmplitudeDetection(testCase)
  const amplitudeMetrics = AccuracyTester.calculateMetrics(amplitudeResults)

  // Run with VAD-based detection
  const vadResults = runVADDetection(testCase)
  const vadMetrics = AccuracyTester.calculateMetrics(vadResults)

  // Compare
  const improvement = AccuracyTester.compareMetrics(amplitudeMetrics, vadMetrics)

  const report: ComparisonReport = {
    testCase,
    amplitudeBasedMetrics: amplitudeMetrics,
    vadBasedMetrics: vadMetrics,
    improvement,
    detectionResults: {
      amplitude: amplitudeResults,
      vad: vadResults,
    }
  }

  comparisonReports.push(report)
  console.log(AccuracyTester.formatComparisonReport(report))
}

// Generate summary
console.log(AccuracyTester.generateSummaryReport(comparisonReports))
```

#### Metrics Explained

- **Precision**: TP / (TP + FP) - What % of detected speech was actually speech?
- **Recall**: TP / (TP + FN) - What % of actual speech was detected?
- **F1 Score**: Harmonic mean of precision and recall
- **False Positives**: Noise incorrectly detected as speech
- **False Negatives**: Speech missed by detector

### 3. Browser Compatibility Tester (`src/browser-compatibility.ts`)

Tests VAD functionality across different browsers.

#### Browser Support Matrix

- Chrome (Chromium)
- Firefox
- Safari
- Edge (Chromium)

#### Feature Detection

Checks for required browser APIs:

- Web Audio API
- AudioWorklet
- WebAssembly
- Performance API
- Memory API
- MediaRecorder
- getUserMedia

#### Usage

```typescript
import { BrowserCompatibilityTester } from './browser-compatibility'

// Run full test suite
const report = await BrowserCompatibilityTester.runCompatibilityTests()

// Display report
console.log(BrowserCompatibilityTester.formatReport(report))

// Check specific requirements
console.log('WASM Loading < 2s:', report.requirements.wasmLoadingMet)
console.log('VAD Initialized:', report.requirements.vadInitialized)
console.log('Processing Works:', report.requirements.processingWorks)

// Export for CI/CD
const json = BrowserCompatibilityTester.exportReport(report)
```

#### Cross-Browser Testing

For comprehensive testing across multiple browsers:

```typescript
// Run on Chrome, Firefox, Safari, Edge
const reports: BrowserCompatibilityReport[] = []

// Collect reports from each browser (manual or automated)
// ...

// Generate summary
const summary = BrowserCompatibilityTester.generateCrossBrowserSummary(reports)
console.log(summary)
```

### 4. Memory Profiler (`src/memory-profiler.ts`)

Detects memory leaks during continuous recording sessions.

#### Leak Detection Algorithm

1. **Sampling**: Takes memory snapshots every second
2. **Trend Analysis**: Calculates heap growth rate
3. **GC Detection**: Identifies garbage collection events
4. **Confidence Assessment**: High/Medium/Low/None based on growth patterns

#### Thresholds

- **Growth Threshold**: 20% heap growth over session
- **Growth Rate**: 10 KB/sec sustained growth
- **Minimum Duration**: 5 minutes for reliable detection

#### Usage

```typescript
import { MemoryProfiler } from './memory-profiler'

// Check browser support
if (!MemoryProfiler.checkSupport()) {
  console.warn('Memory profiling not supported in this browser')
  // Note: Chrome required for performance.memory API
}

// Create profiler
const profiler = new MemoryProfiler()

// Start monitoring
profiler.start()

// Run continuous recording session (5+ minutes)
// ...

// Stop and analyze
const result = profiler.stop()

// Display results
console.log(MemoryProfiler.formatResult(result))

// Check for leaks
if (result.leakDetected) {
  console.error('Memory leak detected!')
  console.error(result.recommendation)
}
```

### 5. Bundle Size Measurement (`scripts/measure-bundle-size.js`)

Measures production build size impact.

#### Metrics

- Raw bundle size (uncompressed)
- Gzipped bundle size
- Per-format breakdown (CJS, ESM, UMD)
- Comparison with previous build

#### Usage

```bash
# Build the project
npm run build

# Measure bundle size
node scripts/measure-bundle-size.js
```

#### Output

```
========================================
Bundle Size Measurement
========================================

CJS Bundle:
  Raw: 145.32 KB
  Gzipped: 42.18 KB

ESM Bundle:
  Raw: 142.87 KB
  Gzipped: 41.56 KB

UMD Bundle:
  Raw: 148.91 KB
  Gzipped: 43.02 KB

ESM Change:
  Raw: +1.42 MB (+1024.5%)
  Gzipped: +512.34 KB (+1232.1%)

Total Bundle Size Change:
  Raw: +1.48 MB (+1018.3%)
  Gzipped: +534.78 KB (+1272.8%)

========================================
Bundle Size Requirements Check
========================================
Current Total Gzipped Size: 534.78 KB (0.52 MB)
Increase from Previous: 534.78 KB (+1272.8%)
✓ Bundle size increase (0.52 MB) is within expected VAD overhead (1.5 MB)
========================================
```

## Test Execution Plan

### Phase 3.1: Performance Validation

**Objective**: Verify frame timing and CPU usage meet requirements

1. **Setup**:
   - Integrate PerformanceMonitor into UtteranceEmitter
   - Add monitoring to processAudio() method

2. **Execution**:
   - Start monitoring
   - Run continuous recording session (5+ minutes)
   - Stop and generate report

3. **Acceptance Criteria**:
   - [ ] All frames < 16.67ms (0% dropped frames)
   - [ ] Average processing time documented
   - [ ] P95 and P99 latency documented
   - [ ] CPU usage < 10% (if measurable)

### Phase 3.2: Accuracy Validation

**Objective**: Demonstrate improved accuracy over amplitude-based detection

1. **Setup**:
   - Create test audio samples for each noise condition
   - Annotate ground truth speech segments

2. **Execution**:
   - Run amplitude-based detection on test suite
   - Run VAD-based detection on test suite
   - Calculate metrics and comparison

3. **Acceptance Criteria**:
   - [ ] False positive rate reduced (especially for keyboard/HVAC noise)
   - [ ] False negative rate reduced (especially for quiet speech)
   - [ ] F1 score improvement documented
   - [ ] Comparison report generated for all 5 test cases

### Phase 3.3: Browser Compatibility

**Objective**: Verify VAD works across target browsers

1. **Setup**:
   - Prepare test environment for each browser
   - Chrome, Firefox, Safari, Edge

2. **Execution**:
   - Run BrowserCompatibilityTester in each browser
   - Document WASM loading times
   - Test VAD initialization and processing

3. **Acceptance Criteria**:
   - [ ] Chrome: Full compatibility
   - [ ] Firefox: Full compatibility
   - [ ] Safari: Full compatibility
   - [ ] Edge: Full compatibility
   - [ ] WASM loading < 2 seconds in all browsers
   - [ ] No initialization errors

### Phase 3.4: Memory Leak Detection

**Objective**: Verify no memory leaks during continuous operation

1. **Setup**:
   - Use Chrome for performance.memory API support
   - Prepare 5+ minute recording session

2. **Execution**:
   - Start MemoryProfiler
   - Run continuous recording (start/stop cycles)
   - Stop profiler and analyze

3. **Acceptance Criteria**:
   - [ ] Heap growth < 20% over session
   - [ ] No high-confidence leaks detected
   - [ ] GC observed during session
   - [ ] Leak detection report generated

### Phase 3.5: Bundle Size Impact

**Objective**: Document bundle size increase from VAD integration

1. **Setup**:
   - Build baseline (before VAD integration)
   - Run measure-bundle-size.js to establish baseline

2. **Execution**:
   - Integrate VAD library
   - Build production bundles
   - Run measure-bundle-size.js

3. **Acceptance Criteria**:
   - [ ] Bundle size increase documented
   - [ ] Increase < 1.5 MB (expected VAD overhead)
   - [ ] Comparison report generated

## Automated Test Integration

### Cypress Integration

Example Cypress test for performance validation:

```javascript
describe('VAD Performance', () => {
  it('should process audio frames within 16.67ms budget', () => {
    cy.visit('/')

    // Start emitter with performance monitoring
    cy.window().then((win) => {
      const { UtteranceEmitter, PerformanceMonitor } = win
      const monitor = new PerformanceMonitor()
      const emitter = new UtteranceEmitter()

      monitor.start()
      emitter.start()

      // Record for 5 minutes
      cy.wait(5 * 60 * 1000)

      emitter.stop()
      const report = monitor.stop()

      // Assertions
      expect(report.frameMetrics.droppedPercentage).to.be.lessThan(1)
      expect(report.frameMetrics.avgProcessingTime).to.be.lessThan(16.67)
      expect(report.requirements.frameTimingMet).to.be.true
    })
  })
})
```

### CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Run Performance Tests
  run: npm run test:performance

- name: Measure Bundle Size
  run: |
    npm run build
    node scripts/measure-bundle-size.js

- name: Upload Test Reports
  uses: actions/upload-artifact@v3
  with:
    name: test-reports
    path: |
      performance-report.json
      bundle-size-report.json
```

## Troubleshooting

### Performance Monitor Issues

**Issue**: Performance.memory API not available

**Solution**: Use Chrome or Edge. Firefox and Safari don't expose this API.

**Issue**: Dropped frames reported

**Solution**:
- Check if VAD is running in worklet mode (offloads from main thread)
- Verify audio frame size configuration
- Profile with Chrome DevTools to identify bottlenecks

### Accuracy Testing Issues

**Issue**: False positive rate still high

**Solution**:
- Adjust VAD threshold (vadThreshold in config)
- Verify test audio quality and ground truth annotations
- Check if background noise is stationary (HVAC) vs transient (keyboard)

### Browser Compatibility Issues

**Issue**: WASM loading exceeds 2 seconds

**Solution**:
- Check network conditions (CDN caching)
- Use smaller VAD model if available
- Consider lazy loading on first audio stream

**Issue**: AudioWorklet not supported

**Solution**:
- Fallback to main-thread processing
- Verify browser version supports AudioWorklet
- Use polyfill if needed

### Memory Profiling Issues

**Issue**: Memory API not available

**Solution**: Must use Chrome or Edge for memory profiling

**Issue**: False positive leak detection

**Solution**:
- Ensure session duration > 5 minutes
- Check if GC was observed (natural heap fluctuation)
- Verify confidence level (low confidence may be false positive)

## Reporting Results

### Performance Report Format

Document the following in issue comments:

```markdown
## Performance Validation Results

**Hardware**: Intel i5 8th gen, 16GB RAM
**Browser**: Chrome 120
**Session Duration**: 5:32 minutes

### Frame Timing
- Total Frames: 19,920
- Dropped Frames: 0 (0%)
- Avg Processing: 2.34ms
- P95 Processing: 4.12ms
- P99 Processing: 5.87ms
- ✅ All frames < 16.67ms

### Memory
- Initial Heap: 42.18 MB
- Final Heap: 48.32 MB
- Growth: 6.14 MB (14.6%)
- ✅ No leaks detected

### CPU
- Avg Usage: 7.2%
- ✅ Under 10% threshold
```

### Accuracy Report Format

```markdown
## Accuracy Validation Results

**Test Suite**: 5 test cases (quiet, normal, keyboard, HVAC, multiple)

### Average Improvements
- Precision: +12.4%
- Recall: +8.7%
- F1 Score: +10.5%
- False Positive Reduction: 34.2%
- False Negative Reduction: 28.6%

### By Noise Condition
- Quiet: F1 +8.2%
- Normal: F1 +9.1%
- Noisy: F1 +14.3% ✅ Significant improvement

[Detailed comparison reports attached]
```

### Browser Compatibility Format

```markdown
## Browser Compatibility Results

| Browser | Version | WASM Load | VAD Init | Processing | Overall |
|---------|---------|-----------|----------|------------|---------|
| Chrome  | 120     | 0.42s ✅  | 0.18s ✅ | ✅         | FULL    |
| Firefox | 122     | 0.51s ✅  | 0.21s ✅ | ✅         | FULL    |
| Safari  | 17.2    | 0.89s ✅  | 0.34s ✅ | ✅         | FULL    |
| Edge    | 120     | 0.38s ✅  | 0.16s ✅ | ✅         | FULL    |

✅ All target browsers fully compatible
```

## Next Steps

After completing Phase 3 testing:

1. **Document Results**: Update issue with all test reports
2. **Address Issues**: Fix any failures or performance problems
3. **Code Review**: Submit for review with test evidence
4. **Deployment**: Merge to main branch
5. **Production Validation**: Monitor real-world performance

## References

- [Performance API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/Performance)
- [Memory Profiling in Chrome](https://developer.chrome.com/docs/devtools/memory-problems/)
- [AudioWorklet Best Practices](https://developer.chrome.com/blog/audio-worklet/)
- [@ricky0123/vad-web Documentation](https://www.npmjs.com/package/@ricky0123/vad-web)
