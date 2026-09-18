export type ProviderId = 'openai' | 'anthropic' | 'google' | 'groq' | 'mistral' | 'cohere'

export interface AIModel {
  id: string
  name: string
  providerId: ProviderId
  displayName: string
  contextWindow: number
  freeTokensPerDay: number
  freeTokensPerMonth: number
  usedToday: number
  usedMonth: number
  lastRefillDaily: string
  lastRefillMonthly: string
  inputPrice?: string
  enabled: boolean
}

export interface Provider {
  id: ProviderId
  name: string
  icon: string
  color: string
  apiKey: string
  baseUrl?: string
  models: AIModel[]
  connected: boolean
}

export interface Combo {
  id: string
  name: string
  description: string
  modelIds: string[]
  strategy: 'fallback' | 'round-robin' | 'balance'
  refill: 'daily' | 'monthly' | 'both'
  icon: string
  color: string
  createdAt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  modelId?: string
  tokens?: number
  timestamp: string
  imageUrl?: string
}

export interface Chat {
  id: string
  title: string
  projectId?: string
  comboId: string
  pinned: boolean
  updatedAt: string
  createdAt: string
  messages: Message[]
  preview?: string
}

export interface Project {
  id: string
  name: string
  description: string
  icon: string
  color: string
  pinned: boolean
  updatedAt: string
  chatIds: string[]
  files?: number
}

export type View = 'dashboard' | 'chat' | 'image' | 'projects' | 'combos' | 'keys'
