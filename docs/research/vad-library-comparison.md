# Voice Activity Detection Library Comparison

**Research Phase**: Phase 3 - Library Evaluation
**Issue**: #40 - Voice Activity Detection Implementation
**Date**: 2025-11-29

## Executive Summary

This document provides a comprehensive comparison of Voice Activity Detection (VAD) libraries evaluated for integration into the UtteranceEmitter component. Three primary candidates were assessed against the criteria of minimal code size, accuracy, efficiency, and modularity.

**Recommended Solution**: @ricky0123/vad-web (Silero VAD via ONNX Runtime Web)

**Key Findings**:
- **Bundle Size**: 1.5MB total (acceptable with lazy loading + CDN caching)
- **Accuracy**: Production-grade ML-based detection significantly superior to amplitude-based approach
- **Efficiency**: 1-5ms per frame via WASM, AudioWorklet offloads from main thread
- **Modularity**: Clean integration with existing architecture, graceful fallback support

## Evaluation Criteria

Based on Issue #40 requirements:

1. **Minimal Code Size** (FR-1): Bundle size impact vs. accuracy trade-off
2. **Accuracy**: False positive/negative rates, speech detection quality
3. **Efficiency**: Processing time, main thread impact, memory usage
4. **Modularity**: Integration complexity, backward compatibility, fallback support
5. **Browser Compatibility**: Chrome, Firefox, Safari, Edge support
6. **Configurability** (FR-6): Sensitivity/threshold parameter adjustment

## Library Comparison Matrix

| Criterion | @ricky0123/vad-web | Picovoice Cobra | Web Audio VAD | Custom ONNX Build |
|-----------|-------------------|-----------------|---------------|-------------------|
| **Bundle Size** | 1.5MB (500KB runtime + 1MB model) | ~200KB WASM | ~10KB | ~850KB-1.15MB (optimized) |
| **Accuracy** | ⭐⭐⭐⭐⭐ Production-grade ML | ⭐⭐⭐⭐⭐ Commercial-grade | ⭐⭐ Marginal improvement | ⭐⭐⭐⭐⭐ Same as @ricky0123 |
| **Efficiency** | 1-5ms/frame (WASM) | 1-5ms/frame (WASM) | <1ms/frame (JS) | 1-5ms/frame (WASM) |
| **Main Thread Impact** | ✅ AudioWorklet mode | ✅ Built-in worklet | ⚠️ Main thread only | ✅ AudioWorklet mode |
| **Browser Compatibility** | ✅ Chrome, Firefox, Safari, Edge | ✅ Universal WASM | ✅ Universal JS | ⚠️ Testing burden |
| **Maintenance** | ✅ Active community | ⚠️ Vendor-dependent | ⚠️ Limited support | ❌ Self-maintained |
| **Modularity** | ✅ npm package | ⚠️ Vendor lock-in | ✅ Standalone | ❌ Custom toolchain |
| **Configurability** | ✅ Probability threshold [0-1] | ✅ Threshold config | ⚠️ Binary output | ✅ Probability threshold |
| **Licensing** | ✅ MIT open-source | ❌ API key required | ✅ MIT/Apache-2.0 | ✅ Apache-2.0 |
| **Dependencies** | onnxruntime-web | Picovoice SDK | None | Self-built ONNX Runtime |
| **Memory Overhead** | ~10MB runtime | ~5MB runtime | <1MB | ~10MB runtime |
| **Initialization Time** | 500ms-2s (model load) | 300ms-1s | Instant | 500ms-2s |
| **Engineering Cost** | ✅ Low (npm install) | ⚠️ Medium (API setup) | ✅ Low | ❌ High (20-40+ hours) |

## Detailed Analysis

### 1. @ricky0123/vad-web (RECOMMENDED)

**Architecture**: Silero VAD neural network model via ONNX Runtime Web (WebAssembly)

#### Strengths

- **Production-Grade Accuracy**: Silero VAD is extensively validated in real-world deployments with excellent false positive/negative rates
- **Efficient WASM Execution**: ONNX Runtime Web provides near-native performance (1-5ms per frame)
- **AudioWorklet Support**: Off-main-thread processing ensures no impact on UI rendering
- **Active Maintenance**: Regular updates, 1.5K+ GitHub stars, responsive maintainer
- **Configurable Threshold**: Probability output [0-1] allows fine-grained sensitivity tuning
- **No API Key**: Pure open-source, no external service dependencies
- **Broad Deployment**: Used by major applications, proven browser compatibility

#### Trade-offs

- **Bundle Size**: 1.5MB is largest among candidates (but justified by accuracy)
- **Initialization Latency**: One-time 500ms-2s model load when starting stream
- **Memory Overhead**: ~10MB runtime memory for model + ONNX Runtime
- **Dependency**: External npm package requires update maintenance

#### Integration Complexity

**Low-Medium**:
- Add npm dependency
- Async model initialization in `handleStream()`
- Replace threshold calculation logic (~50 lines)
- Implement fallback error handling (~30 lines)
- Total new code: ~200 lines

#### Browser Compatibility

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome | ✅ 90+ | Full AudioWorklet + WASM support |
| Firefox | ✅ 89+ | Full support |
| Safari | ✅ 14.5+ | WASM + AudioWorklet supported |
| Edge | ✅ 90+ | Chromium-based, full support |

#### Performance Characteristics

```
Frame Processing Time (1536 sample frame):
- VAD Computation: 1-5ms (AudioWorklet, WASM)
- Main Thread Impact: 0ms (worklet isolation)
- Memory Usage: 10MB baseline + 2MB per instance
- Model Loading: 500-2000ms (one-time, async)
```

#### Code Example

```typescript
import { MicVAD } from "@ricky0123/vad-web"

const vad = await MicVAD.new({
  onSpeechStart: () => console.log("Speech started"),
  onSpeechEnd: () => console.log("Speech ended"),
  positiveSpeechThreshold: 0.5,  // Configurable threshold
  minSpeechFrames: 3,            // Debouncing
  workletURL: "/vad.worklet.bundle.min.js",
  modelURL: "/silero_vad.onnx",
})

vad.start()  // Begin processing
```

#### Package Details

- **npm**: `@ricky0123/vad-web`
- **Version**: 0.0.19 (as of 2025-11)
- **License**: MIT
- **Dependencies**: `onnxruntime-web`
- **Bundle**: ESM + UMD formats

---

### 2. Picovoice Cobra

**Architecture**: Proprietary VAD via Picovoice WebAssembly runtime

#### Strengths

- **Smaller Bundle**: ~200KB WASM (75% smaller than @ricky0123/vad-web)
- **Commercial-Grade Accuracy**: Professional-grade speech detection
- **Built-in Streaming**: Native streaming audio processing
- **Professional Support**: Commercial vendor backing

#### Trade-offs

- **API Key Requirement**: Requires Picovoice account and API key (licensing friction for open-source)
- **Vendor Lock-in**: Proprietary runtime limits future flexibility
- **Cost**: API key may require paid subscription for production use
- **Infrastructure Dependency**: Relies on Picovoice service availability
- **License Incompatibility**: Not suitable for open-source distribution model

#### Integration Complexity

**Medium**:
- API key management (environment variables, user configuration)
- Account setup documentation
- Similar code changes to @ricky0123/vad-web
- Total new code: ~250 lines (including API key handling)

#### Rejection Reason

API key requirement creates unacceptable licensing complexity for open-source library. Users would need to:
1. Create Picovoice account
2. Generate API key
3. Configure key in application
4. Manage key rotation/expiration

This friction is incompatible with the project's goal of providing a simple, open-source VAD solution.

---

### 3. Web Audio VAD

**Architecture**: Pure JavaScript implementation using autocorrelation and zero-crossing rate

#### Strengths

- **Minimal Bundle Size**: ~10KB (99% smaller than @ricky0123/vad-web)
- **Zero Dependencies**: No external libraries required
- **Universal Compatibility**: Works in any modern browser without WASM
- **Instant Initialization**: No model loading delay
- **Simplest Integration**: Drop-in replacement for amplitude calculation

#### Trade-offs

- **Insufficient Accuracy**: Signal processing heuristics provide only marginal improvement over current amplitude-based approach
- **No ML Modeling**: Cannot learn speech patterns from training data
- **Limited Configurability**: Binary output, no probability scores for threshold tuning
- **Maintenance Risk**: Smaller community, less active development

#### Integration Complexity

**Low**:
- Add small JavaScript module (~200 lines)
- Replace threshold calculation
- Total new code: ~250 lines

#### Rejection Reason

**Marginal accuracy gains don't justify migration effort.** If the improvement over amplitude-based detection is only incremental, the engineering cost of migrating existing systems and updating documentation outweighs the benefit. Users would see minor improvements while introducing new failure modes.

---

### 4. Custom Silero VAD + Optimized ONNX Runtime

**Architecture**: Self-maintained Silero VAD with custom minimal ONNX Runtime build

#### Bundle Size Optimization Potential

Based on detailed analysis (see Bundle Size Optimization Analysis document):

**Current @ricky0123/vad-web breakdown**:
- ONNX Runtime Web WASM: 450-500KB
- Silero VAD Model (V5): 1-2MB
- Library wrapper: ~50KB
- **Total**: ~1.5MB

**Optimization opportunities**:

1. **Minimal ONNX Runtime Build**: Generate operator config from Silero model, build WASM with only required operators
   - **Potential savings**: 150-250KB (runtime: 500KB → 250-350KB)
   - **Cost**: Emscripten toolchain setup, cross-browser testing, ongoing maintenance

2. **ORT Format Conversion**: Convert ONNX model to optimized ORT binary format
   - **Potential savings**: 200-500KB (model: 2MB → 1.5-1.7MB)
   - **Cost**: Model conversion pipeline, format compatibility testing

3. **Model Quantization**: Compress model weights
   - **Potential savings**: Minimal (<100KB)
   - **Risk**: Silero team explicitly tested and rejected quantization (no performance improvement, compatibility issues)

**Total potential savings**: 350-650KB (1.5MB → 850KB-1.15MB)

#### Trade-offs

- **High Engineering Cost**: 20-40+ hours initial setup + ongoing maintenance
- **Build Toolchain Complexity**: Emscripten, operator config generation, dependency management
- **Maintenance Burden**: Must track ONNX Runtime updates, Silero model updates, browser API changes
- **Testing Surface**: Custom WASM builds across Chrome, Firefox, Safari, Edge
- **Reduced Modularity**: Sacrifices maintainability for size optimization
- **Marginal Benefit**: 650KB max savings = ~1 second load time on modern broadband

#### When to Consider

Custom optimization is justified **only if**:
1. Hard bundle budget constraint (< 500KB total VAD size)
2. Target users on 2G/3G networks where 650KB = 3-5 seconds
3. Building multiple ONNX-based features (amortize toolchain cost)

#### Recommended Approach Instead

1. **Lazy Loading**: Load VAD model only when user starts recording, not at app startup
2. **CDN Caching**: One-time 1.5MB download per user device
3. **Measure First**: Deploy @ricky0123/vad-web, collect telemetry on actual load times
4. **Optimize If Needed**: If bundle size proves problematic, start with ORT format conversion (Phase 1 quick win: 2-4 hours for 200-400KB savings)

#### Rejection Reason

**Engineering cost outweighs marginal benefit** unless hard constraints exist. The 1.5MB bundle is already excellent on accuracy and efficiency. Custom builds sacrifice modularity and maintainability for marginal size gains that lazy loading + CDN caching can mitigate.

---

## Ranked Recommendations

### 1. @ricky0123/vad-web (ADOPT)

**Verdict**: Best balance of accuracy, efficiency, and maintainability

**Strengths**:
- ⭐⭐⭐⭐⭐ Accuracy
- ⭐⭐⭐⭐ Efficiency
- ⭐⭐⭐⭐⭐ Modularity
- ⭐⭐⭐ Bundle Size (acceptable with mitigation)

**Use When**: Production-grade VAD is required for general-purpose applications

---

### 2. Custom ONNX Build (CONDITIONAL)

**Verdict**: Consider only if hard bundle budget constraint exists

**Strengths**:
- ⭐⭐⭐⭐⭐ Accuracy (same as #1)
- ⭐⭐⭐⭐ Efficiency
- ⭐⭐ Modularity (maintenance burden)
- ⭐⭐⭐⭐ Bundle Size (650KB savings)

**Use When**:
- < 500KB total VAD budget
- Target users on 2G/3G networks
- Multiple ONNX-based features planned

**Recommendation**: Start with @ricky0123/vad-web, measure actual impact, optimize only if telemetry shows bundle size issues

---

### 3. Web Audio VAD (NOT RECOMMENDED)

**Verdict**: Marginal improvement doesn't justify migration

**Strengths**:
- ⭐⭐ Accuracy (marginal vs. current)
- ⭐⭐⭐⭐⭐ Efficiency
- ⭐⭐⭐⭐ Modularity
- ⭐⭐⭐⭐⭐ Bundle Size

**Use When**: Never (use current amplitude-based instead)

---

### 4. Picovoice Cobra (NOT RECOMMENDED)

**Verdict**: API key requirement incompatible with open-source model

**Strengths**:
- ⭐⭐⭐⭐⭐ Accuracy
- ⭐⭐⭐⭐ Efficiency
- ⭐⭐ Modularity (vendor lock-in)
- ⭐⭐⭐⭐ Bundle Size

**Use When**: Never (licensing friction unacceptable)

---

## Implementation Roadmap

Based on this analysis, the recommended implementation path is:

### Phase 1: Adopt @ricky0123/vad-web (CURRENT PHASE)
- **Timeline**: Week 1-2
- **Deliverables**:
  - ADR documenting decision
  - Configuration parameter mapping
  - Migration guidance
  - Implementation recommendations

### Phase 2: Integration & Testing
- **Timeline**: Week 3-4
- **Deliverables**:
  - VAD wrapper module
  - Async initialization
  - Fallback logic
  - Unit and integration tests

### Phase 3: Performance Validation
- **Timeline**: Week 5
- **Deliverables**:
  - Frame timing measurements
  - Accuracy testing
  - Browser compatibility validation
  - Memory profiling

### Phase 4: Deployment & Monitoring
- **Timeline**: Week 6+
- **Deliverables**:
  - Production deployment
  - Telemetry on bundle size impact
  - User feedback collection

### Future Consideration: Bundle Size Optimization
- **Trigger**: Telemetry shows > 5% of users experiencing > 5 second load times
- **Approach**: ORT format conversion (Phase 1 quick win)
- **Decision Point**: After 3 months of production telemetry

---

## References

- [Silero VAD GitHub Repository](https://github.com/snakers4/silero-vad)
- [@ricky0123/vad-web npm Package](https://www.npmjs.com/package/@ricky0123/vad-web)
- [ONNX Runtime Web Documentation](https://onnxruntime.ai/docs/build/web.html)
- [ONNX Runtime Custom Build Guide](https://onnxruntime.ai/docs/build/custom.html)
- [Picovoice Cobra Documentation](https://picovoice.ai/docs/cobra/)
- [Web Audio VAD GitHub](https://github.com/kdavis-mozilla/vad.js)
- [ADR-001: VAD Library Selection](/workspace/docs/adr/001-vad-library-selection.md)
- [Phase 2: VAD Integration Architecture](/workspace/docs/design/phase2-vad-integration.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-29
**Author**: Senior Software Engineer
**Reviewers**: Software Architect
