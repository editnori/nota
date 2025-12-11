// Platform/environment helpers shared across app

// Check if running in Tauri desktop app (Tauri 1.x or 2.x)
export function isTauri(): boolean {
  return (
    typeof window !== 'undefined' &&
    ('__TAURI_INTERNALS__' in window || '__TAURI__' in window)
  )
}

