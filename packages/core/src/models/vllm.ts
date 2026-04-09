import { OpenAICompatibleClient } from './openai-compat.js'

/**
 * vLLM's OpenAI-compatible HTTP API.
 * Install: pip install vllm
 * Start:   vllm serve <model-name>
 * Default port: 8000
 */
export class VllmClient extends OpenAICompatibleClient {
  constructor(baseUrl = 'http://localhost:8000') {
    super({ baseUrl, clientName: 'vLLM' })
  }
}
