# Voice Activity Detection (VAD) Documentation

This directory contains comprehensive documentation for the Voice Activity Detection (VAD) integration into the UtteranceEmitter component.

## Quick Navigation

### 📋 Start Here

- **[Phase 4 Completion Summary](PHASE4_COMPLETION_SUMMARY.md)** - Executive summary of all documentation and decisions
- **[Architecture Decision Record (ADR-001)](adr/001-vad-library-selection.md)** - Official decision to adopt @ricky0123/vad-web

### 🔬 Research & Analysis

- **[VAD Library Comparison](research/vad-library-comparison.md)** - Comprehensive evaluation of 4 VAD libraries with ranked recommendations
- **[Bundle Size Optimization Analysis](research/bundle-size-optimization-analysis.md)** - Cost-benefit analysis of custom ONNX Runtime builds vs. lazy loading strategy

### ⚙️ Configuration & Migration

- **[Configuration Parameter Mapping](configuration/vad-parameter-mapping.md)** - volumeThreshold → vadThreshold mapping with default value justification
- **[Migration Guide](migration/vad-migration-guide.md)** - Step-by-step guide for existing users to transition to VAD

### 📚 Examples & Tuning

- **[Sensitivity Tuning Examples](examples/vad-sensitivity-tuning.md)** - Environment-specific, speaker-specific, and application-specific tuning examples

### 🛠️ Implementation

- **[Implementation Recommendations](implementation/vad-implementation-recommendations.md)** - Detailed step-by-step guide for Phase 5 integration

---

## Documentation Structure

```
docs/
├── README.md                                           (This file)
├── PHASE4_COMPLETION_SUMMARY.md                        (Executive summary)
│
├── adr/                                                (Architecture Decision Records)
│   └── 001-vad-library-selection.md                    (VAD library selection ADR)
│
├── research/                                           (Research & Analysis)
│   ├── vad-library-comparison.md                       (Library comparison matrix)
│   └── bundle-size-optimization-analysis.md            (Bundle optimization analysis)
│
├── configuration/                                      (Configuration Documentation)
│   └── vad-parameter-mapping.md                        (Parameter mapping & defaults)
│
├── migration/                                          (Migration Guides)
│   └── vad-migration-guide.md                          (User migration guide)
│
├── examples/                                           (Examples & Tutorials)
│   └── vad-sensitivity-tuning.md                       (Tuning examples)
│
└── implementation/                                     (Implementation Guides)
    └── vad-implementation-recommendations.md           (Phase 5 implementation guide)
```

---

## Document Categories

### Architecture Decision Records (ADRs)

ADRs document significant architectural decisions with rationale, consequences, and alternatives considered.

- **[ADR-001: VAD Library Selection](adr/001-vad-library-selection.md)**
  - **Decision**: Adopt @ricky0123/vad-web (Silero VAD via ONNX Runtime Web)
  - **Status**: Proposed
  - **Date**: 2025-11-29

### Research Documents

Research documents provide detailed analysis and comparisons to support decision-making.

- **[VAD Library Comparison](research/vad-library-comparison.md)**: 11-criteria comparison of 4 VAD libraries
- **[Bundle Size Optimization Analysis](research/bundle-size-optimization-analysis.md)**: Analysis of custom ONNX Runtime builds vs. lazy loading

### Configuration Documentation

Configuration documents explain parameter mappings, defaults, and usage.

- **[VAD Parameter Mapping](configuration/vad-parameter-mapping.md)**: Complete parameter reference with examples

### Migration Guides

Migration guides help existing users transition to new features.

- **[VAD Migration Guide](migration/vad-migration-guide.md)**: Backward compatibility, migration paths, troubleshooting

### Examples & Tutorials

Examples provide practical guidance for common use cases.

- **[Sensitivity Tuning Examples](examples/vad-sensitivity-tuning.md)**: 20+ tuning examples across environments, speakers, and applications

### Implementation Guides

Implementation guides provide step-by-step instructions for developers.

- **[VAD Implementation Recommendations](implementation/vad-implementation-recommendations.md)**: Phase 5 integration guide with code examples

---

## Key Decisions

### 1. Library Selection: @ricky0123/vad-web

**Chosen**: Silero VAD via ONNX Runtime Web

**Why**:
- ✅ Production-grade accuracy (⭐⭐⭐⭐⭐)
- ✅ Efficient WASM execution (1-5ms per frame)
- ✅ Active maintenance and broad deployment
- ✅ Configurable sensitivity
- ✅ No API key requirement

**Rejected**:
- ❌ Picovoice Cobra (API key requirement)
- ❌ Web Audio VAD (marginal accuracy improvement)
- ❌ Custom ONNX Build (high engineering cost)

**Reference**: [ADR-001](adr/001-vad-library-selection.md)

---

### 2. Bundle Size Strategy: Lazy Loading + CDN Caching

**Chosen**: NO custom ONNX Runtime build

**Why**:
- ✅ Zero engineering overhead
- ✅ Main bundle stays small (0KB VAD at startup)
- ✅ One-time 1.5MB download per user device
- ✅ Browser caching for all future sessions

**Engineering Cost**: 2-4 hours (lazy loading + CDN setup)

**Alternative**: Custom ONNX build (20-40+ hours for 650KB max savings)

**Reference**: [Bundle Size Optimization Analysis](research/bundle-size-optimization-analysis.md)

---

### 3. Configuration Defaults

**Chosen**:
- `vadEnabled: true` (VAD enabled by default)
- `vadThreshold: 0.5` (balanced detection)
- `vadFallback: true` (graceful degradation)

**Why**:
- Optimal out-of-box experience for most users
- 0.5 threshold validated by Silero VAD training
- Fallback ensures reliability

**Reference**: [Configuration Parameter Mapping](configuration/vad-parameter-mapping.md)

---

### 4. Backward Compatibility: Zero Breaking Changes

**Chosen**: Extend EmitterConfig with optional parameters

**Why**:
- Existing `volumeThreshold` preserved
- Existing code runs without modifications
- VAD is opt-out (can be disabled)

**Reference**: [Migration Guide](migration/vad-migration-guide.md)

---

## Usage Quick Start

### For Users: Migrating to VAD

1. **Read**: [Migration Guide](migration/vad-migration-guide.md)
2. **Review**: [Configuration Examples](configuration/vad-parameter-mapping.md#configuration-examples)
3. **Tune**: [Sensitivity Tuning Examples](examples/vad-sensitivity-tuning.md)

**No code changes required!** VAD is enabled by default with backward-compatible configuration.

---

### For Developers: Implementing VAD

1. **Read**: [Implementation Recommendations](implementation/vad-implementation-recommendations.md)
2. **Review**: [ADR-001](adr/001-vad-library-selection.md) for decision context
3. **Follow**: Step-by-step implementation guide in recommendations document

**Phase 5 checklist**: 10 implementation steps with code examples provided.

---

## Common Questions

### Q: Do I need to change my existing code?

**A**: No! VAD is enabled by default with backward-compatible configuration. Your existing `volumeThreshold` parameter continues to work.

**Reference**: [Migration Guide - Path 1: Zero-Change Migration](migration/vad-migration-guide.md#path-1-zero-change-migration-recommended-for-most-users)

---

### Q: How much will VAD increase my bundle size?

**A**: ~1.5MB (500KB ONNX Runtime + 1MB Silero model), but it's lazy-loaded when the user starts recording (not in main bundle). Browser caches it for all future sessions.

**Reference**: [Bundle Size Optimization Analysis](research/bundle-size-optimization-analysis.md#current-bundle-size-breakdown)

---

### Q: What if I have a strict bundle size budget?

**A**: Disable VAD with `vadEnabled: false`. You'll fall back to amplitude-based detection (same as before).

**Reference**: [Migration Guide - Path 3: Disable VAD](migration/vad-migration-guide.md#path-3-disable-vad-bundle-size-sensitive)

---

### Q: How do I tune VAD sensitivity for my environment?

**A**: Adjust `vadThreshold`:
- **Noisy environment** (office, cafe): `0.7`
- **Balanced** (default): `0.5`
- **Quiet speaker**: `0.3`

**Reference**: [Sensitivity Tuning Examples](examples/vad-sensitivity-tuning.md)

---

### Q: Should I build a custom ONNX Runtime to reduce bundle size?

**A**: No, unless you have a hard bundle budget constraint (< 500KB total VAD). Lazy loading + CDN caching is recommended instead.

**Engineering Cost**: 20-40+ hours for custom build vs. 2-4 hours for lazy loading
**Savings**: 650KB max

**Reference**: [Bundle Size Optimization Analysis - Decision Framework](research/bundle-size-optimization-analysis.md#decision-framework)

---

## Phase Status

### ✅ Completed Phases

- **Phase 1: Research** - Library evaluation completed
- **Phase 2: Design** - Integration architecture designed
- **Phase 3: Evaluation** - Performance validation completed
- **Phase 4: Documentation** - All documentation created (current phase)

### ⏸️ Next Phase

- **Phase 5: Integration** - Implement VAD integration following [Implementation Recommendations](implementation/vad-implementation-recommendations.md)

### 📋 Future Phases

- **Phase 6: Testing** - Unit, integration, and E2E tests
- **Phase 7: Deployment** - Production rollout with monitoring

---

## Document Statistics

- **Total Files**: 8 documentation files
- **Total Lines**: ~5,500 lines
- **Total Words**: ~37,000 words
- **Coverage**:
  - ✅ Architecture Decisions
  - ✅ Research & Analysis
  - ✅ Configuration & Mapping
  - ✅ Migration & Compatibility
  - ✅ Examples & Tuning
  - ✅ Implementation Guides

---

## Contributing

When adding new documentation:

1. Place in appropriate category directory (`adr/`, `research/`, `configuration/`, etc.)
2. Follow existing document structure and formatting
3. Cross-reference related documents
4. Update this README with new document links
5. Update [PHASE4_COMPLETION_SUMMARY.md](PHASE4_COMPLETION_SUMMARY.md) if documenting major decisions

---

## References

- **Issue**: [#40 - Voice Activity Detection Implementation](https://github.com/your-repo/issues/40)
- **Parent Issue**: Part of broader VAD integration initiative
- **External Resources**:
  - [Silero VAD GitHub](https://github.com/snakers4/silero-vad)
  - [@ricky0123/vad-web npm package](https://www.npmjs.com/package/@ricky0123/vad-web)
  - [ONNX Runtime Web Documentation](https://onnxruntime.ai/docs/build/web.html)

---

**Last Updated**: 2025-11-29
**Phase**: Phase 4 Complete
**Next Action**: Begin Phase 5 Implementation
