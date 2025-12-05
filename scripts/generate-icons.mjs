#!/usr/bin/env node
/**
 * Generate all required icons for Tauri app
 * Run with: node scripts/generate-icons.mjs
 */

import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(__dirname, '../src-tauri/icons')
const svgPath = join(iconsDir, 'icon.svg')

// Read SVG
const svgBuffer = readFileSync(svgPath)

// Standard app icon sizes (256 for 128x128@2x, plus explicit 256x256)
const iconSizes = [16, 32, 48, 64, 128, 256, 512]
const extraSizes = [256] // Explicit 256x256.png needed by config

// NSIS installer specific images (PNG format - supported in Tauri 2)
const nsisImages = [
  { name: 'nsis-header.png', width: 150, height: 57 },      // Header banner
  { name: 'nsis-sidebar.png', width: 164, height: 314 },   // Sidebar wizard image
]

async function generateIcons() {
  console.log('Generating icons from SVG...\n')

  // Generate standard PNG icons
  for (const size of iconSizes) {
    // 256 goes to 128x128@2x.png (Retina)
    const filename = size === 256 ? '128x128@2x.png' : `${size}x${size}.png`
    const outputPath = join(iconsDir, filename)
    
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath)
    
    console.log(`✓ ${filename}`)
  }
  
  // Also generate explicit 256x256.png (required by tauri config)
  await sharp(svgBuffer)
    .resize(256, 256)
    .png()
    .toFile(join(iconsDir, '256x256.png'))
  console.log(`✓ 256x256.png`)

  // Generate NSIS installer images
  console.log('\nGenerating NSIS installer images...\n')
  
  for (const { name, width, height } of nsisImages) {
    const outputPath = join(iconsDir, name)
    
    // Create a background with the icon centered
    // For header: icon on left side
    // For sidebar: icon centered vertically
    
    const iconSize = Math.min(width, height) - 8 // Leave some padding
    const iconBuffer = await sharp(svgBuffer)
      .resize(iconSize, iconSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
      .png()
      .toBuffer()
    
    // Create white background and composite icon
    if (name.includes('header')) {
      // Header: icon on left, text area on right
      await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
        .composite([{
          input: iconBuffer,
          left: 4,
          top: Math.floor((height - iconSize) / 2)
        }])
        .png()
        .toFile(outputPath)
    } else {
      // Sidebar: icon centered at top
      await sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        }
      })
        .composite([{
          input: iconBuffer,
          left: Math.floor((width - iconSize) / 2),
          top: 40 // Top portion of sidebar
        }])
        .png()
        .toFile(outputPath)
    }
    
    console.log(`✓ ${name} (${width}x${height})`)
  }

  console.log('\n✅ All icons generated successfully!')
  console.log('\nUpdate tauri.conf.json to use the new NSIS images:')
  console.log('  "headerImage": "icons/nsis-header.png"')
  console.log('  "sidebarImage": "icons/nsis-sidebar.png"')
}

generateIcons().catch(console.error)
