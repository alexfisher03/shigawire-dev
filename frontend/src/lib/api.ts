import { getBackendBaseUrl } from './backend'

export interface Session {
  id: string
  name: string
  created_at?: string
  sealed?: boolean
}

export interface Event {
  id: string
  method: string
  path: string
  status?: number
  duration?: number
  timestamp?: string
  requestBody?: string
  responseBody?: string
}

export async function listSessions(): Promise<Session[]> {
  const base = getBackendBaseUrl()

  try {
    const response = await fetch(`${base}/api/v1/sessions`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return []
  }
}

export async function getSession(id: string): Promise<Session | null> {
  const base = getBackendBaseUrl()

  try {
    const response = await fetch(`${base}/api/v1/sessions/${id}`, {
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching session detail:', error)
    return null
  }
}

export async function getSessionEvents(id: string): Promise<Event[]> {
  const base = getBackendBaseUrl()

  try {
    const response = await fetch(`${base}/api/v1/sessions/${id}/events`, {
      headers: { 'Content-Type': 'application/json' },
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error fetching events:', error)
    return []
  }
}

export async function createSession(name: string): Promise<Session | null> {
  const base = getBackendBaseUrl()

  try {
    const response = await fetch(`${base}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })

    if (!response.ok) {
      console.error('Failed to create session:', response.statusText)
      return null
    }

    return await response.json()
  } catch (error) {
    console.error('Error creating session:', error)
    return null
  }
}

