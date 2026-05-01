const ENCODING = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32
const TIME_LEN = 10
const RAND_LEN = 16

export function ulid(): string {
  const time = Date.now()
  let timeStr = ''
  let t = time
  for (let i = TIME_LEN - 1; i >= 0; i--) {
    timeStr = ENCODING[t % 32] + timeStr
    t = Math.floor(t / 32)
  }
  let randStr = ''
  for (let i = 0; i < RAND_LEN; i++) {
    randStr += ENCODING[Math.floor(Math.random() * 32)]
  }
  return timeStr + randStr
}
