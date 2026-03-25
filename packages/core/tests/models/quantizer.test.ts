import { describe, it, expect, vi, beforeEach } from 'vitest'
import { QuantizationPipeline } from '../../src/models/quantizer.js'

// Mock child_process.spawn and execSync to avoid actually running Python/llama.cpp
vi.mock('child_process', () => ({
  spawn: vi.fn().mockImplementation(() => ({
    stdout: { on: vi.fn() },
    stderr: { on: vi.fn() },
    on: vi.fn().mockImplementation((event, cb) => {
      if (event === 'close') cb(0)  // exit code 0 = success
    }),
  })),
  execSync: vi.fn(),  // Python check passes silently
}))

// Mock fs.existsSync so llama.cpp binaries are "found" (no download needed)
// Mock fs.statSync so size checks on GGUF files don't require real files on disk
vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    statSync: vi.fn().mockReturnValue({ size: 4 * 1024 ** 3 }),  // 4 GB fake file size
  }
})

// Mock ModelRegistry so we can assert SQLite inserts without real DB
vi.mock('../../src/models/registry.js', () => ({
  ModelRegistry: vi.fn().mockImplementation(() => ({
    register: vi.fn(),
    close: vi.fn(),
  })),
}))

describe('QuantizationPipeline', () => {
  beforeEach(async () => {
    const { ModelRegistry } = await import('../../src/models/registry.js')
    vi.mocked(ModelRegistry).mockClear()
  })

  it('validates hfModelId format (must be owner/repo)', async () => {
    const pipeline = new QuantizationPipeline({
      dataDir: '/tmp',
      llamaCppDir: '/tmp/llama-cpp',
      ollamaUrl: 'http://localhost:11434',
      onProgress: vi.fn(),
    })
    await expect(pipeline.run('not-valid-format', ['Q4_K_M'])).rejects.toThrow('owner/repo')
  })

  it('rejects empty quants array', async () => {
    const pipeline = new QuantizationPipeline({
      dataDir: '/tmp',
      llamaCppDir: '/tmp/llama-cpp',
      ollamaUrl: 'http://localhost:11434',
      onProgress: vi.fn(),
    })
    await expect(pipeline.run('owner/repo', [])).rejects.toThrow('at least one')
  })

  it('calls onProgress with step updates', async () => {
    const onProgress = vi.fn()
    const pipeline = new QuantizationPipeline({
      dataDir: '/tmp/test-data',
      llamaCppDir: '/tmp/llama-cpp',
      ollamaUrl: 'http://localhost:11434',
      onProgress,
    })
    await pipeline.run('owner/mymodel', ['Q4_K_M'])
    expect(onProgress).toHaveBeenCalledWith(expect.objectContaining({ type: 'quant_progress' }))
  })

  it('registers each quant variant in ModelRegistry after ollama create', async () => {
    const onProgress = vi.fn()
    const pipeline = new QuantizationPipeline({
      dataDir: '/tmp/test-data',
      llamaCppDir: '/tmp/llama-cpp',
      ollamaUrl: 'http://localhost:11434',
      onProgress,
    })
    await pipeline.run('owner/mymodel', ['Q4_K_M', 'Q8_0'])
    const { ModelRegistry } = await import('../../src/models/registry.js')
    const registryInstance = vi.mocked(ModelRegistry).mock.results[0].value
    expect(registryInstance.register).toHaveBeenCalledTimes(2)
    expect(registryInstance.register).toHaveBeenCalledWith(expect.objectContaining({
      baseName: 'mymodel',
      quantLevel: 'Q4_K_M',
      hfSource: 'owner/mymodel',
    }))
    expect(registryInstance.register).toHaveBeenCalledWith(expect.objectContaining({
      quantLevel: 'Q8_0',
    }))
  })

  it('throws a clear error when Python is not found', async () => {
    const { execSync } = await import('child_process')
    vi.mocked(execSync).mockImplementationOnce(() => { throw new Error('not found') })
    const pipeline = new QuantizationPipeline({
      dataDir: '/tmp',
      llamaCppDir: '/tmp/llama-cpp',
      ollamaUrl: 'http://localhost:11434',
      onProgress: vi.fn(),
    })
    await expect(pipeline.run('owner/repo', ['Q4_K_M'])).rejects.toThrow('Python is required')
  })
})
