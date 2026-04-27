/**
 * Utility-Funktionen für HTTP-Requests mit Timeout, Retry, Backoff
 */

export interface FetchOptions extends RequestInit {
  timeout?: number
}

/**
 * Fetch mit Timeout
 */
export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {},
  timeoutMs: number = 10000
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms: ${url}`)
    }
    throw error
  }
}

/**
 * Retry mit Exponential Backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries: number = 3,
  baseDelayMs: number = 250
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Kein Retry beim letzten Versuch
      if (attempt === retries) {
        break
      }

      // Exponential Backoff: delay = baseDelay * 2^attempt
      const delay = baseDelayMs * Math.pow(2, attempt)
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Retry failed')
}

/**
 * Normalisiert Fehler zu lesbaren Messages
 */
export function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }
  if (typeof error === 'string') {
    return error
  }
  return 'Unknown error'
}

/**
 * Prüft ob Response OK ist, wirft sonst Error
 */
export async function checkResponse(response: Response): Promise<Response> {
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(
      `HTTP ${response.status} ${response.statusText}: ${text.slice(0, 200)}`
    )
  }
  return response
}
