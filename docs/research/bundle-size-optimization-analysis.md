# Bundle Size Optimization Analysis

**Research Phase**: Phase 4 - Documentation
**Issue**: #40 - Voice Activity Detection Implementation
**Date**: 2025-11-29

## Executive Summary

This document analyzes the feasibility and cost-benefit trade-offs of producing a smaller VAD implementation by directly implementing Silero VAD with an optimized ONNX Runtime build as part of this project.

**Key Findings**:
- **Potential Savings**: 350-650KB (reducing 1.5MB → 850KB-1.15MB)
- **Engineering Cost**: 20-40+ hours initial setup + ongoing maintenance burden
- **Recommendation**: **DO NOT pursue custom build** unless hard bundle budget constraint exists
- **Alternative Strategy**: Lazy loading + CDN caching provides acceptable user experience with zero engineering overhead

## Current Bundle Size Breakdown

### @ricky0123/vad-web Components

| Component | Size | Purpose | Compressibility |
|-----------|------|---------|----------------|
| ONNX Runtime Web WASM | 450-500KB | WebAssembly execution engine | Low (binary) |
| Silero VAD Model (V5) | 1-2MB | Neural network weights | Medium (ORT format) |
| Library Wrapper | ~50KB | JavaScript API layer | High (gzip) |
| **Total** | **~1.5MB** | Complete VAD solution | **~1.2MB gzipped** |

### Size Context

- **Compared to popular libraries**:
  - React: ~130KB (minified)
  - Vue: ~90KB (minified)
  - Lodash: ~70KB (minified)
  - Moment.js: ~230KB (minified)
  - **@ricky0123/vad-web: ~1.5MB** (10x larger than typical library)

- **User impact**:
  - **Broadband (10 Mbps)**: 1.2 seconds download
  - **4G (5 Mbps)**: 2.4 seconds download
  - **3G (750 Kbps)**: 16 seconds download
  - **2G (250 Kbps)**: 48 seconds download

## Optimization Opportunities

### 1. Minimal ONNX Runtime Build

#### Strategy

ONNX Runtime supports [custom builds](https://onnxruntime.ai/docs/build/custom.html) that include only operators required by a specific model. The standard ONNX Runtime Web build includes 100+ operators, but Silero VAD uses only a subset.

#### Implementation Steps

1. **Extract Model Operators**: Analyze Silero VAD ONNX model to identify required operators
   ```bash
   python -m onnxruntime.tools.check_onnx_model_mobile_usability silero_vad.onnx
   ```

2. **Generate Operator Config**: Create required_operators.config listing only needed ops
   ```
   Conv
   Reshape
   LSTM
   Sigmoid
   # ... (estimated 15-20 operators for Silero VAD)
   ```

3. **Build Custom WASM**: Use Emscripten to compile minimal runtime
   ```bash
   ./build.sh --config Release --build_wasm \
     --include_ops_by_config required_operators.config \
     --minimal_build
   ```

4. **Integration**: Replace @ricky0123/vad-web's ONNX Runtime with custom build

#### Potential Savings

- **Current runtime**: 450-500KB
- **Minimal runtime**: 250-350KB (estimated, operator-dependent)
- **Savings**: **150-250KB** (30-50% reduction)

#### Engineering Cost

- **Initial setup**: 8-16 hours
  - Emscripten toolchain setup: 2-4 hours
  - Operator analysis and config generation: 2-3 hours
  - Custom build and debugging: 3-6 hours
  - Cross-browser testing: 1-3 hours

- **Ongoing maintenance**: 4-8 hours per ONNX Runtime major version
  - Track upstream ONNX Runtime updates
  - Rebuild and retest for each version
  - Handle breaking changes in operator APIs

#### Risks

- **Build Complexity**: Emscripten requires specific toolchain versions, Linux/macOS environment
- **Browser Compatibility**: Custom WASM may have edge cases not tested by ONNX Runtime team
- **Operator Updates**: Silero VAD model updates may require new operators, breaking minimal build
- **Debugging Difficulty**: Minimal builds have fewer error messages, harder to diagnose issues

---

### 2. ORT Format Conversion

#### Strategy

ONNX Runtime's [ORT format](https://onnxruntime.ai/docs/performance/model-optimizations.html#ort-format) is an optimized binary representation of ONNX models, designed for:
- Faster initialization (pre-optimized graph)
- Smaller file size (more efficient encoding)
- Lower peak memory usage

#### Implementation Steps

1. **Convert Model**: Use ONNX Runtime's conversion tool
   ```bash
   python -m onnxruntime.tools.convert_onnx_models_to_ort \
     --optimization_style=Fixed \
     silero_vad.onnx
   ```

2. **Host Optimized Model**: Replace model URL in vad-web configuration
   ```typescript
   const vad = await MicVAD.new({
     modelURL: "/silero_vad.ort",  // ORT format instead of ONNX
     // ...
   })
   ```

3. **Validate Accuracy**: Ensure ORT conversion doesn't degrade VAD performance

#### Potential Savings

- **Current model**: 1-2MB (ONNX format)
- **Optimized model**: 1.5-1.7MB (ORT format, estimated)
- **Savings**: **200-500KB** (15-25% reduction)

#### Engineering Cost

- **Initial setup**: 2-4 hours
  - Install ONNX Runtime conversion tools: 30 minutes
  - Convert model and validate: 1-2 hours
  - Integration testing: 1 hour
  - Accuracy validation: 30 minutes

- **Ongoing maintenance**: 1-2 hours per Silero VAD model update
  - Re-run conversion for new model versions
  - Validate compatibility

#### Risks

- **Format Compatibility**: ORT format support in ONNX Runtime Web requires recent version (check @ricky0123/vad-web dependency)
- **Accuracy Validation**: Must verify ORT conversion doesn't introduce precision loss
- **Upstream Changes**: Silero team may update model architecture, requiring re-conversion

**Note**: This is the **lowest-risk, highest-value optimization** (2-4 hours for 200-500KB savings).

---

### 3. Model Quantization

#### Strategy

Neural network quantization reduces model size by converting weights from 32-bit floating point to lower precision (e.g., 8-bit integers).

#### Silero VAD Team Findings

The Silero VAD team [explicitly tested and rejected quantization](https://github.com/snakers4/silero-vad/wiki/FAQ#why-dont-you-quantize-models):

> "We tested quantization extensively and found:
> - No performance improvement on WASM targets
> - ARM/mobile device compatibility issues
> - Minimal size reduction on already-compressed model
> - Potential accuracy degradation"

#### Potential Savings

- **Estimated savings**: < 100KB (Silero team reports minimal benefit)
- **Risk**: Accuracy degradation, compatibility issues

#### Recommendation

**DO NOT pursue quantization.** Upstream maintainers have already validated this approach and rejected it. Trust their domain expertise.

---

### 4. Lazy Loading Strategy (NO BUILD CHANGES)

#### Strategy

Instead of bundling VAD in main application bundle, load it on-demand when user initiates audio recording.

#### Implementation

```typescript
class UtteranceEmitter {
  private vadModule: typeof import("@ricky0123/vad-web") | null = null;

  async handleStream(stream: MediaStream) {
    // Lazy load VAD only when stream starts
    if (!this.vadModule) {
      this.vadModule = await import("@ricky0123/vad-web");
    }

    const vad = await this.vadModule.MicVAD.new({
      // ... configuration
    });
  }
}
```

#### User Impact

- **Application startup**: 0KB VAD overhead (not in initial bundle)
- **First recording**: 1.5MB download + 500-2000ms initialization
- **Subsequent recordings**: 0KB (cached) + instant initialization

#### Engineering Cost

- **Initial setup**: 1-2 hours (implement lazy loading)
- **Ongoing maintenance**: 0 hours (no build toolchain)

#### Benefits

- ✅ **Zero build complexity**
- ✅ **No maintenance burden**
- ✅ **Main bundle stays small**
- ✅ **One-time download per user device** (browser caches model)

**Recommendation**: This should be the **default strategy**, regardless of whether custom builds are pursued.

---

### 5. CDN Caching Strategy (NO BUILD CHANGES)

#### Strategy

Host VAD model files on CDN with aggressive caching headers.

#### Implementation

```typescript
const vad = await MicVAD.new({
  modelURL: "https://cdn.example.com/silero_vad.onnx",
  modelFetch: (url) => fetch(url, {
    cache: "force-cache",  // Aggressive caching
  }),
})
```

**CDN Configuration** (example: Cloudflare):
```
Cache-Control: public, max-age=31536000, immutable
```

#### User Impact

- **First visit**: 1.5MB download
- **All subsequent visits**: 0KB (served from cache)
- **Across pages**: 0KB (shared cache for entire domain)

#### Engineering Cost

- **Initial setup**: 1-2 hours (CDN configuration)
- **Ongoing maintenance**: 0 hours

**Recommendation**: This should be the **default strategy** for production deployments.

---

## Cost-Benefit Analysis

### Custom ONNX Build Scenario

| Metric | Custom Build | @ricky0123/vad-web |
|--------|--------------|-------------------|
| **Bundle Size** | 850KB-1.15MB | 1.5MB |
| **Savings** | 350-650KB | - |
| **Initial Engineering** | 20-40 hours | 2-4 hours (lazy load + CDN) |
| **Ongoing Maintenance** | 4-8 hours/version | 0 hours |
| **Build Complexity** | High (Emscripten toolchain) | None |
| **Testing Burden** | High (custom WASM validation) | Low (npm package) |
| **Modularity** | Low (self-maintained) | High (community-maintained) |
| **Risk** | Medium-High (compatibility) | Low (production-tested) |

### User Experience Impact

**Scenario 1: Custom Build (850KB) with Lazy Loading**
- **First recording** (3G user): 9 seconds download
- **Subsequent recordings**: instant (cached)

**Scenario 2: @ricky0123/vad-web (1.5MB) with Lazy Loading**
- **First recording** (3G user): 16 seconds download
- **Subsequent recordings**: instant (cached)

**Delta**: 7 seconds one-time difference for 3G users

**Scenario 3: @ricky0123/vad-web (1.5MB) with Lazy Loading + CDN**
- **First recording** (3G user): 16 seconds download
- **All future sessions**: instant (CDN cache)

**Delta vs. Custom Build**: 7 seconds one-time difference, amortized across entire user lifetime

---

## Decision Framework

### When to Pursue Custom ONNX Build

Custom optimization is justified **ONLY IF** any of these conditions apply:

#### 1. Hard Bundle Budget Constraint
- **Trigger**: Project has < 500KB total VAD budget
- **Example**: Embedded system with strict storage limits

#### 2. Target Users on 2G/3G Networks
- **Trigger**: > 20% of users on slow connections
- **Example**: International application with significant developing-world user base
- **Measurement**: Telemetry shows > 10% of users experiencing > 10 second load times

#### 3. Multiple ONNX-Based Features
- **Trigger**: Planning to integrate 3+ ONNX models
- **Example**: VAD + speaker diarization + speech-to-text
- **Benefit**: Amortize Emscripten toolchain cost across multiple features

### When to Use Lazy Loading + CDN (RECOMMENDED)

Use this approach **BY DEFAULT** when:

- ✅ No hard bundle budget constraint
- ✅ Majority of users on broadband/4G
- ✅ Single ONNX model deployment
- ✅ Prefer maintainability over marginal size savings

**Current Project Status**: Meets all criteria for lazy loading + CDN approach.

---

## Recommended Strategy

### Phase 1: Lazy Loading + CDN (IMPLEMENT NOW)

**Effort**: 2-4 hours
**Savings**: Effective 1.5MB reduction from main bundle
**Maintenance**: 0 hours ongoing

**Implementation**:
1. Add lazy import for @ricky0123/vad-web in `handleStream()`
2. Configure CDN caching for model files
3. Document bundle size impact in README

**User Experience**:
- Main application loads instantly (no VAD overhead)
- First recording: 1.5MB download + 1-2 second initialization
- All subsequent use: instant (cached)

---

### Phase 2: Monitor & Measure (3 MONTHS)

**Effort**: 4-8 hours (telemetry setup)

**Implementation**:
1. Add telemetry for VAD initialization time
2. Track percentage of users experiencing > 5 second load times
3. Collect user feedback on performance

**Decision Point**: After 3 months, evaluate telemetry:
- **< 5% users affected**: No further optimization needed
- **5-10% users affected**: Consider ORT format conversion (Phase 3a)
- **> 10% users affected**: Consider custom ONNX build (Phase 3b)

---

### Phase 3a: ORT Format Conversion (IF NEEDED)

**Trigger**: 5-10% of users experiencing slow load times
**Effort**: 2-4 hours
**Savings**: 200-500KB (1.5MB → 1-1.3MB)
**Maintenance**: 1-2 hours per model update

**Implementation**:
1. Convert Silero VAD to ORT format
2. Update model URL in configuration
3. Validate accuracy (no regression)
4. Deploy and re-measure telemetry

---

### Phase 3b: Custom ONNX Build (IF CRITICAL)

**Trigger**: > 10% of users experiencing slow load times AND hard budget constraint
**Effort**: 20-40 hours initial + 4-8 hours per version
**Savings**: 350-650KB (1.5MB → 850KB-1.15MB)
**Maintenance**: Ongoing burden

**Implementation**:
1. Set up Emscripten build environment
2. Analyze Silero VAD operators
3. Generate minimal operator config
4. Build custom ONNX Runtime WASM
5. Extensive cross-browser testing
6. Document build process
7. Set up CI/CD for automated builds

**Consider only if**:
- Telemetry proves significant user impact
- Hard bundle budget constraint exists
- Resources available for ongoing maintenance

---

## Technical Implementation Details

### Lazy Loading Code Example

```typescript
// src/vad-loader.ts
export class VADLoader {
  private static instance: typeof import("@ricky0123/vad-web") | null = null;

  static async load(): Promise<typeof import("@ricky0123/vad-web")> {
    if (!this.instance) {
      console.log("Loading VAD module...");
      const start = performance.now();

      this.instance = await import("@ricky0123/vad-web");

      const elapsed = performance.now() - start;
      console.log(`VAD module loaded in ${elapsed}ms`);

      // Optional: Send telemetry
      this.sendTelemetry({ event: "vad_load", duration: elapsed });
    }

    return this.instance;
  }

  private static sendTelemetry(data: any) {
    // Implement telemetry reporting
  }
}

// src/index.ts
class UtteranceEmitter {
  async handleStream(stream: MediaStream) {
    const vadModule = await VADLoader.load();

    const vad = await vadModule.MicVAD.new({
      modelURL: "https://cdn.example.com/silero_vad.onnx",
      // ... configuration
    });
  }
}
```

### CDN Configuration Example

**Cloudflare Workers** (serverless edge caching):
```javascript
addEventListener("fetch", event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  const cache = caches.default
  let response = await cache.match(request)

  if (!response) {
    response = await fetch(request)

    // Clone and add cache headers
    response = new Response(response.body, response)
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable")

    event.waitUntil(cache.put(request, response.clone()))
  }

  return response
}
```

---

## Conclusion

### Decision: DO NOT Pursue Custom ONNX Build

**Rationale**:
1. **Engineering cost (20-40+ hours) outweighs marginal benefit (650KB max savings)**
2. **Lazy loading + CDN caching provides acceptable UX with zero build complexity**
3. **No hard bundle budget constraint exists for this project**
4. **Maintainability and modularity are higher priorities than size optimization**

### Recommended Approach

1. ✅ **Implement lazy loading** (2-4 hours)
2. ✅ **Configure CDN caching** (1-2 hours)
3. ✅ **Document bundle size impact** in README and migration guide
4. ⏸️ **Monitor telemetry** for 3 months
5. ⚠️ **Consider ORT format conversion** only if telemetry shows user impact
6. ❌ **Do NOT implement custom ONNX build** unless critical user impact proven

### Alternative Path (If Constraints Change)

If future requirements introduce hard bundle constraints:
1. Start with **ORT format conversion** (2-4 hours, 200-500KB savings)
2. Measure impact
3. **Only then** consider custom ONNX Runtime build (20-40+ hours, additional 150-250KB savings)

---

## References

- [ONNX Runtime Custom Build Documentation](https://onnxruntime.ai/docs/build/custom.html)
- [ONNX Runtime Model Optimizations](https://onnxruntime.ai/docs/performance/model-optimizations.html)
- [Silero VAD FAQ on Quantization](https://github.com/snakers4/silero-vad/wiki/FAQ#why-dont-you-quantize-models)
- [Emscripten Documentation](https://emscripten.org/docs/getting_started/downloads.html)
- [Web Performance: Code Splitting](https://web.dev/code-splitting/)
- [ADR-001: VAD Library Selection](/workspace/docs/adr/001-vad-library-selection.md)

---

**Document Version**: 1.0
**Last Updated**: 2025-11-29
**Author**: Senior Software Engineer
**Reviewers**: Software Architect
