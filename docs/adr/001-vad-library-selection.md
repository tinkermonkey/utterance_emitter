# ADR-001: Voice Activity Detection Library Selection

## Status

Proposed

## Context

The current Voice Activity Detection (VAD) implementation in UtteranceEmitter uses a simple amplitude-based threshold detection mechanism. This approach has several limitations:

### Current Implementation Issues

1. **False Positives**: Background noise (HVAC, keyboard typing, ambient sounds) frequently triggers speech detection when average frequency magnitude exceeds `volumeThreshold`
2. **False Negatives**: Quiet speech or soft-spoken users fall below threshold, causing missed utterances
3. **Rigid Threshold**: Single `volumeThreshold` parameter cannot adapt to varying acoustic environments
4. **No Speech Modeling**: Pure amplitude comparison lacks understanding of speech characteristics vs. non-speech audio

### Technical Context

The existing architecture (`/workspace/src/index.ts:256-335`) operates as follows:

- **Audio Pipeline**: MediaStream → AudioContext → AnalyserNode → getByteFrequencyData()
- **Processing Rate**: 60 FPS via requestAnimationFrame (16.67ms budget per frame)
- **Volume Calculation**: Average of frequency bin magnitudes
- **State Machine**: Binary threshold signal → 400ms quiet period filter → MediaRecorder control
- **Event Emission**: Speaking state transitions emit SpeakingEvent

### Requirements

From Issue #40, the VAD solution must satisfy:

- **Minimal Code Size**: Bundle size impact must be justified against accuracy gains
- **Accuracy**: Production-grade speech detection with low false positive/negative rates
- **Efficiency**: Must operate within 16.67ms frame budget without blocking main thread
- **Modularity**: Clean integration with existing architecture, graceful fallback
- **Browser Compatibility**: Chrome, Firefox, Safari, Edge support
- **Configurability**: Adjustable sensitivity/threshold parameters with sensible defaults

## Decision

**Adopt @ricky0123/vad-web (Silero VAD via ONNX Runtime Web)**

This library provides:
- Pre-trained Silero VAD model (production-grade ML-based speech detection)
- ONNX Runtime Web for efficient WebAssembly execution
- AudioWorklet mode for off-main-thread processing
- Configurable probability threshold
- Active maintenance and broad deployment validation

### Integration Approach

1. **Dual-Signal Strategy**: Maintain amplitude-based volume calculation for visualization, add VAD probability as primary threshold signal
2. **Asynchronous Initialization**: Load VAD model during `handleStream()` to avoid blocking application startup
3. **AudioWorklet Processing**: Offload VAD computation from main thread
4. **Graceful Degradation**: Fall back to amplitude-based detection if VAD initialization fails
5. **Configuration Extension**: Add `vadEnabled`, `vadThreshold`, `vadFallback` to EmitterConfig

## Consequences

### Positive

1. **Production-Grade Accuracy**: Silero VAD is widely deployed in production systems with validated performance across diverse acoustic conditions
2. **Efficient Execution**: WebAssembly via ONNX Runtime provides near-native performance (1-5ms per frame)
3. **Off-Main-Thread Processing**: AudioWorklet mode ensures VAD computation doesn't block UI rendering
4. **Active Maintenance**: @ricky0123/vad-web has regular updates, community support, and ongoing compatibility fixes
5. **Configurable Sensitivity**: Probability threshold (0-1) provides fine-grained control over detection sensitivity
6. **Architectural Fit**: Frame-based processing integrates cleanly with existing requestAnimationFrame loop
7. **Backward Compatibility**: Existing amplitude-based detection remains as fallback option

### Negative

1. **Bundle Size Increase**: ~1.5MB total addition
   - ONNX Runtime Web WASM: ~500KB
   - Silero VAD model: ~1MB
   - Library wrapper: ~50KB
2. **Initialization Latency**: 500ms-2s one-time model loading delay when starting audio stream
3. **Increased Complexity**: Asynchronous model loading, worklet management, error handling add ~200 lines of code
4. **Memory Overhead**: ~10MB runtime memory for ONNX Runtime + model
5. **Additional Dependency**: External npm package introduces supply chain risk and update maintenance

### Mitigation Strategies

1. **Lazy Loading**: Load VAD model only when `handleStream()` is called (user initiates recording), not at application startup
2. **CDN Caching**: Model file (1MB) downloads once, then cached by browser for subsequent sessions
3. **Fallback Implementation**: If VAD fails to initialize, automatically fall back to amplitude-based detection with console warning
4. **Bundle Size Documentation**: Clearly document 1.5MB increase in README and migration guide
5. **Optional Feature**: Make VAD opt-in via `vadEnabled: false` configuration for bundle-size-sensitive applications
6. **Worklet Isolation**: AudioWorklet ensures VAD processing doesn't impact main thread frame budget

## Alternatives Considered

### Alternative 1: Picovoice Cobra

**Description**: Commercial-grade VAD via proprietary WebAssembly runtime

**Pros**:
- Smaller bundle size (~200KB WASM)
- Excellent accuracy (commercial-grade)
- Built-in streaming audio processing

**Cons**:
- **Requires API key**: Licensing adds friction for open-source library users
- **Vendor lock-in**: Proprietary runtime limits future flexibility
- **Runtime dependency**: Relies on Picovoice infrastructure availability
- **Cost**: API key may require paid subscription for production use

**Rejection Reason**: API key requirement creates licensing complexity incompatible with open-source distribution model

### Alternative 2: Web Audio VAD

**Description**: Pure JavaScript implementation using autocorrelation and zero-crossing rate

**Pros**:
- Minimal bundle size (~10KB)
- Zero external dependencies
- Universal browser compatibility (no WASM)
- Simplest integration

**Cons**:
- **Insufficient accuracy improvement**: Signal processing heuristics only marginally better than current amplitude-based approach
- **Limited configurability**: Binary output, no probability scores
- **No ML-based modeling**: Cannot learn speech patterns from data
- **Maintenance risk**: Less active community support

**Rejection Reason**: Marginal accuracy gains don't justify migration effort from existing amplitude-based implementation

### Alternative 3: Custom Silero VAD + Optimized ONNX Runtime

**Description**: Self-maintained Silero VAD with custom ONNX Runtime build to reduce bundle size

**Pros**:
- Potential 200-400KB bundle size reduction (via minimal operator build + ORT format conversion)
- Educational value understanding ONNX Runtime internals
- Foundation for future ML features

**Cons**:
- **High engineering cost**: 20-40+ hours initial setup + ongoing maintenance
- **Build toolchain complexity**: Emscripten, operator config generation, cross-browser testing
- **Maintenance burden**: Must track ONNX Runtime updates, Silero model updates, browser API changes
- **Marginal benefit**: 650KB max savings (~1 second load time on modern broadband)
- **Reduced modularity**: Sacrifices maintainability for size optimization

**Rejection Reason**: Engineering cost outweighs marginal bundle size benefit unless hard budget constraint exists (see Bundle Size Optimization Analysis below). Recommend lazy loading + CDN caching instead.

### Alternative 4: No Change (Keep Amplitude-Based VAD)

**Description**: Maintain current `volumeThreshold` implementation

**Pros**:
- Zero bundle size impact
- No additional complexity
- Proven reliability in existing deployments

**Cons**:
- **Persistent false positives/negatives**: User-reported issues remain unresolved
- **Poor user experience**: Inaccurate speech detection frustrates users
- **Limited adaptability**: Cannot handle diverse acoustic environments

**Rejection Reason**: Fails to address core issue requirements (FR-1, US-1)

## Implementation Notes

### Configuration Mapping

```typescript
// Existing configuration (amplitude-based)
interface EmitterConfig {
  volumeThreshold: number; // Default: 0.5, Range: 0-1 (normalized amplitude)
}

// Extended configuration (VAD-enabled)
interface EmitterConfig {
  volumeThreshold: number;     // Preserved for fallback and visualization
  vadEnabled?: boolean;        // Default: true
  vadThreshold?: number;       // Default: 0.5, Range: 0-1 (probability threshold)
  vadFallback?: boolean;       // Default: true (fallback to amplitude-based)
}
```

### Migration Path

**Backward Compatibility**:
- Existing `volumeThreshold` parameter continues to work (used in fallback mode)
- VAD is enabled by default but can be disabled via `vadEnabled: false`
- No breaking changes to public API

**New Users**:
- Default configuration (`vadEnabled: true`, `vadThreshold: 0.5`) provides optimal out-of-box experience
- Advanced users can tune `vadThreshold` for specific acoustic environments

### Bundle Size Decision

After analyzing the feasibility of custom ONNX Runtime optimization (see research feedback), the decision is to **NOT pursue custom builds** because:

1. **Lazy loading mitigates impact**: 1.5MB loads only when user starts recording, not at app startup
2. **CDN caching**: One-time download per user device
3. **Engineering cost**: 20-40+ hours doesn't justify 650KB max savings
4. **Maintenance burden**: Custom builds sacrifice modularity and maintainability
5. **No hard constraint**: Project doesn't have < 500KB total bundle budget requirement

**Recommendation**: Start with @ricky0123/vad-web as-is (1.5MB), measure actual user impact, and only consider ORT format conversion if telemetry shows bundle size issues.

## References

- [Silero VAD GitHub](https://github.com/snakers4/silero-vad)
- [@ricky0123/vad-web npm package](https://www.npmjs.com/package/@ricky0123/vad-web)
- [ONNX Runtime Web Documentation](https://onnxruntime.ai/docs/build/web.html)
- [Issue #40: Voice Activity Detection Research](https://github.com/your-repo/issues/40)
- [Phase 2 Design: VAD Integration Architecture](/workspace/docs/design/phase2-vad-integration.md)

## Decision Date

2025-11-29

## Reviewers

- Software Architect
- Senior Software Engineer
