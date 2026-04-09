import { OpenAICompatibleClient } from './openai-compat.js'

/**
 * AirLLM's OpenAI-compatible HTTP API.
 * Streams model layers from disk — handles 70B models on 4GB VRAM.
 * Install: pip install airllm
 * Start:   airllm-server --model <hf-model-id> --port 8002
 * Default port: 8002. Probe order in ModelRouter: vLLM → AirLLM → Ollama.
 */
export class AirLLMClient extends OpenAICompatibleClient {
  constructor(baseUrl = 'http://localhost:8002') {
    super({ baseUrl, clientName: 'AirLLM' })
  }
}
