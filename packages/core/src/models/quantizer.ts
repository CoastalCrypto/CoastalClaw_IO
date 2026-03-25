import { spawn, execSync } from 'child_process'
import { mkdirSync, existsSync, writeFileSync } from 'fs'
import { join } from 'node:path'
import { ModelRegistry } from './registry.js'

export interface QuantProgress {
  type: 'quant_progress'
  step: number
  total: number
  message: string
}

export interface QuantizationPipelineConfig {
  dataDir: string
  llamaCppDir: string
  ollamaUrl: string
  onProgress: (event: QuantProgress) => void
}

type QuantLevel = 'Q4_K_M' | 'Q5_K_M' | 'Q8_0'

// GitHub release tag pinned for reproducibility — update when upgrading llama.cpp
const LLAMA_CPP_RELEASE = 'b3178'
const LLAMA_CPP_ARCHIVE_WIN = `llama-${LLAMA_CPP_RELEASE}-bin-win-cuda-cu12.2.0-x64.zip`
const LLAMA_CPP_ARCHIVE_LINUX = `llama-${LLAMA_CPP_RELEASE}-bin-ubuntu-x64.zip`

function runCommand(cmd: string, args: string[], cwd?: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true })
    proc.stderr.on('data', (d: Buffer) => process.stderr.write(d))
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed with exit code ${code}: ${cmd} ${args.join(' ')}`))
    })
  })
}

function checkPython(): void {
  try {
    execSync('python --version', { stdio: 'pipe' })
  } catch {
    throw new Error(
      'Python is required for quantization but was not found on your PATH. ' +
      'Install Python 3.10+ from https://python.org and re-run.'
    )
  }
}

async function ensureLlamaCppBinaries(llamaCppDir: string): Promise<void> {
  const binExt = process.platform === 'win32' ? '.exe' : ''
  const quantizeBin = join(llamaCppDir, `llama-quantize${binExt}`)
  if (existsSync(quantizeBin)) return

  mkdirSync(llamaCppDir, { recursive: true })
  const archive = process.platform === 'win32' ? LLAMA_CPP_ARCHIVE_WIN : LLAMA_CPP_ARCHIVE_LINUX
  const zipPath = join(llamaCppDir, 'llama.zip')
  const releaseUrl = `https://github.com/ggerganov/llama.cpp/releases/download/${LLAMA_CPP_RELEASE}/${archive}`

  await runCommand('curl', ['-L', '-o', zipPath, releaseUrl])

  if (process.platform === 'win32') {
    await runCommand('powershell', [
      '-Command',
      `Expand-Archive -Force -Path '${zipPath}' -DestinationPath '${llamaCppDir}'`,
    ])
  } else {
    await runCommand('unzip', ['-o', zipPath, '-d', llamaCppDir])
  }
}

export class QuantizationPipeline {
  constructor(private config: QuantizationPipelineConfig) {}

  async run(hfModelId: string, quants: QuantLevel[]): Promise<void> {
    if (!hfModelId.includes('/')) {
      throw new Error('hfModelId must be in owner/repo format')
    }
    if (quants.length === 0) {
      throw new Error('Must request at least one quant level')
    }

    // Pre-flight checks (not counted as progress steps)
    checkPython()
    await ensureLlamaCppBinaries(this.config.llamaCppDir)

    const modelName = hfModelId.split('/')[1].toLowerCase()
    const downloadsDir = join(this.config.dataDir, 'downloads', modelName)
    // Steps: download + convert + (quantize + ollama create + SQLite register) × quants
    const totalSteps = 2 + quants.length * 3
    mkdirSync(downloadsDir, { recursive: true })

    const progress = (step: number, message: string) =>
      this.config.onProgress({ type: 'quant_progress', step, total: totalSteps, message })

    // Step 1: Download from HuggingFace
    progress(1, `Downloading ${hfModelId} from HuggingFace...`)
    await runCommand('huggingface-cli', ['download', hfModelId, '--local-dir', downloadsDir])

    // Step 2: Convert to GGUF
    progress(2, 'Converting to GGUF format...')
    const ggufPath = join(downloadsDir, `${modelName}.gguf`)
    const convertScript = join(this.config.llamaCppDir, 'convert_hf_to_gguf.py')
    await runCommand('python', [convertScript, downloadsDir, '--outfile', ggufPath])

    const registry = new ModelRegistry(this.config.dataDir)
    let step = 3
    try {
      for (const quant of quants) {
        // Step A: Quantize
        progress(step++, `Quantizing to ${quant}...`)
        const quantPath = join(downloadsDir, `${modelName}-${quant}.gguf`)
        const binExt = process.platform === 'win32' ? '.exe' : ''
        await runCommand(
          join(this.config.llamaCppDir, `llama-quantize${binExt}`),
          [ggufPath, quantPath, quant]
        )

        // Step B: Register with Ollama (Modelfile is intentionally bare)
        progress(step++, `Creating Ollama model for ${quant}...`)
        const modelfileDir = join(downloadsDir, `modelfile-${quant}`)
        mkdirSync(modelfileDir, { recursive: true })
        writeFileSync(join(modelfileDir, 'Modelfile'), `FROM ${quantPath}`)
        const ollamaName = `${modelName}:${quant.toLowerCase()}`
        await runCommand('ollama', ['create', ollamaName, '-f', join(modelfileDir, 'Modelfile')])

        // Step C: Register in SQLite models table
        progress(step++, `Saving ${quant} to model registry...`)
        const { statSync } = await import('fs')
        const sizeGb = statSync(quantPath).size / (1024 ** 3)
        registry.register({
          id: ollamaName,
          hfSource: hfModelId,
          baseName: modelName,
          quantLevel: quant,
          sizeGb: Math.round(sizeGb * 10) / 10,
        })
      }
    } finally {
      registry.close()
    }
  }
}
