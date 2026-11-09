import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('../', import.meta.url))
const patch = new URL('../patches/capacitor-health-8.12.0-android-source.patch', import.meta.url)
const input = readFileSync(patch, 'utf8').replaceAll('\r\n', '\n')
const applied = spawnSync('git', ['apply', '--reverse', '--check', '-'], { cwd, input, stdio: ['pipe', 'ignore', 'ignore'] })
if (applied.status !== 0) {
  const result = spawnSync('git', ['apply', '-'], { cwd, input, stdio: ['pipe', 'inherit', 'inherit'] })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error('Could not apply the Android Health Connect source filter patch.')
}
