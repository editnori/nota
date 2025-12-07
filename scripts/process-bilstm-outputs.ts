#!/usr/bin/env bun
/**
 * Process BiLSTM outputs through the TypeScript formatter
 * 
 * Usage:
 *   cd nota && bun run scripts/process-bilstm-outputs.ts
 *   cd nota && bun run scripts/process-bilstm-outputs.ts --limit 100
 */

import { readdir, readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join, relative, dirname } from 'path'
import { formatNoteText } from '../src/lib/formatter'

// Config
const projectRoot = join(import.meta.dir, '..', '..')
const inputDir = join(projectRoot, 'outputs', 'bilstm_formatted')
const outputDir = join(projectRoot, 'outputs', 'hybrid_formatted')

// Parse args
const args = process.argv.slice(2)
let limit: number | null = null
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--limit' && args[i + 1]) {
    limit = parseInt(args[++i], 10)
  }
}

// Get all .txt files recursively
async function getAllFiles(dir: string): Promise<string[]> {
  const files: string[] = []
  
  async function walk(currentDir: string) {
    const entries = await readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = join(currentDir, entry.name)
      if (entry.isDirectory()) {
        await walk(fullPath)
      } else if (entry.name.endsWith('.txt')) {
        files.push(fullPath)
      }
    }
  }
  
  await walk(dir)
  return files
}

// Main
async function main() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  BiLSTM → TypeScript Formatter Pipeline')
  console.log('═══════════════════════════════════════════════════════════')
  console.log()
  
  if (!existsSync(inputDir)) {
    console.error(`❌ Input directory not found: ${inputDir}`)
    process.exit(1)
  }
  
  console.log(`📂 Input:  ${inputDir}`)
  console.log(`📁 Output: ${outputDir}`)
  console.log()
  
  // Get files
  let files = await getAllFiles(inputDir)
  console.log(`Found ${files.length} files`)
  
  if (limit && limit < files.length) {
    files = files.slice(0, limit)
    console.log(`Limited to ${limit} files`)
  }
  console.log()
  
  // Create output dir
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true })
  }
  
  // Process
  const startTime = Date.now()
  let processed = 0
  let errors = 0
  
  for (let i = 0; i < files.length; i++) {
    const inputPath = files[i]
    
    try {
      // Read
      const content = await readFile(inputPath, 'utf-8')
      
      // Format with TS formatter
      const formatted = formatNoteText(content)
      
      // Output path (preserve structure)
      const relativePath = relative(inputDir, inputPath)
      const outputPath = join(outputDir, relativePath)
      
      // Ensure output subdir exists
      const outSubdir = dirname(outputPath)
      if (!existsSync(outSubdir)) {
        await mkdir(outSubdir, { recursive: true })
      }
      
      // Write
      await writeFile(outputPath, formatted, 'utf-8')
      processed++
    } catch (err: any) {
      errors++
      console.error(`Error processing ${inputPath}: ${err.message}`)
    }
    
    // Progress every 100 files
    if ((i + 1) % 100 === 0 || i === files.length - 1) {
      const pct = Math.round((i + 1) / files.length * 100)
      process.stdout.write(`\rProcessing: ${i + 1}/${files.length} (${pct}%)`)
    }
  }
  
  console.log('\n')
  
  // Summary
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const rate = (processed / (Date.now() - startTime) * 1000).toFixed(1)
  
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Summary')
  console.log('═══════════════════════════════════════════════════════════')
  console.log(`  ✅ Processed: ${processed} files`)
  if (errors > 0) console.log(`  ❌ Errors: ${errors}`)
  console.log(`  ⏱️  Time: ${elapsed}s (${rate} files/sec)`)
  console.log(`  📁 Output: ${outputDir}`)
  console.log()
}

main()
