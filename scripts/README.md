# Scripts Directory

This directory contains utility scripts for the Utterance Emitter project.

## measure-bundle-size.js

Measures production bundle size and tracks changes over time.

### Purpose

- Measure raw and gzipped bundle sizes for all output formats (CJS, ESM, UMD)
- Compare current build with previous build
- Validate bundle size increases meet requirements (< 1.5 MB for VAD integration)
- Track bundle size trends over time

### Usage

```bash
# Build the project first
npm run build

# Run bundle size measurement
npm run test:bundle-size

# Or run directly
node scripts/measure-bundle-size.js
```

### Requirements

- Project must be built (`npm run build`) before running
- `gzip` command must be available on system (standard on Unix/Linux/macOS)
- `dist/` directory must exist with bundle files

### Output

The script generates:

1. **Console Output**: Human-readable report with:
   - Individual bundle sizes (CJS, ESM, UMD)
   - Raw and gzipped sizes
   - Comparison with previous build
   - Percentage changes
   - Validation against expected VAD overhead

2. **JSON Report**: `bundle-size-report.json` containing:
   - Timestamp
   - Bundle sizes (raw and gzipped)
   - Comparison data (if previous report exists)
   - Historical tracking data

### Example Output

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

Report saved to: /path/to/bundle-size-report.json
```

### Integration

#### npm Scripts

Added to `package.json`:

```json
{
  "scripts": {
    "test:bundle-size": "npm run build && node scripts/measure-bundle-size.js"
  }
}
```

#### CI/CD Integration

Example GitHub Actions workflow:

```yaml
- name: Build Project
  run: npm run build

- name: Measure Bundle Size
  run: node scripts/measure-bundle-size.js

- name: Upload Bundle Size Report
  uses: actions/upload-artifact@v3
  with:
    name: bundle-size-report
    path: bundle-size-report.json
```

### Report Format

The JSON report has the following structure:

```json
{
  "timestamp": "2025-11-29T10:30:00.000Z",
  "bundles": {
    "cjs": {
      "path": "/path/to/dist/bundle.cjs.js",
      "raw": 148808,
      "gzip": 43192,
      "rawFormatted": "145.32 KB",
      "gzipFormatted": "42.18 KB"
    },
    "esm": {
      "path": "/path/to/dist/bundle.esm.js",
      "raw": 146298,
      "gzip": 42558,
      "rawFormatted": "142.87 KB",
      "gzipFormatted": "41.56 KB"
    },
    "umd": {
      "path": "/path/to/dist/bundle.umd.js",
      "raw": 152484,
      "gzip": 44052,
      "rawFormatted": "148.91 KB",
      "gzipFormatted": "43.02 KB"
    }
  },
  "comparison": {
    "timestamp": "2025-11-29T10:30:00.000Z",
    "bundles": {
      "esm": {
        "rawDiff": 1490000,
        "gzipDiff": 524800,
        "rawDiffFormatted": "1.42 MB",
        "gzipDiffFormatted": "512.34 KB",
        "rawPercent": "1024.50",
        "gzipPercent": "1232.10"
      }
    },
    "total": {
      "rawDiff": 1555200,
      "gzipDiff": 547584,
      "rawPercent": "1018.30",
      "gzipPercent": "1272.80"
    }
  }
}
```

### Thresholds

The script validates against the following thresholds:

- **Expected VAD Overhead**: 1.5 MB gzipped
  - ONNX Runtime WASM: ~500 KB
  - Silero VAD Model: ~1 MB
  - Worklet bundle: ~50 KB

If bundle size increase exceeds expected overhead, a warning is displayed.

### Troubleshooting

**Error: Distribution directory not found**

Solution: Run `npm run build` first to generate bundle files.

---

**Error: gzip command not found**

Solution: Install gzip:
- macOS: Pre-installed
- Linux: `sudo apt-get install gzip` or `sudo yum install gzip`
- Windows: Use WSL or install gzip for Windows

---

**Warning: Bundle size increase exceeds expected overhead**

Solution: Review bundle configuration and dependencies:
1. Check for duplicate dependencies
2. Verify tree-shaking is working
3. Ensure dev dependencies aren't included
4. Consider lazy loading VAD model

### Files Generated

- `bundle-size-report.json` - Current bundle size report (root directory)

### Version History

- **v1.0.0** (2025-11-29): Initial implementation
  - Raw and gzipped size measurement
  - Before/after comparison
  - Threshold validation
  - JSON report export

### Future Enhancements

Potential improvements for future versions:

1. **Historical Tracking**: Store multiple reports for trend analysis
2. **Bundle Analysis**: Break down bundle by module/dependency
3. **Size Limits**: Configurable size limits that fail CI if exceeded
4. **Visualization**: Generate charts showing size trends over time
5. **Dependency Analysis**: Report size contribution by dependency
6. **Compression Comparison**: Test multiple compression algorithms (brotli, etc.)

### Related Documentation

- [TESTING_GUIDE.md](../TESTING_GUIDE.md) - Complete testing procedures
- [ACCEPTANCE_CRITERIA.md](../docs/ACCEPTANCE_CRITERIA.md) - Criterion #5 (Bundle Size Impact)
- [rollup.config.js](../rollup.config.js) - Bundle configuration
