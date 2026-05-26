import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    "https://fdngtyzxcangeeanfjkf.supabase.co",
    "sb_publishable_z_PRKcvE84oOhApqVDTJ2w_8SRJtWqL",
  )
}
