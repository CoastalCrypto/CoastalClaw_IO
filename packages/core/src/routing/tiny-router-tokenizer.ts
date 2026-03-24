import { readFileSync } from 'fs'

interface TokenizerVocab { [token: string]: number }

export function loadVocab(tokenizerJsonPath: string): TokenizerVocab {
  const raw = JSON.parse(readFileSync(tokenizerJsonPath, 'utf8'))
  return raw.model?.vocab ?? raw.vocab ?? {}
}

export function tokenize(text: string, vocab: TokenizerVocab, maxLen = 128): {
  inputIds: BigInt64Array
  attentionMask: BigInt64Array
  tokenTypeIds: BigInt64Array
} {
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean)
  const ids: number[] = [101] // [CLS]
  for (const word of words) {
    if (vocab[word] !== undefined) {
      ids.push(vocab[word])
    } else {
      // Subword fallback: split into individual chars
      for (const ch of word) {
        ids.push(vocab[ch] ?? vocab['[UNK]'] ?? 100)
      }
    }
  }
  ids.push(102) // [SEP]

  // Pad / truncate to maxLen
  const padded = ids.slice(0, maxLen)
  while (padded.length < maxLen) padded.push(0)

  return {
    inputIds: BigInt64Array.from(padded.map(BigInt)),
    attentionMask: BigInt64Array.from(padded.map((v) => (v !== 0 ? 1n : 0n))),
    tokenTypeIds: new BigInt64Array(maxLen),
  }
}
