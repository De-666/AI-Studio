import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Provider, Combo, Chat, Project, View, AIModel } from './types'

const now = () => new Date().toISOString()
const today = () => new Date().toISOString().slice(0,10)

const initialProviders: Provider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '◐',
    color: '#74aa9c',
    apiKey: 'sk-proj-...4f9a',
    connected: true,
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', name: 'gpt-4o', displayName: 'GPT-4o', providerId: 'openai', contextWindow: 128000, freeTokensPerDay: 15000, freeTokensPerMonth: 300000, usedToday: 11200, usedMonth: 187000, lastRefillDaily: today(), lastRefillMonthly: today().slice(0,7), enabled: true, inputPrice: '$5/1M' },
      { id: 'gpt-4o-mini', name: 'gpt-4o-mini', displayName: 'GPT-4o mini', providerId: 'openai', contextWindow: 128000, freeTokensPerDay: 40000, freeTokensPerMonth: 800000, usedToday: 8200, usedMonth: 210000, lastRefillDaily: today(), lastRefillMonthly: today().slice(0,7), enabled: true, inputPrice: '$0.15/1M' },
      { id: 'o1-mini', name: 'o1-mini', displayName: 'o1-mini', providerId: 'openai', contextWindow: 128000, freeTokensPerDay: 10000, freeTokensPerMonth: 200000, usedToday: 9600, usedMonth: 150000, lastRefillDaily: today(), lastRefillMonthly: today().slice(0,7), enabled: true, inputPrice: '$3/1M' },
    ]
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '◆',
    color: '#d4a574',
    apiKey: 'sk-ant-...9c2e',
    connected: true,
    baseUrl: 'https://api.anthropic.com',
    models: [
      { id: 'claude-3.5-sonnet', name: 'claude-3-5-sonnet', displayName: 'Claude 3.5 Sonnet', providerId: 'anthropic', contextWindow: 200000, freeTokensPerDay: 20000, freeTokensPerMonth: 400000, usedToday: 3400, usedMonth: 95000, lastRefillDaily: today(), lastRefillMonthly: today().slice(0,7), enabled: true, inputPrice: '$3/1M' },
      { id: 'claude-3-haiku', name: 'claude-3-haiku', displayName: 'Claude 3 Haiku', providerId: 'anthropic', contextWindow: 200000, freeTokensPerDay: 50000, freeTokensPerMonth: 1000000, usedToday: 12000, usedMonth: 320000, lastRefillDaily: today(), lastRefillMonthly: today().slice(0,7), enabled: true, inputPrice: '$0.25/1M' },
    ]
  },
  {
    id: 'google',
    name: 'Google Gemini',
    icon: '⬢',
    color: '#8ab4f8',
    apiKey: 'AIzaSy...7d1a',
    connected: true,
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: [
      { id: 'gemini-1.5-pro', name: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', providerId: 'google', contextWindow: 2000000, freeTokensPerDay: 50000, freeTokensPerMonth: 1500000, usedToday: 22000, usedMonth: 600000, lastRefillDaily: today(), lastRefillMonthly: today().slice(0,7), enabled: true, inputPrice: 'Free tier' },
      { id: 'gemini-1.5-flash', name: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', providerId: 'google', contextWindow: 1000000, freeTokensPerDay: 100000, freeTokensPerMonth: 3000000, usedToday: 18000, usedMonth: 450000, lastRefillDaily: today(), lastRefillMonthly: today().slice(0,7), enabled: true, inputPrice: 'Free tier' },
    ]
  },
  {
    id: 'groq',
    name: 'Groq',
    icon: '⚡',
    color: '#ff6b35',
    apiKey: 'gsk_...2b8f',
    connected: false,
    baseUrl: 'https://api.groq.com/openai/v1',
    models: [
      { id: 'llama-3.1-70b', name: 'llama-3.1-70b', displayName: 'Llama 3.1 70B', providerId: 'groq', contextWindow: 131072, freeTokensPerDay: 30000, freeTokensPerMonth: 500000, usedToday: 0, usedMonth: 0, lastRefillDaily: today(), lastRefillMonthly: today().slice(0,7), enabled: true, inputPrice: 'Free' },
      { id: 'mixtral-8x7b', name: 'mixtral-8x7b', displayName: 'Mixtral 8x7B', providerId: 'groq', contextWindow: 32768, freeTokensPerDay: 30000, freeTokensPerMonth: 500000, usedToday: 5000, usedMonth: 80000, lastRefillDaily: today(), lastRefillMonthly: today().slice(0,7), enabled: false, inputPrice: 'Free' },
    ]
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    icon: '⬣',
    color: '#ff4d4d',
    apiKey: '',
    connected: false,
    baseUrl: 'https://api.mistral.ai/v1',
    models: [
      { id: 'mistral-large', name: 'mistral-large', displayName: 'Mistral Large 2', providerId: 'mistral', contextWindow: 128000, freeTokensPerDay: 15000, freeTokensPerMonth: 300000, usedToday: 0, usedMonth: 0, lastRefillDaily: today(), lastRefillMonthly: today().slice(0,7), enabled: true, inputPrice: '$2/1M' },
    ]
  },
]

const initialCombos: Combo[] = [
  { id: 'c1', name: 'Combo Tiết Kiệm', description: 'Ưu tiên model free, tự động fallback khi hết quota ngày', modelIds: ['gemini-1.5-flash', 'gpt-4o-mini', 'claude-3-haiku', 'llama-3.1-70b'], strategy: 'fallback', refill: 'daily', icon: '🌿', color: '#10b981', createdAt: now() },
  { id: 'c2', name: 'Combo Chất Lượng Cao', description: 'Dành cho task quan trọng — độ chính xác cao', modelIds: ['claude-3.5-sonnet', 'gpt-4o', 'gemini-1.5-pro'], strategy: 'fallback', refill: 'both', icon: '💎', color: '#7c5cff', createdAt: now() },
  { id: 'c3', name: 'Combo Cân Bằng', description: 'Round-robin chia đều token theo ngày & tháng', modelIds: ['gpt-4o-mini', 'gemini-1.5-flash', 'claude-3-haiku'], strategy: 'balance', refill: 'both', icon: '⚖️', color: '#00d9ff', createdAt: now() },
]

const initialChats: Chat[] = [
  {
    id: 'ch1', title: 'Lập kế hoạch content TikTok tháng 9', projectId: 'p1', comboId: 'c2', pinned: true, createdAt: now(), updatedAt: now(),
    preview: 'Hãy tạo 15 idea video ngắn về AI cho Gen Z...',
    messages: [
      { id: 'm1', role: 'user', content: 'Hãy tạo 15 idea video ngắn về AI cho Gen Z, mỗi idea có hook, script 30s và CTA.', timestamp: now(), tokens: 42 },
      { id: 'm2', role: 'assistant', content: 'Dưới đây là 15 idea được nhóm theo 3 pillar: AI làm việc, AI học tập, AI giải trí. Mình đã tối ưu hook 3s đầu để giữ chân...\n\n**1. "AI viết luận trong 30s — thật hay fake?"**\nHook: "Mình để AI làm bài tập và cô giáo không phát hiện??"\nScript: ...\n\nBạn muốn mình phát triển trọn bộ script cho idea nào trước?', modelId: 'claude-3.5-sonnet', tokens: 890, timestamp: now() },
    ]
  },
  {
    id: 'ch2', title: 'Phân tích code AI Studio', projectId: 'p1', comboId: 'c1', pinned: true, createdAt: now(), updatedAt: now(),
    preview: 'Giải thích kiến trúc combo switch model...',
    messages: [
      { id: 'm3', role: 'user', content: 'Giải thích kiến trúc combo switch model hoạt động thế nào?', timestamp: now(), tokens: 18 },
      { id: 'm4', role: 'assistant', content: 'Combo sẽ chọn model đầu tiên còn quota. Nếu hết free tokens ngày → tự động chuyển sang model kế tiếp trong danh sách. Vào 00:00 UTC quota ngày sẽ refill, mùng 1 hàng tháng quota tháng refill.', modelId: 'gemini-1.5-flash', tokens: 210, timestamp: now() },
    ]
  },
  {
    id: 'ch3', title: 'Tạo bộ nhận diện thương hiệu', projectId: 'p2', comboId: 'c3', pinned: false, createdAt: now(), updatedAt: now(),
    preview: 'Gợi ý palette, typography cho AI Studio...',
    messages: [
      { id: 'm5', role: 'user', content: 'Gợi ý palette màu cho AI Studio phong cách Leonardo?', timestamp: now(), tokens: 14 },
      { id: 'm6', role: 'assistant', content: 'Mình đề xuất palette Dark Neon: nền #0a0a0f, card #1c1c26, primary #7c5cff, accent #00d9ff — vừa tech vừa nghệ thuật như Leonardo. Bạn muốn mình tạo mockup luôn không?', modelId: 'gpt-4o-mini', tokens: 180, timestamp: now() },
    ]
  },
  {
    id: 'ch4', title: 'Brainstorm tên miền', projectId: undefined, comboId: 'c1', pinned: false, createdAt: now(), updatedAt: now(),
    preview: '10 tên miền ngắn gọn cho AI Studio...',
    messages: []
  },
]

const initialProjects: Project[] = [
  { id: 'p1', name: 'Chiến dịch TikTok Q3', description: 'Content & script cho kênh AI Studio', icon: '🎬', color: '#7c5cff', pinned: true, updatedAt: now(), chatIds: ['ch1','ch2'], files: 12 },
  { id: 'p2', name: 'Thiết kế AI Studio', description: 'Branding, UI, landing page', icon: '🎨', color: '#00d9ff', pinned: true, updatedAt: now(), chatIds: ['ch3'], files: 8 },
  { id: 'p3', name: 'Nghiên cứu đối thủ', description: 'So sánh Leonardo, Midjourney, Runway', icon: '🔍', color: '#ff6b35', pinned: false, updatedAt: now(), chatIds: [], files: 3 },
]

interface State {
  view: View
  providers: Provider[]
  combos: Combo[]
  chats: Chat[]
  projects: Project[]
  activeChatId: string | null
  activeProjectId: string | null
  sidebarCollapsed: boolean
  setView: (v: View) => void
  setActiveChat: (id: string | null) => void
  setActiveProject: (id: string | null) => void
  togglePinChat: (id: string) => void
  togglePinProject: (id: string) => void
  addCombo: (c: Combo) => void
  updateCombo: (id: string, patch: Partial<Combo>) => void
  deleteCombo: (id: string) => void
  upsertProviderKey: (id: string, key: string) => void
  toggleModelEnabled: (providerId: string, modelId: string) => void
  addChat: (chat: Chat) => void
  addMessage: (chatId: string, content: string, role: 'user' | 'assistant', modelId?: string) => void
  createProject: (p: Project) => void
  getActiveModelForCombo: (comboId: string) => { model: AIModel | null, remaining: number, provider: Provider | null }
  consumeTokens: (modelId: string, tokens: number) => void
  getModelById: (id: string) => AIModel | null
  getProviderByModel: (modelId: string) => Provider | null
}

export const useStore = create<State>()(persist((set, get) => ({
  view: 'dashboard',
  providers: initialProviders,
  combos: initialCombos,
  chats: initialChats,
  projects: initialProjects,
  activeChatId: 'ch1',
  activeProjectId: null,
  sidebarCollapsed: false,
  setView: (view) => set({ view }),
  setActiveChat: (id) => set({ activeChatId: id, view: 'chat' }),
  setActiveProject: (id) => set({ activeProjectId: id }),
  togglePinChat: (id) => set(s => ({ chats: s.chats.map(c => c.id===id? {...c, pinned: !c.pinned}:c)})),
  togglePinProject: (id) => set(s => ({ projects: s.projects.map(p => p.id===id? {...p, pinned: !p.pinned}:p)})),
  addCombo: (c) => set(s => ({ combos: [...s.combos, c]})),
  updateCombo: (id, patch) => set(s => ({ combos: s.combos.map(c => c.id===id? {...c, ...patch}:c)})),
  deleteCombo: (id) => set(s => ({ combos: s.combos.filter(c=>c.id!==id)})),
  upsertProviderKey: (id, key) => set(s => ({ providers: s.providers.map(p=> p.id===id? {...p, apiKey: key, connected: key.length>8}:p)})),
  toggleModelEnabled: (providerId, modelId) => set(s => ({ providers: s.providers.map(p=> p.id===providerId? {...p, models: p.models.map(m=> m.id===modelId? {...m, enabled: !m.enabled}:m)}:p)})),
  addChat: (chat) => set(s => ({ chats: [chat, ...s.chats], activeChatId: chat.id, view: 'chat'  })),
  addMessage: (chatId, content, role, modelId) => set(s => {
    const chats = s.chats.map(c => {
      if(c.id!==chatId) return c
      const msg = { id: Math.random().toString(36).slice(2), role, content, modelId, tokens: Math.floor(content.length/3.5), timestamp: now()}
      return { ...c, messages: [...c.messages, msg], updatedAt: now(), preview: content.slice(0,80), title: c.messages.length===0? content.slice(0,40): c.title }
    })
    return { chats }
  }),
  createProject: (p) => set(s => ({ projects: [p, ...s.projects]})),
  getModelById: (id) => {
    for(const p of get().providers) { const m = p.models.find(x=>x.id===id); if(m) return m }
    return null
  },
  getProviderByModel: (modelId) => get().providers.find(p=> p.models.some(m=>m.id==modelId)) || null,
  getActiveModelForCombo: (comboId) => {
    const combo = get().combos.find(c=>c.id===comboId)
    if(!combo) return { model: null, remaining: 0, provider: null }
    for(const mid of combo.modelIds){
      const provider = get().providers.find(p=> p.models.some(m=>m.id===mid))
      const model = provider?.models.find(m=>m.id===mid)
      if(!model || !model.enabled) continue
      const remainDaily = model.freeTokensPerDay - model.usedToday
      const remainMonthly = model.freeTokensPerMonth - model.usedMonth
      const remain = Math.min(remainDaily, remainMonthly)
      if(remain > 500) return { model, remaining: remain, provider: provider! }
    }
    // fallback to first enabled even if exhausted
    for(const mid of combo.modelIds){
      const provider = get().providers.find(p=> p.models.some(m=>m.id===mid))
      const model = provider?.models.find(m=>m.id===mid)
      if(model?.enabled) return { model: model!, remaining: Math.min(model.freeTokensPerDay-model.usedToday, model.freeTokensPerMonth-model.usedMonth), provider: provider! }
    }
    return { model: null, remaining: 0, provider: null }
  },
  consumeTokens: (modelId, tokens) => set(s => ({
    providers: s.providers.map(p=> ({
      ...p,
      models: p.models.map(m=> m.id===modelId? {...m, usedToday: m.usedToday + tokens, usedMonth: m.usedMonth + tokens}:m)
    }))
  }))
}), { name: 'ai-studio-storage', partialize: (s) => ({ providers: s.providers, combos: s.combos, chats: s.chats, projects: s.projects, activeChatId: s.activeChatId }) }))
