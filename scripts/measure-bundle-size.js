#!/usr/bin/env node

/**
 * Bundle size measurement script for VAD integration testing
 * Measures production build size and compares before/after VAD integration
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const __dirname = __dirname

const DIST_DIR = path.resolve(__dirname, '../dist')
const REPORT_FILE = path.resolve(__dirname, '../bundle-size-report.json')

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath)
    return stats.size
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error.message)
    return 0
  }
}

/**
 * Format bytes as human-readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Get gzipped size of a file
 */
function getGzippedSize(filePath) {
  try {
    // Create temporary gzipped file
    const gzipPath = `${filePath}.gz`
    execSync(`gzip -c "${filePath}" > "${gzipPath}"`, { stdio: 'pipe' })
    const size = getFileSize(gzipPath)
    fs.unlinkSync(gzipPath)
    return size
  } catch (error) {
    console.error(`Error gzipping file ${filePath}:`, error.message)
    return 0
  }
}

/**
 * Analyze bundle files in dist directory
 */
function analyzeBundles() {
  if (!fs.existsSync(DIST_DIR)) {
    console.error(`Distribution directory not found: ${DIST_DIR}`)
    console.log('Run "npm run build" first to generate bundles.')
    process.exit(1)
  }

  const bundles = {
    cjs: path.join(DIST_DIR, 'bundle.cjs.js'),
    esm: path.join(DIST_DIR, 'bundle.esm.js'),
    umd: path.join(DIST_DIR, 'bundle.umd.js'),
  }

  const sizes = {}

  for (const [format, bundlePath] of Object.entries(bundles)) {
    if (fs.existsSync(bundlePath)) {
      const rawSize = getFileSize(bundlePath)
      const gzipSize = getGzippedSize(bundlePath)

      sizes[format] = {
        path: bundlePath,
        raw: rawSize,
        gzip: gzipSize,
        rawFormatted: formatBytes(rawSize),
        gzipFormatted: formatBytes(gzipSize),
      }

      console.log(`${format.toUpperCase()} Bundle:`)
      console.log(`  Raw: ${sizes[format].rawFormatted}`)
      console.log(`  Gzipped: ${sizes[format].gzipFormatted}`)
      console.log('')
    } else {
      console.warn(`Bundle not found: ${bundlePath}`)
    }
  }

  return sizes
}

/**
 * Calculate total bundle size
 */
function calculateTotalSize(sizes) {
  const total = {
    raw: 0,
    gzip: 0,
  }

  for (const format of Object.values(sizes)) {
    total.raw += format.raw
    total.gzip += format.gzip
  }

  return total
}

/**
 * Load previous report if available
 */
function loadPreviousReport() {
  if (fs.existsSync(REPORT_FILE)) {
    try {
      const content = fs.readFileSync(REPORT_FILE, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      console.warn('Could not load previous report:', error.message)
      return null
    }
  }
  return null
}

/**
 * Compare current build with previous
 */
function compareWithPrevious(current, previous) {
  if (!previous) {
    console.log('No previous report found for comparison.')
    return null
  }

  const comparison = {
    timestamp: new Date().toISOString(),
    bundles: {},
    total: {},
  }

  for (const [format, currentData] of Object.entries(current)) {
    if (previous.bundles[format]) {
      const prevData = previous.bundles[format]

      const rawDiff = currentData.raw - prevData.raw
      const gzipDiff = currentData.gzip - prevData.gzip

      const rawPercent = prevData.raw > 0 ? (rawDiff / prevData.raw) * 100 : 0
      const gzipPercent = prevData.gzip > 0 ? (gzipDiff / prevData.gzip) * 100 : 0

      comparison.bundles[format] = {
        rawDiff,
        gzipDiff,
        rawDiffFormatted: formatBytes(Math.abs(rawDiff)),
        gzipDiffFormatted: formatBytes(Math.abs(gzipDiff)),
        rawPercent: rawPercent.toFixed(2),
        gzipPercent: gzipPercent.toFixed(2),
      }

      const sign = rawDiff >= 0 ? '+' : '-'
      console.log(`${format.toUpperCase()} Change:`)
      console.log(
        `  Raw: ${sign}${comparison.bundles[format].rawDiffFormatted} (${sign}${Math.abs(rawPercent).toFixed(2)}%)`
      )
      console.log(
        `  Gzipped: ${sign}${comparison.bundles[format].gzipDiffFormatted} (${sign}${Math.abs(gzipPercent).toFixed(2)}%)`
      )
      console.log('')
    }
  }

  // Calculate total changes
  const currentTotal = calculateTotalSize(current)
  const previousTotal = calculateTotalSize(previous.bundles)

  const totalRawDiff = currentTotal.raw - previousTotal.raw
  const totalGzipDiff = currentTotal.gzip - previousTotal.gzip

  const totalRawPercent = previousTotal.raw > 0 ? (totalRawDiff / previousTotal.raw) * 100 : 0
  const totalGzipPercent = previousTotal.gzip > 0 ? (totalGzipDiff / previousTotal.gzip) * 100 : 0

  comparison.total = {
    rawDiff: totalRawDiff,
    gzipDiff: totalGzipDiff,
    rawPercent: totalRawPercent.toFixed(2),
    gzipPercent: totalGzipPercent.toFixed(2),
  }

  const sign = totalRawDiff >= 0 ? '+' : '-'
  console.log('Total Bundle Size Change:')
  console.log(
    `  Raw: ${sign}${formatBytes(Math.abs(totalRawDiff))} (${sign}${Math.abs(totalRawPercent).toFixed(2)}%)`
  )
  console.log(
    `  Gzipped: ${sign}${formatBytes(Math.abs(totalGzipDiff))} (${sign}${Math.abs(totalGzipPercent).toFixed(2)}%)`
  )
  console.log('')

  return comparison
}

/**
 * Save current report
 */
function saveReport(sizes, comparison) {
  const report = {
    timestamp: new Date().toISOString(),
    bundles: sizes,
    comparison,
  }

  fs.writeFileSync(REPORT_FILE, JSON.stringify(report, null, 2), 'utf-8')
  console.log(`Report saved to: ${REPORT_FILE}`)
}

/**
 * Check if bundle size meets requirements
 */
function checkRequirements(sizes, comparison) {
  console.log('========================================')
  console.log('Bundle Size Requirements Check')
  console.log('========================================')

  // Expected VAD overhead: ~1.5MB (500KB runtime + 1MB model)
  const EXPECTED_VAD_OVERHEAD_MB = 1.5
  const EXPECTED_VAD_OVERHEAD_BYTES = EXPECTED_VAD_OVERHEAD_MB * 1024 * 1024

  const total = calculateTotalSize(sizes)
  const totalGzipMB = total.gzip / 1024 / 1024

  console.log(`Current Total Gzipped Size: ${formatBytes(total.gzip)} (${totalGzipMB.toFixed(2)} MB)`)

  if (comparison && comparison.total) {
    const increaseMB = comparison.total.gzipDiff / 1024 / 1024
    console.log(`Increase from Previous: ${formatBytes(Math.abs(comparison.total.gzipDiff))} (${comparison.total.gzipPercent}%)`)

    if (comparison.total.gzipDiff > EXPECTED_VAD_OVERHEAD_BYTES) {
      console.warn(
        `⚠ WARNING: Bundle size increase (${increaseMB.toFixed(2)} MB) exceeds expected VAD overhead (${EXPECTED_VAD_OVERHEAD_MB} MB)`
      )
    } else if (comparison.total.gzipDiff > 0) {
      console.log(
        `✓ Bundle size increase (${increaseMB.toFixed(2)} MB) is within expected VAD overhead (${EXPECTED_VAD_OVERHEAD_MB} MB)`
      )
    }
  } else {
    console.log('No previous build to compare against.')
  }

  console.log('========================================')
}

/**
 * Main execution
 */
function main() {
  console.log('========================================')
  console.log('Bundle Size Measurement')
  console.log('========================================')
  console.log('')

  const sizes = analyzeBundles()
  const previous = loadPreviousReport()
  const comparison = compareWithPrevious(sizes, previous)

  saveReport(sizes, comparison)
  checkRequirements(sizes, comparison)
}

main()
