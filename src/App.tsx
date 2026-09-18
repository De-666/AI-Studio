import { useState, useMemo, useRef, useEffect } from 'react'
import { useStore } from './store'
import { AIModel } from './types'
import {
  Sparkles, MessageSquare, Image as ImageIcon, FolderKanban, Layers, KeyRound,
  Pin, Clock3, Search, Plus, MoreHorizontal, Send, Zap, Settings2, ChevronDown,
  Trash2, GripVertical, Check, AlertCircle, Eye, EyeOff, Copy, Wand2, SlidersHorizontal,
  PanelLeftClose, PanelLeftOpen, Star, History, Hammer, Timer, Coins, ArrowUpRight,
  X, Loader2, FlaskConical, Palette, Monitor, Cpu
} from 'lucide-react'

export default function App(){
  const { view, setView, providers, combos, chats, projects, activeChatId, setActiveChat, togglePinChat, togglePinProject, addCombo, updateCombo, deleteCombo, upsertProviderKey, toggleModelEnabled, addChat, addMessage, createProject, getActiveModelForCombo, consumeTokens, getModelById, getProviderByModel } = useStore()
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [search, setSearch] = useState('')
  const [showNewProject, setShowNewProject] = useState(false)
  const [showNewCombo, setShowNewCombo] = useState(false)
  const [showNewChatProject, setShowNewChatProject] = useState<string | null>(null)
  const [editCombo, setEditCombo] = useState<string|null>(null)
  const [keyVisibility, setKeyVisibility] = useState<Record<string, boolean>>({})
  const [prompt, setPrompt] = useState('')
  const [selectedComboId, setSelectedComboId] = useState(combos[0]?.id || '')
  const [isGenerating, setIsGenerating] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const [imagePrompt, setImagePrompt] = useState('Cyberpunk street in Hanoi, neon rain, cinematic, 8k')
  const [genCount, setGenCount] = useState(4)
  const [selectedRatio, setSelectedRatio] = useState('1:1')
  const [mockImages, setMockImages] = useState<string[]>([
    'https://picsum.photos/seed/aistudio1/600/600',
    'https://picsum.photos/seed/aistudio2/800/600',
    'https://picsum.photos/seed/aistudio3/600/800',
    'https://picsum.photos/seed/aistudio4/700/700',
    'https://picsum.photos/seed/aistudio5/600/900',
    'https://picsum.photos/seed/aistudio6/900/600',
  ])

  const activeChat = chats.find(c=>c.id===activeChatId) || null
  const activeCombo = combos.find(c=>c.id===selectedComboId) || combos[0]
  const activeModelInfo = activeCombo ? getActiveModelForCombo(activeCombo.id) : null

  // scroll chat
  useEffect(()=>{ messagesEndRef.current?.scrollIntoView({behavior:'smooth'}) }, [activeChat?.messages.length])

  const filteredChats = useMemo(()=> chats.filter(c=> c.title.toLowerCase().includes(search.toLowerCase())), [chats, search])
  const pinnedChats = filteredChats.filter(c=>c.pinned)
  const recentChats = filteredChats.filter(c=>!c.pinned).slice(0,6)

  const handleSend = async () => {
    if(!prompt.trim() || !activeChat) return
    const userText = prompt.trim()
    setPrompt('')
    addMessage(activeChat.id, userText, 'user')
    // simulate token consumption -> pick model
    const info = activeCombo ? getActiveModelForCombo(activeCombo.id) : null
    if(!info?.model){ 
      setTimeout(()=> addMessage(activeChat.id, '⚠️ Tất cả model trong combo đã hết quota ngày/tháng. Vui lòng đợi refill lúc 00:00 UTC (ngày) hoặc mùng 1 (tháng), hoặc thêm model khác vào combo.', 'assistant'), 400)
      return
    }
    setIsGenerating(true)
    const tokensNeeded = Math.floor(userText.length/2.5) + 300
    consumeTokens(info.model.id, tokensNeeded)
    // mock streaming response
    setTimeout(()=>{
      const responses: Record<string,string> = {
        'gpt-4o': `**[GPT-4o]** Mình đã xử lý yêu cầu: "${userText.slice(0,60)}..."\n\nĐây là bản nháp chi tiết với cấu trúc rõ ràng, kèm gợi ý tối ưu token cho combo của bạn. Bạn có muốn mình lưu vào Project không?`,
        'claude-3.5-sonnet': `**[Claude 3.5 Sonnet]** Rất hay! Mình phân tích yêu cầu của bạn theo 3 góc nhìn: người dùng, kỹ thuật và kinh doanh.\n\n> "${userText.slice(0,50)}"\n\nMình đề xuất lộ trình 3 bước để triển khai nhanh...`,
        'gemini-1.5-flash': `**[Gemini 1.5 Flash — Free quota]** Mình trả lời nhanh bằng model tiết kiệm token nhé!\n\n"${userText.slice(0,50)}" → Mình đã tạo outline + 3 biến thể. Token còn lại: ${(info.remaining - tokensNeeded).toLocaleString()} / ngày. Tự động switch nếu hết.`,
        'gpt-4o-mini': `**[GPT-4o mini]** Đã xong! Mình tối ưu cho tốc độ và chi phí. Bạn cần mình mở rộng thêm ví dụ không?`,
        'claude-3-haiku': `**[Claude Haiku]** Ngắn gọn, đủ ý — mình trả lời súc tích để tiết kiệm token nhé.`,
        'llama-3.1-70b': `**[Llama 3.1 70B — Groq]** Phản hồi siêu nhanh từ Groq! Nội dung được tạo trong 0.8s.`,
      }
      const key = info.model!.id
      const text = responses[key] || `**[${info.model!.displayName}]** Đã nhận: "${userText}". Mình đang ở combo "${activeCombo?.name}" và còn ${info.remaining.toLocaleString()} tokens.`
      addMessage(activeChat.id, text, 'assistant', info.model!.id)
      setIsGenerating(false)
    }, 900)
  }

  const handleGenerateImages = () => {
    setIsGenerating(true)
    setTimeout(()=>{
      const seeds = Array.from({length: genCount}, (_,i)=> `https://picsum.photos/seed/${Date.now()+i}/600/${600+ (i%3)*100}`)
      setMockImages(s=> [...seeds, ...s].slice(0,12))
      setIsGenerating(false)
    }, 1400)
  }

  return (
    <div className="h-screen flex bg-[#0a0a0f] text-[#e4e4ee] overflow-hidden selection:bg-[#7c5cff]/30">
      {/* SIDEBAR */}
      <aside className={`${sidebarCollapsed? 'w-[72px]':'w-[300px]'} shrink-0 bg-[#0f0f15] border-r border-[#1e1e2a] flex flex-col transition-all duration-300`}>
        {/* Logo */}
        <div className="h-[64px] flex items-center gap-3 px-4 border-b border-[#1e1e2a] shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#7c5cff] to-[#00d9ff] flex items-center justify-center font-bold text-white shadow-lg shadow-[#7c5cff]/20">AI</div>
          {!sidebarCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="font-bold leading-none flex items-center gap-1">AI Studio <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#7c5cff] text-white">BETA</span></div>
              <div className="text-xs text-[#8b8ba7]">Combo • Switch • Workspace</div>
            </div>
          )}
          <button onClick={()=>setSidebarCollapsed(!sidebarCollapsed)} className="p-2 hover:bg-white/5 rounded-lg text-[#8b8ba7]">
            {sidebarCollapsed ? <PanelLeftOpen size={18}/> : <PanelLeftClose size={18}/>}
          </button>
        </div>

        {/* New Chat */}
        <div className="p-3">
          <button onClick={()=>{
            const id='ch'+Date.now()
            addChat({ id, title: 'Cuộc trò chuyện mới', comboId: combos[0]?.id || 'c1', pinned:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), messages:[], preview:'Bắt đầu trò chuyện...' })
          }} className="w-full flex items-center justify-center gap-2 bg-[#7c5cff] hover:bg-[#6a4de6] text-white rounded-xl py-2.5 font-medium transition shadow-lg shadow-[#7c5cff]/20">
            <Plus size={18}/> {!sidebarCollapsed && 'Cuộc trò chuyện mới'}
          </button>
          {!sidebarCollapsed && (
            <div className="relative mt-3">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b8ba7]"/>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Tìm kiếm..." className="w-full bg-[#1c1c26] border border-[#252535] rounded-lg pl-9 pr-3 py-2 text-sm placeholder:text-[#8b8ba7] focus:outline-none focus:border-[#7c5cff]/50"/>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="px-2 space-y-1">
          {[
            {id:'dashboard', label:'Tổng quan', icon: Monitor, count: null},
            {id:'chat', label:'Chat', icon: MessageSquare, count: chats.length},
            {id:'image', label:'Image Studio', icon: ImageIcon, count: 'New'},
            {id:'projects', label:'Projects', icon: FolderKanban, count: projects.length},
            {id:'combos', label:'Combos', icon: Layers, count: combos.length},
            {id:'keys', label:'API Keys', icon: KeyRound, count: providers.filter(p=>p.connected).length + '/' + providers.length},
          ].map(item=>{
            const Icon=item.icon as any
            const active = view===item.id
            return (
              <button key={item.id} onClick={()=>setView(item.id as any)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition ${active? 'bg-[#1c1c26] text-white border border-[#252535]': 'text-[#8b8ba7] hover:bg-white/[0.04] hover:text-white'}`}>
                <Icon size={18} className={active? 'text-[#7c5cff]':''}/>
                {!sidebarCollapsed && <>
                  <span className="flex-1 text-left font-medium">{item.label}</span>
                  {item.count && <span className={`text-xs px-1.5 py-0.5 rounded ${active? 'bg-[#7c5cff] text-white':'bg-[#1c1c26] border border-[#252535]'}`}>{item.count}</span>}
                </>}
              </button>
            )
          })}
        </nav>

        {!sidebarCollapsed && (
          <div className="flex-1 overflow-y-auto mt-2 px-3 space-y-4 pb-4">
            {/* Pinned */}
            <div>
              <div className="flex items-center gap-2 text-[11px] tracking-widest font-semibold text-[#8b8ba7] uppercase px-2 py-2">
                <Pin size={12}/> Ghim
                <span className="ml-auto bg-[#1c1c26] border border-[#252535] px-1.5 rounded text-[10px]">{pinnedChats.length}</span>
              </div>
              <div className="space-y-1">
                {pinnedChats.map(c=>{
                  const combo = combos.find(x=>x.id===c.comboId)
                  return (
                    <button key={c.id} onClick={()=>setActiveChat(c.id)} className={`w-full text-left p-2.5 rounded-xl border flex gap-2.5 group ${activeChatId===c.id? 'bg-[#1c1c26] border-[#7c5cff]/30':'bg-transparent border-transparent hover:bg-white/[0.04]'}`}>
                      <div className="w-7 h-7 rounded-lg bg-[#252535] flex items-center justify-center text-xs shrink-0">{combo?.icon || '💬'}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate pr-2">{c.title}</div>
                        <div className="text-xs text-[#8b8ba7] truncate">{c.preview}</div>
                      </div>
                      <span className="opacity-0 group-hover:opacity-100 p-1 hover:bg-white/10 rounded" onClick={(e)=>{e.stopPropagation(); togglePinChat(c.id)}}><Pin size={12} className="text-[#7c5cff] fill-[#7c5cff]"/></span>
                    </button>
                  )
                })}
                {pinnedChats.length===0 && <div className="text-xs text-[#8b8ba7] px-2 py-2 italic">Chưa có ghim</div>}
              </div>
            </div>

            {/* Recent */}
            <div>
              <div className="flex items-center gap-2 text-[11px] tracking-widest font-semibold text-[#8b8ba7] uppercase px-2 py-2">
                <History size={12}/> Gần đây
              </div>
              <div className="space-y-1">
                {recentChats.map(c=>(
                  <button key={c.id} onClick={()=>setActiveChat(c.id)} className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2 text-sm ${activeChatId===c.id? 'bg-[#1c1c26] border border-[#7c5cff]/30 text-white':'text-[#8b8ba7] hover:bg-white/[0.04] hover:text-white border border-transparent'}`}>
                    <Clock3 size={14} className="shrink-0"/>
                    <span className="truncate flex-1">{c.title}</span>
                    <span className="opacity-0 group-hover:opacity-100" onClick={(e)=>{e.stopPropagation(); togglePinChat(c.id)}}><Star size={12}/></span>
                  </button>
                ))}
              </div>
            </div>

            {/* Projects */}
            <div>
              <div className="flex items-center gap-2 text-[11px] tracking-widest font-semibold text-[#8b8ba7] uppercase px-2 py-2">
                <FolderKanban size={12}/> Projects
                <button onClick={()=>setShowNewProject(true)} className="ml-auto w-6 h-6 rounded bg-[#1c1c26] border border-[#252535] flex items-center justify-center hover:border-[#7c5cff]/50"><Plus size={12}/></button>
              </div>
              <div className="space-y-1">
                {projects.slice(0,4).map(p=>(
                  <button key={p.id} onClick={()=>{setView('projects');}} className="w-full text-left px-3 py-2.5 rounded-xl bg-[#14141c] border border-[#1e1e2a] hover:border-[#252535] flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm" style={{background: p.color+'20', border: `1px solid ${p.color}30`}}>{p.icon}</div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{p.name}</div>
                      <div className="text-xs text-[#8b8ba7]">{p.chatIds.length} chats • {p.files} files</div>
                    </div>
                    {p.pinned && <Pin size={10} className="text-[#7c5cff] fill-[#7c5cff]"/>}
                  </button>
                ))}
              </div>
            </div>

            {/* Quota mini */}
            <div className="bg-gradient-to-br from-[#1c1c26] to-[#14141c] border border-[#252535] rounded-xl p-3">
              <div className="flex items-center gap-2 text-xs font-semibold"><Coins size={14} className="text-[#00d9ff]"/> Token hôm nay</div>
              <div className="mt-2 space-y-2">
                {combos.slice(0,2).map(c=>{
                  const info = getActiveModelForCombo(c.id)
                  const pct = info.model ? Math.round((info.model.usedToday / info.model.freeTokensPerDay)*100) : 0
                  return (
                    <div key={c.id} className="space-y-1">
                      <div className="flex justify-between text-xs"><span className="flex items-center gap-1.5">{c.icon} {c.name}</span><span className={pct>80? 'text-amber-400':'text-[#8b8ba7]'}>{pct}%</span></div>
                      <div className="h-1.5 bg-[#252535] rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-[#7c5cff] to-[#00d9ff] transition-all" style={{width: pct+'%'}}/></div>
                    </div>
                  )
                })}
              </div>
              <button onClick={()=>setView('combos')} className="mt-3 w-full text-xs py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10">Quản lý quota →</button>
            </div>
          </div>
        )}

        {!sidebarCollapsed && (
          <div className="p-3 border-t border-[#1e1e2a] flex items-center gap-3">
            <img src="https://i.pravatar.cc/100?img=32" className="w-8 h-8 rounded-full border border-[#252535]"/>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">Minh Anh</div>
              <div className="text-xs text-[#8b8ba7]">Pro • 2,340 credits</div>
            </div>
            <Settings2 size={16} className="text-[#8b8ba7]"/>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#0a0a0f]">
        {/* Top bar */}
        <div className="h-[64px] border-b border-[#1e1e2a] bg-[#0f0f15]/80 backdrop-blur flex items-center gap-3 px-4 shrink-0">
          {view==='chat' && activeChat ? (
            <>
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-[#1c1c26] border border-[#252535] flex items-center justify-center">💬</div>
                <div className="min-w-0">
                  <div className="font-semibold truncate">{activeChat.title}</div>
                  <div className="text-xs text-[#8b8ba7] flex items-center gap-2">
                    <span>{projects.find(p=>p.id===activeChat.projectId)?.name || 'Không thuộc project'}</span>
                    <span className="w-1 h-1 bg-[#8b8ba7] rounded-full"/>
                    <span>{activeChat.messages.length} tin nhắn</span>
                  </div>
                </div>
              </div>
              {/* Combo selector */}
              <div className="hidden md:flex items-center gap-2 bg-[#14141c] border border-[#252535] rounded-xl px-3 py-2">
                <Layers size={16} className="text-[#7c5cff]"/>
                <select value={selectedComboId} onChange={e=>setSelectedComboId(e.target.value)} className="bg-transparent text-sm font-medium focus:outline-none">
                  {combos.map(c=> <option key={c.id} value={c.id} className="bg-[#14141c]">{c.icon} {c.name}</option>)}
                </select>
                <div className="w-px h-6 bg-[#252535] mx-1"/>
                {activeModelInfo?.model ? (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
                    <span className="font-mono">{activeModelInfo.model.displayName}</span>
                    <span className="text-[#8b8ba7]">{activeModelInfo.remaining.toLocaleString()} left</span>
                  </div>
                ) : (
                  <span className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle size={12}/> Hết quota</span>
                )}
              </div>
              <button className="p-2 hover:bg-white/5 rounded-xl"><MoreHorizontal size={18}/></button>
            </>
          ) : view==='dashboard' ? (
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold">Tổng quan</h1>
              <span className="hidden sm:inline-flex items-center gap-1.5 text-xs bg-[#7c5cff]/15 text-[#7c5cff] border border-[#7c5cff]/20 px-2 py-1 rounded-full"><FlaskConical size={12}/> Workspace như ChatGPT + Leonardo</span>
            </div>
          ) : view==='image' ? (
            <div className="flex items-center gap-3 flex-1">
              <h1 className="font-bold flex items-center gap-2"><Palette size={18} className="text-[#7c5cff]"/> Image Studio</h1>
              <span className="text-xs text-[#8b8ba7] hidden md:inline">Tạo ảnh như Leonardo AI — chia sẻ, remix, upscale</span>
              <div className="ml-auto hidden lg:flex items-center gap-2 text-xs">
                <span className="px-2.5 py-1 rounded-full bg-[#1c1c26] border border-[#252535]">150 credits còn lại</span>
                <button className="px-3 py-1.5 rounded-full bg-[#7c5cff] text-white font-medium">Nâng cấp</button>
              </div>
            </div>
          ) : view==='projects' ? (
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold">Projects</h1>
              <span className="text-sm text-[#8b8ba7]">{projects.length} projects</span>
            </div>
          ) : view==='combos' ? (
            <h1 className="text-lg font-bold">Combo Model Switch</h1>
          ) : (
            <h1 className="text-lg font-bold">API Keys & Model Quota</h1>
          )}

          {view!=='chat' && <div className="ml-auto flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 text-xs bg-[#1c1c26] border border-[#252535] rounded-full px-3 py-1.5">
              <Timer size={12} className="text-[#00d9ff]"/> Refill ngày: 00:00 UTC • Tháng: mùng 1
            </div>
          </div>}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {/* DASHBOARD */}
          {view==='dashboard' && (
            <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
              {/* Hero */}
              <div className="rounded-[20px] bg-gradient-to-br from-[#7c5cff] via-[#7c5cff] to-[#00d9ff] p-[1px]">
                <div className="rounded-[19px] bg-gradient-to-br from-[#1c1c26] to-[#0f0f15] p-6 md:p-8 flex flex-col lg:flex-row gap-6">
                  <div className="flex-1">
                    <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest uppercase text-[#7c5cff] bg-[#7c5cff]/10 border border-[#7c5cff]/20 px-2.5 py-1 rounded-full">AI Studio • Leonardo + ChatGPT Workspace</div>
                    <h2 className="text-3xl md:text-4xl font-bold mt-3 leading-tight">Tích hợp mọi AI model<br/><span className="bg-gradient-to-r from-[#7c5cff] to-[#00d9ff] bg-clip-text text-transparent">qua API key, tự động switch</span></h2>
                    <p className="text-[#8b8ba7] mt-3 max-w-xl">Nhóm model theo <b className="text-white">Combo</b> để xoay vòng token free theo ngày & tháng. Khi model A hết quota, hệ thống tự chuyển sang model B — không gián đoạn chat, không mất ý.</p>
                    <div className="flex flex-wrap gap-3 mt-6">
                      <button onClick={()=>setView('chat')} className="px-5 py-2.5 bg-white text-black rounded-xl font-semibold flex items-center gap-2 hover:bg-white/90">Bắt đầu Chat <ArrowUpRight size={16}/></button>
                      <button onClick={()=>setView('combos')} className="px-5 py-2.5 bg-white/10 border border-white/20 rounded-xl font-medium hover:bg-white/15">Tạo Combo mới</button>
                    </div>
                    <div className="flex gap-6 mt-6 text-sm">
                      <div><div className="font-bold text-xl">{providers.length} Providers</div><div className="text-[#8b8ba7]">OpenAI, Claude, Gemini...</div></div>
                      <div><div className="font-bold text-xl">{providers.reduce((a,p)=>a+p.models.length,0)} Models</div><div className="text-[#8b8ba7]">Đã kết nối</div></div>
                      <div><div className="font-bold text-xl">{combos.length} Combos</div><div className="text-[#8b8ba7]">Auto-switch</div></div>
                    </div>
                  </div>
                  <div className="lg:w-[380px] bg-[#0a0a0f] border border-[#252535] rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between"><span className="font-semibold">Trạng thái quota hôm nay</span><span className="text-xs px-2 py-1 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Live</span></div>
                    {providers.flatMap(p=>p.models).slice(0,4).map(m=>{
                      const pct = Math.round(m.usedToday / m.freeTokensPerDay *100)
                      const remain = m.freeTokensPerDay - m.usedToday
                      return (
                        <div key={m.id} className="bg-[#14141c] border border-[#1e1e2a] rounded-xl p-3">
                          <div className="flex justify-between text-sm"><span className="font-medium">{m.displayName}</span><span className={`text-xs ${pct>85? 'text-amber-400':'text-[#8b8ba7]'}`}>{pct}% đã dùng</span></div>
                          <div className="h-1.5 bg-[#252535] rounded-full mt-2 overflow-hidden"><div className="h-full rounded-full transition-all" style={{width: pct+'%', background: pct>85? '#f59e0b' : pct>60? '#7c5cff' : '#00d9ff'}}/></div>
                          <div className="flex justify-between text-xs text-[#8b8ba7] mt-1.5"><span>{remain.toLocaleString()} còn lại</span><span>Refill 00:00 UTC</span></div>
                        </div>
                      )
                    })}
                    <button onClick={()=>setView('keys')} className="w-full py-2 rounded-xl bg-[#7c5cff] text-white text-sm font-medium">Xem chi tiết quota</button>
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {label:'Chats', value: chats.length, sub:'+3 hôm nay', icon: MessageSquare, color:'#7c5cff'},
                  {label:'Projects', value: projects.length, sub:'2 đã ghim', icon: FolderKanban, color:'#00d9ff'},
                  {label:'Token đã dùng (tháng)', value: '1.2M', sub:'còn 2.8M free', icon: Coins, color:'#10b981'},
                  {label:'Lần auto-switch', value: '27', sub:'tiết kiệm 94% chi phí', icon: Zap, color:'#f59e0b'},
                ].map(s=>(
                  <div key={s.label} className="bg-[#14141c] border border-[#1e1e2a] rounded-2xl p-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{background: s.color+'18', color: s.color, border: `1px solid ${s.color}30`}}><s.icon size={18}/></div>
                    <div className="text-2xl font-bold mt-3">{s.value}</div>
                    <div className="text-sm text-[#8b8ba7]">{s.label}</div>
                    <div className="text-xs text-emerald-400 mt-1">{s.sub}</div>
                  </div>
                ))}
              </div>

              <div className="grid lg:grid-cols-3 gap-6">
                {/* Combos */}
                <div className="lg:col-span-2 bg-[#14141c] border border-[#1e1e2a] rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold flex items-center gap-2"><Layers size={18} className="text-[#7c5cff]"/> Combos đang hoạt động</h3>
                    <button onClick={()=>setView('combos')} className="text-xs px-3 py-1.5 rounded-full border border-[#252535] hover:bg-white/5">Quản lý →</button>
                  </div>
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    {combos.map(c=>{
                      const info = getActiveModelForCombo(c.id)
                      const models = c.modelIds.map(id=> getModelById(id)).filter(Boolean) as any[]
                      return (
                        <div key={c.id} className="bg-[#0a0a0f] border border-[#252535] rounded-xl p-4 hover:border-[#7c5cff]/30 transition">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style={{background: c.color+'15', border: `1px solid ${c.color}30`}}>{c.icon}</div>
                            <div className="flex-1 min-w-0">
                              <div className="font-semibold">{c.name}</div>
                              <div className="text-xs text-[#8b8ba7] leading-relaxed">{c.description}</div>
                            </div>
                            <span className={`text-[10px] px-2 py-1 rounded-full border font-medium ${c.strategy==='fallback'?'bg-amber-500/10 text-amber-400 border-amber-500/20': c.strategy==='balance'?'bg-cyan-500/10 text-cyan-400 border-cyan-500/20':'bg-violet-500/10 text-violet-400 border-violet-500/20'}`}>{c.strategy}</span>
                          </div>
                          <div className="flex gap-1.5 mt-3 flex-wrap">
                            {models.map((m,i)=> {
                              const pct = Math.round(m.usedToday / m.freeTokensPerDay *100)
                              const isActive = info.model?.id===m.id
                              return (
                                <span key={m.id} className={`text-xs px-2 py-1 rounded-full border flex items-center gap-1 ${isActive? 'bg-[#7c5cff] text-white border-[#7c5cff]':'bg-[#1c1c26] border-[#252535] text-[#8b8ba7]'}`}>
                                  {i+1}. {m.displayName}
                                  <span className={`w-1.5 h-1.5 rounded-full ${pct>85? 'bg-amber-400': pct>60? 'bg-yellow-400':'bg-emerald-400'}`}/>
                                </span>
                              )
                            })}
                          </div>
                          <div className="flex items-center gap-2 mt-3 text-xs text-[#8b8ba7]">
                            <Timer size={12}/> Refill: {c.refill==='daily'? 'Hàng ngày': c.refill==='monthly'? 'Hàng tháng':'Ngày & Tháng'}
                            <span className="ml-auto flex items-center gap-1 text-emerald-400"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/> {info.model? info.model.displayName : 'Hết quota'}</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Recent activity + projects */}
                <div className="space-y-6">
                  <div className="bg-[#14141c] border border-[#1e1e2a] rounded-2xl p-5">
                    <h3 className="font-bold flex items-center gap-2"><Clock3 size={16}/> Hoạt động gần đây</h3>
                    <div className="mt-4 space-y-3">
                      {chats.slice(0,3).map(c=>(
                        <div key={c.id} onClick={()=>setActiveChat(c.id)} className="flex gap-3 p-2.5 rounded-xl hover:bg-white/[0.04] cursor-pointer border border-transparent hover:border-[#252535]">
                          <div className="w-8 h-8 rounded-lg bg-[#252535] flex items-center justify-center text-xs shrink-0">💬</div>
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{c.title}</div>
                            <div className="text-xs text-[#8b8ba7] truncate">{c.preview}</div>
                            <div className="text-[11px] text-[#8b8ba7] mt-1 flex items-center gap-1"><Cpu size={10}/> {combos.find(x=>x.id===c.comboId)?.name}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-[#14141c] border border-[#1e1e2a] rounded-2xl p-5">
                    <div className="flex items-center justify-between"><h3 className="font-bold">Projects</h3><button onClick={()=>setView('projects')} className="text-xs text-[#7c5cff]">Xem tất cả</button></div>
                    <div className="mt-4 space-y-2">
                      {projects.map(p=>(
                        <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-[#0a0a0f] border border-[#252535]">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{background: p.color+'15', border:`1px solid ${p.color}30`}}>{p.icon}</div>
                          <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{p.name}</div><div className="text-xs text-[#8b8ba7]">{p.chatIds.length} chats</div></div>
                          <ArrowUpRight size={14} className="text-[#8b8ba7]"/>
                        </div>
                      ))}
                    </div>
                    <button onClick={()=>setShowNewProject(true)} className="w-full mt-3 py-2 rounded-xl border border-dashed border-[#252535] text-sm text-[#8b8ba7] hover:border-[#7c5cff]/50 hover:text-white">+ Tạo Project mới</button>
                  </div>
                </div>
              </div>

              {/* Leonardo teaser */}
              <div className="bg-[#14141c] border border-[#1e1e2a] rounded-2xl p-5">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold flex items-center gap-2"><ImageIcon size={18} className="text-[#00d9ff]"/> Image Studio — như Leonardo AI</h3>
                  <button onClick={()=>setView('image')} className="text-xs px-3 py-1.5 rounded-full bg-white text-black font-medium">Mở Studio →</button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
                  {mockImages.slice(0,4).map((src,i)=>(
                    <div key={i} className="aspect-square rounded-xl overflow-hidden border border-[#252535] relative group">
                      <img src={src} className="w-full h-full object-cover group-hover:scale-105 transition duration-500"/>
                      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/70 to-transparent text-xs">Prompt #{i+1} • 1024x1024</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* CHAT */}
          {view==='chat' && (
            <div className="flex h-full">
              {/* chat list overlay on mobile hidden - we use sidebar, so main is messages */}
              <div className="flex-1 flex flex-col min-w-0 bg-[#0a0a0f]">
                {!activeChat ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-[#1c1c26] border border-[#252535] flex items-center justify-center text-2xl">💬</div>
                    <h3 className="font-bold mt-4">Chưa chọn cuộc trò chuyện</h3>
                    <p className="text-sm text-[#8b8ba7] mt-1">Chọn từ sidebar hoặc tạo mới để bắt đầu</p>
                    <button onClick={()=>{
                      const id='ch'+Date.now()
                      addChat({ id, title: 'Cuộc trò chuyện mới', comboId: selectedComboId, pinned:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), messages:[], preview:'...' })
                    }} className="mt-4 px-4 py-2 bg-[#7c5cff] text-white rounded-xl text-sm font-medium">Tạo chat mới</button>
                  </div>
                ) : (
                  <>
                    {/* switch notice */}
                    {activeModelInfo?.model && (
                      <div className="mx-4 mt-4 bg-[#1c1c26] border border-[#252535] rounded-xl px-3 py-2.5 flex flex-wrap items-center gap-3 text-xs">
                        <span className="flex items-center gap-1.5 font-medium"><Zap size={14} className="text-amber-400"/> Combo đang dùng: <b className="text-white">{activeCombo?.name}</b></span>
                        <span className="hidden sm:inline w-px h-4 bg-[#252535]"/>
                        <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"/> Model hiện tại: <span className="font-mono bg-white/10 px-1.5 py-0.5 rounded">{activeModelInfo.model.displayName}</span></span>
                        <span className="flex items-center gap-1 text-[#8b8ba7]"><Coins size={12}/> {activeModelInfo.remaining.toLocaleString()} tokens còn lại (ngày) — tự động chuyển khi hết</span>
                        <span className="ml-auto text-[11px] bg-[#7c5cff]/15 text-[#7c5cff] border border-[#7c5cff]/20 px-2 py-1 rounded-full">{activeCombo?.strategy} • refill {activeCombo?.refill}</span>
                      </div>
                    )}

                    <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
                      {activeChat.messages.length===0 && (
                        <div className="max-w-3xl mx-auto">
                          <div className="bg-[#14141c] border border-[#1e1e2a] rounded-2xl p-6">
                            <h3 className="font-bold text-lg">Xin chào! Mình là AI Studio 👋</h3>
                            <p className="text-sm text-[#8b8ba7] mt-1">Chọn một gợi ý để bắt đầu, hoặc nhập câu hỏi bất kỳ. Mình sẽ tự động chọn model còn quota trong combo.</p>
                            <div className="grid sm:grid-cols-2 gap-3 mt-4">
                              {[
                                'Tạo 5 prompt ảnh Leonardo phong cách cyberpunk',
                                'Viết kế hoạch content 30 ngày cho AI Studio',
                                'Giải thích cơ chế refill token ngày & tháng',
                                'So sánh GPT-4o vs Claude 3.5 Sonnet',
                              ].map(s=>(
                                <button key={s} onClick={()=>setPrompt(s)} className="text-left p-3 rounded-xl bg-[#0a0a0f] border border-[#252535] hover:border-[#7c5cff]/40 text-sm">{s}</button>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {activeChat.messages.map(m=>(
                        <div key={m.id} className={`flex gap-3 max-w-3xl mx-auto ${m.role==='user'? 'justify-end':''}`}>
                          {m.role==='assistant' && (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#00d9ff] flex items-center justify-center text-white text-xs font-bold shrink-0">AI</div>
                          )}
                          <div className={`rounded-2xl px-4 py-3 max-w-[78%] ${m.role==='user'? 'bg-[#7c5cff] text-white rounded-br-sm':'bg-[#14141c] border border-[#1e1e2a] rounded-bl-sm'}`}>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</div>
                            {m.modelId && <div className="text-[11px] mt-2 opacity-60 flex items-center gap-1.5"><Cpu size={10}/> {getModelById(m.modelId)?.displayName} • {m.tokens} tokens</div>}
                          </div>
                          {m.role==='user' && <img src="https://i.pravatar.cc/100?img=32" className="w-8 h-8 rounded-full shrink-0"/>}
                        </div>
                      ))}
                      {isGenerating && (
                        <div className="flex gap-3 max-w-3xl mx-auto">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#7c5cff] to-[#00d9ff] flex items-center justify-center"><Loader2 size={14} className="animate-spin text-white"/></div>
                          <div className="bg-[#14141c] border border-[#1e1e2a] rounded-2xl px-4 py-3 text-sm text-[#8b8ba7]">Đang sinh câu trả lời bằng {activeModelInfo?.model?.displayName}...</div>
                        </div>
                      )}
                      <div ref={messagesEndRef}/>
                    </div>

                    {/* input */}
                    <div className="p-4 border-t border-[#1e1e2a] bg-[#0f0f15]">
                      <div className="max-w-3xl mx-auto">
                        <div className="bg-[#1c1c26] border border-[#252535] rounded-2xl flex items-end gap-2 p-2 focus-within:border-[#7c5cff]/50">
                          <button className="p-2.5 hover:bg-white/5 rounded-xl text-[#8b8ba7]"><Plus size={18}/></button>
                          <textarea
                            value={prompt}
                            onChange={e=>setPrompt(e.target.value)}
                            onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); handleSend() }}}
                            placeholder={`Nhắn cho ${activeCombo?.name || 'AI'}... (Enter để gửi, Shift+Enter xuống dòng)`}
                            rows={1}
                            className="flex-1 bg-transparent resize-none max-h-32 py-2.5 text-sm focus:outline-none placeholder:text-[#8b8ba7]"
                          />
                          <button onClick={handleSend} disabled={!prompt.trim() || isGenerating} className="p-2.5 bg-[#7c5cff] hover:bg-[#6a4de6] disabled:opacity-40 text-white rounded-xl">
                            <Send size={18}/>
                          </button>
                        </div>
                        <div className="flex items-center justify-between mt-2 text-[11px] text-[#8b8ba7]">
                          <span>Combo sẽ tự switch khi hết quota • Refill ngày 00:00 UTC • Tháng mùng 1</span>
                          <span className="hidden sm:inline">AI có thể mắc lỗi. Kiểm tra lại thông tin quan trọng.</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Right meta - chat info */}
              <div className="hidden xl:flex w-[320px] border-l border-[#1e1e2a] bg-[#0f0f15] flex-col">
                <div className="p-4 border-b border-[#1e1e2a]">
                  <h4 className="font-semibold text-sm">Chi tiết</h4>
                  <div className="mt-3 space-y-3">
                    <div className="bg-[#1c1c26] border border-[#252535] rounded-xl p-3">
                      <div className="text-xs text-[#8b8ba7]">Combo</div>
                      <div className="font-medium flex items-center gap-2 mt-1">{activeCombo?.icon} {activeCombo?.name}</div>
                      <div className="text-xs text-[#8b8ba7] mt-1">{activeCombo?.description}</div>
                      <div className="mt-2 space-y-1.5">
                        {(activeCombo?.modelIds.map(id=> getModelById(id)).filter(Boolean) as any[]).map((m:AIModel)=>{
                          const p = getProviderByModel(m.id)
                          const remain = m.freeTokensPerDay - m.usedToday
                          const pct = Math.round(m.usedToday / m.freeTokensPerDay*100)
                          const isCur = activeModelInfo?.model?.id===m.id
                          return (
                            <div key={m.id} className={`flex items-center gap-2 text-xs p-2 rounded-lg border ${isCur? 'bg-[#7c5cff]/10 border-[#7c5cff]/30':'bg-[#0a0a0f] border-[#252535]'}`}>
                              <span className={`w-2 h-2 rounded-full ${pct>85? 'bg-amber-500': pct>60? 'bg-yellow-400':'bg-emerald-500'}`}/>
                              <span className="flex-1 truncate font-mono">{m.displayName}</span>
                              <span className="text-[#8b8ba7]">{remain.toLocaleString()}</span>
                              {isCur && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"/>}
                              <span className="text-[10px] px-1 py-0.5 rounded bg-white/10">{p?.name}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    <div className="bg-[#1c1c26] border border-[#252535] rounded-xl p-3">
                      <div className="text-xs font-semibold flex items-center gap-1.5"><Hammer size={12}/> Project</div>
                      <select value={activeChat?.projectId || ''} onChange={e=>{
                        if(!activeChat) return
                        const newProjectId = e.target.value || undefined
                        // quick patch
                        useStore.setState(s=> ({ chats: s.chats.map(c=> c.id===activeChat.id? {...c, projectId: newProjectId}:c)}))
                        if(newProjectId) useStore.setState(s=> ({ projects: s.projects.map(p=> p.id===newProjectId? {...p, chatIds: [...new Set([...p.chatIds, activeChat.id])]}: p)}))
                      }} className="w-full mt-2 bg-[#0a0a0f] border border-[#252535] rounded-lg px-2 py-2 text-sm">
                        <option value="">Không thuộc project</option>
                        {projects.map(p=> <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
                      </select>
                      <button onClick={()=>setShowNewChatProject(activeChat?.id||null)} className="w-full mt-2 text-xs py-1.5 rounded-lg border border-dashed border-[#252535] hover:border-[#7c5cff]/40">+ Tạo project mới</button>
                    </div>

                    <div className="bg-[#1c1c26] border border-[#252535] rounded-xl p-3">
                      <div className="text-xs font-semibold">Ghim & Lịch sử</div>
                      <button onClick={()=> activeChat && togglePinChat(activeChat.id)} className="w-full mt-2 flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-sm border border-white/10">
                        <Pin size={14} className={activeChat?.pinned? 'fill-[#7c5cff] text-[#7c5cff]':''}/> {activeChat?.pinned? 'Đã ghim':'Ghim cuộc trò chuyện'}
                      </button>
                      <div className="text-xs text-[#8b8ba7] mt-2">{activeChat ? new Date(activeChat.updatedAt).toLocaleString('vi-VN') : ''}</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 flex-1 overflow-y-auto">
                  <h5 className="text-xs font-semibold tracking-widest uppercase text-[#8b8ba7]">Mẹo combo</h5>
                  <ul className="mt-2 space-y-2 text-xs text-[#8b8ba7] leading-relaxed list-disc pl-4">
                    <li>Đặt model free nhiều quota (Gemini Flash, Haiku) đầu danh sách để tiết kiệm.</li>
                    <li>Model chất lượng cao (Sonnet, GPT-4o) để cuối để fallback khi cần.</li>
                    <li>Token ngày refill 00:00 UTC, tháng refill mùng 1 — không cộng dồn.</li>
                    <li>Strategy <b className="text-white">fallback</b> tuần tự, <b className="text-white">balance</b> chia đều.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* IMAGE STUDIO */}
          {view==='image' && (
            <div className="flex h-full flex-col lg:flex-row">
              {/* Left prompt */}
              <div className="w-full lg:w-[360px] border-b lg:border-b-0 lg:border-r border-[#1e1e2a] bg-[#0f0f15] p-4 flex flex-col gap-4 overflow-y-auto">
                <div>
                  <label className="text-xs font-semibold tracking-widest uppercase text-[#8b8ba7]">Prompt</label>
                  <textarea value={imagePrompt} onChange={e=>setImagePrompt(e.target.value)} rows={4} className="w-full mt-2 bg-[#1c1c26] border border-[#252535] rounded-xl p-3 text-sm focus:outline-none focus:border-[#7c5cff]/50" placeholder="Mô tả ảnh bạn muốn tạo..."/>
                  <div className="flex gap-2 mt-2">
                    <button className="text-xs px-2.5 py-1 rounded-full bg-[#1c1c26] border border-[#252535] flex items-center gap-1"><Wand2 size={12}/> Enhance</button>
                    <button className="text-xs px-2.5 py-1 rounded-full bg-[#1c1c26] border border-[#252535]">Random</button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-[#8b8ba7]">Model</label>
                    <select className="w-full mt-1 bg-[#1c1c26] border border-[#252535] rounded-xl px-2.5 py-2 text-sm">
                      <option>Leonardo Vision XL</option>
                      <option>Leonardo Diffusion XL</option>
                      <option>AlbedoBase XL</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-[#8b8ba7]">Style</label>
                    <select className="w-full mt-1 bg-[#1c1c26] border border-[#252535] rounded-xl px-2.5 py-2 text-sm">
                      <option>Cinematic</option>
                      <option>Anime</option>
                      <option>Photoreal</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#8b8ba7]">Tỷ lệ khung hình</label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {['1:1','16:9','9:16','21:9'].map(r=>(
                      <button key={r} onClick={()=>setSelectedRatio(r)} className={`py-2 rounded-xl border text-xs font-medium ${selectedRatio===r? 'bg-[#7c5cff] text-white border-[#7c5cff]':'bg-[#1c1c26] border-[#252535] text-[#8b8ba7]'}`}>{r}</button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-[#8b8ba7]">Số lượng: {genCount}</label>
                  <input type="range" min={1} max={8} value={genCount} onChange={e=>setGenCount(parseInt(e.target.value))} className="w-full accent-[#7c5cff] mt-1"/>
                  <div className="flex justify-between text-[11px] text-[#8b8ba7]"><span>1</span><span>8</span></div>
                </div>

                <div className="flex items-center gap-2 text-xs bg-[#1c1c26] border border-[#252535] rounded-xl p-3">
                  <SlidersHorizontal size={14} className="text-[#8b8ba7]"/>
                  <span>Combo dùng: <b className="text-white">{activeCombo?.name}</b> • {activeModelInfo?.model?.displayName}</span>
                </div>

                <button onClick={handleGenerateImages} disabled={isGenerating} className="w-full py-3 rounded-xl bg-gradient-to-r from-[#7c5cff] to-[#00d9ff] text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {isGenerating? <Loader2 size={18} className="animate-spin"/> : <Sparkles size={18}/>}
                  {isGenerating? 'Đang tạo...':'Tạo ảnh ngay'} • {genCount*25} credits
                </button>
                <div className="text-[11px] text-center text-[#8b8ba7]">Tự động switch model nếu hết quota ngày/tháng</div>
              </div>

              {/* Center gallery */}
              <div className="flex-1 overflow-y-auto p-4 bg-[#0a0a0f]">
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex bg-[#14141c] border border-[#1e1e2a] rounded-full p-1 text-xs">
                    <button className="px-3 py-1.5 rounded-full bg-white text-black font-medium">Cá nhân</button>
                    <button className="px-3 py-1.5 rounded-full text-[#8b8ba7]">Cộng đồng</button>
                    <button className="px-3 py-1.5 rounded-full text-[#8b8ba7]">Đã thích</button>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button className="p-2 bg-[#14141c] border border-[#1e1e2a] rounded-xl"><Search size={16}/></button>
                    <button className="p-2 bg-[#14141c] border border-[#1e1e2a] rounded-xl"><SlidersHorizontal size={16}/></button>
                  </div>
                </div>

                <div className="masonry">
                  {mockImages.map((src,i)=>(
                    <div key={src+i} className="masonry-item group relative rounded-2xl overflow-hidden border border-[#1e1e2a] bg-[#14141c]">
                      <img src={src} alt="" className="w-full"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/0 to-transparent opacity-0 group-hover:opacity-100 transition p-3 flex flex-col justify-end">
                        <div className="text-xs text-white line-clamp-2">{imagePrompt}</div>
                        <div className="flex gap-1.5 mt-2">
                          <button className="text-[11px] px-2 py-1 rounded-full bg-white text-black font-medium">Remix</button>
                          <button className="text-[11px] px-2 py-1 rounded-full bg-white/20 backdrop-blur text-white border border-white/20">Upscale</button>
                          <button className="ml-auto w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"><Copy size={12} className="text-white"/></button>
                        </div>
                      </div>
                      <div className="absolute top-2 left-2 text-[10px] px-2 py-1 rounded-full bg-black/60 backdrop-blur text-white border border-white/10">{selectedRatio} • XL</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* PROJECTS */}
          {view==='projects' && (
            <div className="p-4 md:p-6 max-w-[1200px] mx-auto">
              <div className="flex items-center gap-3">
                <button onClick={()=>setShowNewProject(true)} className="px-4 py-2.5 bg-[#7c5cff] text-white rounded-xl font-medium flex items-center gap-2"><Plus size={16}/> Project mới</button>
                <div className="ml-auto flex items-center gap-2">
                  <div className="hidden md:flex bg-[#14141c] border border-[#1e1e2a] rounded-full p-1 text-xs">
                    <button className="px-3 py-1.5 rounded-full bg-white text-black">Tất cả</button>
                    <button className="px-3 py-1.5 rounded-full text-[#8b8ba7]">Đã ghim</button>
                    <button className="px-3 py-1.5 rounded-full text-[#8b8ba7]">Gần đây</button>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                {projects.map(p=>(
                  <div key={p.id} className="bg-[#14141c] border border-[#1e1e2a] rounded-2xl p-5 hover:border-[#252535] transition group">
                    <div className="flex items-start gap-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-xl" style={{background: p.color+'15', border:`1px solid ${p.color}30`}}>{p.icon}</div>
                      <div className="flex-1 min-w-0">
                        <div className="font-bold truncate flex items-center gap-1.5">{p.name} {p.pinned && <Pin size={12} className="fill-[#7c5cff] text-[#7c5cff]"/>}</div>
                        <div className="text-xs text-[#8b8ba7] line-clamp-2">{p.description}</div>
                      </div>
                      <button className="p-1.5 hover:bg-white/5 rounded-lg opacity-0 group-hover:opacity-100"><MoreHorizontal size={16}/></button>
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-xs">
                      <span className="px-2 py-1 rounded-full bg-[#0a0a0f] border border-[#252535] flex items-center gap-1"><MessageSquare size={12}/> {p.chatIds.length} chats</span>
                      <span className="px-2 py-1 rounded-full bg-[#0a0a0f] border border-[#252535]">{p.files} files</span>
                      <span className="ml-auto text-[#8b8ba7]">{new Date(p.updatedAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div className="mt-4 space-y-1.5 max-h-[120px] overflow-y-auto">
                      {p.chatIds.map(cid=>{
                        const c = chats.find(x=>x.id===cid)
                        if(!c) return null
                        return <button key={cid} onClick={()=>setActiveChat(cid)} className="w-full text-left px-3 py-2 rounded-xl bg-[#0a0a0f] border border-[#252535] hover:border-[#7c5cff]/30 text-xs truncate">💬 {c.title}</button>
                      })}
                      {p.chatIds.length===0 && <div className="text-xs text-[#8b8ba7] italic">Chưa có chat — tạo ngay</div>}
                    </div>
                    <div className="flex gap-2 mt-4">
                      <button onClick={()=>{
                        const id='ch'+Date.now()
                        addChat({ id, title: 'Chat mới trong '+p.name, projectId: p.id, comboId: combos[0].id, pinned:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), messages:[], preview:'' })
                        
                      }} className="flex-1 py-2 rounded-xl bg-white text-black text-sm font-medium">New chat</button>
                      <button onClick={()=>togglePinProject(p.id)} className="px-3 py-2 rounded-xl bg-[#1c1c26] border border-[#252535] text-sm"><Pin size={14}/></button>
                    </div>
                  </div>
                ))}

                <button onClick={()=>setShowNewProject(true)} className="border-2 border-dashed border-[#252535] rounded-2xl p-8 flex flex-col items-center justify-center gap-3 hover:border-[#7c5cff]/40 hover:bg-[#7c5cff]/5 transition min-h-[280px]">
                  <div className="w-12 h-12 rounded-2xl bg-[#1c1c26] border border-[#252535] flex items-center justify-center"><Plus size={20}/></div>
                  <div className="font-semibold">Tạo Project mới</div>
                  <div className="text-xs text-[#8b8ba7] text-center">Nhóm chat, file và pin như ChatGPT Workspace</div>
                </button>
              </div>
            </div>
          )}

          {/* COMBOS */}
          {view==='combos' && (
            <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-6">
              <div className="bg-[#14141c] border border-[#1e1e2a] rounded-2xl p-5">
                <div className="flex flex-col md:flex-row md:items-center gap-3">
                  <div>
                    <h3 className="font-bold text-lg flex items-center gap-2"><Layers size={18} className="text-[#7c5cff]"/> Combo là gì?</h3>
                    <p className="text-sm text-[#8b8ba7] mt-1 max-w-2xl">Một combo là nhóm các model (ví dụ: Gemini Flash → GPT-4o mini → Claude Haiku). Hệ thống sẽ dùng model đầu tiên còn <b className="text-white">token free</b>. Khi hết quota <b className="text-white">ngày (refill 00:00 UTC)</b> hoặc <b className="text-white">tháng (mùng 1)</b>, tự động chuyển sang model kế tiếp — không cần đổi tay.</p>
                  </div>
                  <button onClick={()=>setShowNewCombo(true)} className="md:ml-auto px-4 py-2.5 bg-[#7c5cff] text-white rounded-xl font-medium flex items-center gap-2 shrink-0"><Plus size={16}/> Tạo Combo</button>
                </div>
                <div className="grid md:grid-cols-3 gap-3 mt-4 text-xs">
                  <div className="p-3 rounded-xl bg-[#0a0a0f] border border-[#252535]"><div className="font-semibold flex items-center gap-1.5"><Zap size={12} className="text-amber-400"/> Fallback</div><div className="text-[#8b8ba7] mt-1">Dùng tuần tự. Hết A → B → C. Phù hợp tiết kiệm.</div></div>
                  <div className="p-3 rounded-xl bg-[#0a0a0f] border border-[#252535]"><div className="font-semibold flex items-center gap-1.5"><Timer size={12} className="text-cyan-400"/> Round-robin</div><div className="text-[#8b8ba7] mt-1">Chia đều request vòng tròn.</div></div>
                  <div className="p-3 rounded-xl bg-[#0a0a0f] border border-[#252535]"><div className="font-semibold flex items-center gap-1.5"><Coins size={12} className="text-emerald-400"/> Balance</div><div className="text-[#8b8ba7] mt-1">Ưu tiên model còn nhiều quota nhất.</div></div>
                </div>
              </div>

              <div className="space-y-4">
                {combos.map(c=>{
                  const models = c.modelIds.map(id=> getModelById(id)).filter(Boolean) as AIModel[]
                  const isEditing = editCombo===c.id
                  return (
                    <div key={c.id} className="bg-[#14141c] border border-[#1e1e2a] rounded-2xl overflow-hidden">
                      <div className="p-5 flex gap-4">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl shrink-0" style={{background: c.color+'15', border:`1px solid ${c.color}30`}}>{c.icon}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="font-bold">{c.name}</h4>
                            <span className="text-xs px-2 py-1 rounded-full bg-[#1c1c26] border border-[#252535]">{c.strategy}</span>
                            <span className="text-xs px-2 py-1 rounded-full bg-[#1c1c26] border border-[#252535] flex items-center gap-1"><Timer size={10}/> refill {c.refill}</span>
                            <span className="text-xs text-[#8b8ba7] ml-auto">{new Date(c.createdAt).toLocaleDateString('vi-VN')}</span>
                          </div>
                          <p className="text-sm text-[#8b8ba7] mt-1">{c.description}</p>

                          {/* model list */}
                          <div className="mt-4 space-y-2">
                            {models.map((m,i)=>{
                              const provider = getProviderByModel(m.id)
                              const remainDaily = m.freeTokensPerDay - m.usedToday
                              const remainMonth = m.freeTokensPerMonth - m.usedMonth
                              const pctDaily = Math.round(m.usedToday / m.freeTokensPerDay*100)
                              return (
                                <div key={m.id} className="flex items-center gap-3 bg-[#0a0a0f] border border-[#252535] rounded-xl px-3 py-2.5">
                                  <GripVertical size={14} className="text-[#8b8ba7] cursor-grab"/>
                                  <span className="w-6 h-6 rounded-full bg-[#1c1c26] border border-[#252535] flex items-center justify-center text-xs font-mono">{i+1}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium flex items-center gap-2">
                                      {m.displayName}
                                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-white/10 border border-white/10">{provider?.name}</span>
                                      {!m.enabled && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">Tắt</span>}
                                    </div>
                                    <div className="flex gap-3 text-xs text-[#8b8ba7] mt-0.5">
                                      <span>Ngày: {remainDaily.toLocaleString()}/{m.freeTokensPerDay.toLocaleString()}</span>
                                      <span className="hidden sm:inline">Tháng: {remainMonth.toLocaleString()}/{m.freeTokensPerMonth.toLocaleString()}</span>
                                    </div>
                                  </div>
                                  <div className="hidden md:block w-24">
                                    <div className="h-1.5 bg-[#252535] rounded-full overflow-hidden"><div className="h-full" style={{width: pctDaily+'%', background: pctDaily>80? '#f59e0b':'#7c5cff'}}/></div>
                                    <div className="text-[10px] text-[#8b8ba7] text-right mt-1">{pctDaily}% ngày</div>
                                  </div>
                                  <span className={`w-2 h-2 rounded-full ${remainDaily>500 && remainMonth>500? 'bg-emerald-500':'bg-amber-500'} animate-pulse`}/>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                      <div className="px-5 py-3 bg-[#0f0f15] border-t border-[#1e1e2a] flex flex-wrap gap-2">
                        <button onClick={()=>setEditCombo(isEditing? null: c.id)} className="text-xs px-3 py-1.5 rounded-full border border-[#252535] hover:bg-white/5 flex items-center gap-1.5"><Settings2 size={12}/> {isEditing? 'Đóng':'Chỉnh sửa thứ tự'}</button>
                        <button onClick={()=>{ const id='ch'+Date.now(); addChat({ id, title: `Chat với ${c.name}`, comboId: c.id, pinned:false, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString(), messages:[], preview:'Dùng combo '+c.name })}} className="text-xs px-3 py-1.5 rounded-full bg-white text-black font-medium">Dùng combo này →</button>
                        <button onClick={()=>deleteCombo(c.id)} className="ml-auto text-xs px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1"><Trash2 size={12}/> Xóa</button>
                      </div>

                      {isEditing && (
                        <div className="p-5 bg-[#0a0a0f] border-t border-[#1e1e2a]">
                          <h5 className="text-sm font-semibold">Sửa combo</h5>
                          <div className="grid md:grid-cols-2 gap-3 mt-3">
                            <input defaultValue={c.name} onBlur={e=> updateCombo(c.id, {name: e.target.value})} className="bg-[#1c1c26] border border-[#252535] rounded-xl px-3 py-2 text-sm" placeholder="Tên combo"/>
                            <select defaultValue={c.strategy} onChange={e=> updateCombo(c.id, {strategy: e.target.value as any})} className="bg-[#1c1c26] border border-[#252535] rounded-xl px-3 py-2 text-sm">
                              <option value="fallback">Fallback</option>
                              <option value="round-robin">Round-robin</option>
                              <option value="balance">Balance</option>
                            </select>
                          </div>
                          <div className="mt-3">
                            <div className="text-xs text-[#8b8ba7] mb-2">Chọn model trong combo (kéo để sắp xếp ưu tiên):</div>
                            <div className="flex flex-wrap gap-2">
                              {providers.flatMap(p=>p.models).map(m=>{
                                const checked = c.modelIds.includes(m.id)
                                return (
                                  <label key={m.id} className={`text-xs px-2.5 py-1.5 rounded-full border cursor-pointer flex items-center gap-1.5 ${checked? 'bg-[#7c5cff] text-white border-[#7c5cff]':'bg-[#1c1c26] border-[#252535] text-[#8b8ba7]'}`}>
                                    <input type="checkbox" className="hidden" checked={checked} onChange={e=>{
                                      if(e.target.checked) updateCombo(c.id, {modelIds: [...c.modelIds, m.id]})
                                      else updateCombo(c.id, {modelIds: c.modelIds.filter(x=>x!==m.id)})
                                    }}/>
                                    {checked && <Check size={12}/>} {m.displayName}
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* KEYS */}
          {view==='keys' && (
            <div className="p-4 md:p-6 max-w-[1100px] mx-auto space-y-6">
              <div className="bg-gradient-to-br from-[#1c1c26] to-[#14141c] border border-[#252535] rounded-2xl p-5 flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <h3 className="font-bold flex items-center gap-2"><KeyRound size={18} className="text-[#7c5cff]"/> Kết nối nhà cung cấp qua API Key</h3>
                  <p className="text-sm text-[#8b8ba7] mt-1">Thêm API key cho từng provider. AI Studio sẽ tự lưu an toàn (mã hóa local), cho phép bạn cấu hình quota free theo ngày & tháng cho từng model.</p>
                  <div className="flex gap-2 mt-3 text-xs">
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{providers.filter(p=>p.connected).length} đã kết nối</span>
                    <span className="px-2.5 py-1 rounded-full bg-[#0a0a0f] border border-[#252535]">{providers.reduce((a,p)=>a+p.models.filter(m=>m.enabled).length,0)} models đang bật</span>
                  </div>
                </div>
                <div className="md:w-[320px] bg-[#0a0a0f] border border-[#252535] rounded-xl p-3 text-xs space-y-2">
                  <div className="font-semibold flex items-center gap-1.5"><AlertCircle size={12} className="text-amber-400"/> Lưu ý bảo mật</div>
                  <ul className="list-disc pl-4 space-y-1 text-[#8b8ba7]">
                    <li>Key được lưu trong localStorage (demo). Production sẽ mã hóa AES + vault.</li>
                    <li>Không log prompt ra ngoài combo đã chọn.</li>
                    <li>Test connection trước khi đưa vào combo.</li>
                  </ul>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {providers.map(p=>(
                  <div key={p.id} className="bg-[#14141c] border border-[#1e1e2a] rounded-2xl p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold border" style={{background: p.color+'15', borderColor: p.color+'30', color: p.color}}>{p.icon}</div>
                      <div className="flex-1">
                        <div className="font-bold flex items-center gap-2">{p.name} {p.connected? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500 text-white flex items-center gap-1"><span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"/> Connected</span> : <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#252535] text-[#8b8ba7] border border-[#252535]">Chưa kết nối</span>}</div>
                        <div className="text-xs text-[#8b8ba7]">{p.baseUrl}</div>
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-[#0a0a0f] border border-[#252535]">{p.models.length} models</span>
                    </div>

                    <div className="mt-4">
                      <label className="text-xs font-semibold text-[#8b8ba7]">API Key</label>
                      <div className="flex gap-2 mt-1.5">
                        <div className="flex-1 relative">
                          <input
                            type={keyVisibility[p.id]? 'text':'password'}
                            value={p.apiKey}
                            onChange={e=>upsertProviderKey(p.id, e.target.value)}
                            placeholder={p.id==='openai'? 'sk-proj-...': p.id==='anthropic'? 'sk-ant-...':'AIza...'}
                            className="w-full bg-[#0a0a0f] border border-[#252535] rounded-xl pl-3 pr-9 py-2.5 text-sm font-mono focus:outline-none focus:border-[#7c5cff]/50"
                          />
                          <button onClick={()=>setKeyVisibility(v=>({...v, [p.id]: !v[p.id]}))} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/5 rounded-lg text-[#8b8ba7]">
                            {keyVisibility[p.id]? <EyeOff size={14}/> : <Eye size={14}/>}
                          </button>
                        </div>
                        <button className="px-3 py-2 rounded-xl bg-white text-black text-sm font-medium flex items-center gap-1.5"><Zap size={14}/> Test</button>
                      </div>
                      <div className="flex gap-1.5 mt-2">
                        <button onClick={()=>navigator.clipboard.writeText(p.apiKey)} className="text-xs px-2.5 py-1 rounded-full border border-[#252535] hover:bg-white/5 flex items-center gap-1"><Copy size={12}/> Copy</button>
                        <button onClick={()=>upsertProviderKey(p.id,'')} className="text-xs px-2.5 py-1 rounded-full border border-red-500/20 text-red-400 hover:bg-red-500/10">Xóa key</button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="text-xs font-semibold flex items-center gap-1.5"><Cpu size={12}/> Models & Quota free</div>
                      {p.models.map(m=>{
                        const remainDaily = m.freeTokensPerDay - m.usedToday
                        const remainMonth = m.freeTokensPerMonth - m.usedMonth
                        return (
                          <div key={m.id} className="bg-[#0a0a0f] border border-[#252535] rounded-xl p-3">
                            <div className="flex items-center gap-2">
                              <input type="checkbox" checked={m.enabled} onChange={()=>toggleModelEnabled(p.id, m.id)} className="accent-[#7c5cff]"/>
                              <span className="text-sm font-medium flex-1">{m.displayName}</span>
                              <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#1c1c26] border border-[#252535]">{m.contextWindow.toLocaleString()} ctx</span>
                              <span className={`w-2 h-2 rounded-full ${remainDaily>1000? 'bg-emerald-500':'bg-amber-500'}`}/>
                            </div>
                            <div className="grid grid-cols-2 gap-2 mt-2">
                              <div className="bg-[#14141c] border border-[#1e1e2a] rounded-lg p-2">
                                <div className="text-[10px] tracking-widest uppercase text-[#8b8ba7] font-semibold">Free / ngày</div>
                                <div className="text-sm font-mono font-bold">{m.freeTokensPerDay.toLocaleString()}</div>
                                <div className="text-[11px] text-[#8b8ba7]">Còn {remainDaily.toLocaleString()} • refill 00:00 UTC</div>
                                <div className="h-1 bg-[#252535] rounded-full mt-1 overflow-hidden"><div className="h-full bg-[#00d9ff]" style={{width: Math.min(100, Math.round(m.usedToday/m.freeTokensPerDay*100))+'%'}}/></div>
                              </div>
                              <div className="bg-[#14141c] border border-[#1e1e2a] rounded-lg p-2">
                                <div className="text-[10px] tracking-widest uppercase text-[#8b8ba7] font-semibold">Free / tháng</div>
                                <div className="text-sm font-mono font-bold">{m.freeTokensPerMonth.toLocaleString()}</div>
                                <div className="text-[11px] text-[#8b8ba7]">Còn {remainMonth.toLocaleString()} • mùng 1 refill</div>
                                <div className="h-1 bg-[#252535] rounded-full mt-1 overflow-hidden"><div className="h-full bg-[#7c5cff]" style={{width: Math.min(100, Math.round(m.usedMonth/m.freeTokensPerMonth*100))+'%'}}/></div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="bg-[#1c1c26] border border-[#252535] rounded-2xl p-4 flex flex-col md:flex-row gap-3 text-sm">
                <div className="flex-1">
                  <div className="font-semibold">Thêm provider tùy chỉnh</div>
                  <div className="text-xs text-[#8b8ba7]">Hỗ trợ OpenAI-compatible API (Groq, Together, OpenRouter...)</div>
                </div>
                <button className="px-4 py-2 rounded-xl bg-[#0a0a0f] border border-[#252535] hover:border-[#7c5cff]/40 text-sm font-medium">+ Thêm Provider</button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showNewProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={()=>setShowNewProject(false)}>
          <div onClick={e=>e.stopPropagation()} className="w-full max-w-md bg-[#14141c] border border-[#252535] rounded-2xl p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Tạo Project mới</h3>
              <button onClick={()=>setShowNewProject(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X size={18}/></button>
            </div>
            <form onSubmit={e=>{
              e.preventDefault()
              const fd = new FormData(e.currentTarget as HTMLFormElement)
              const name = String(fd.get('name')||'').trim()
              if(!name) return
              createProject({
                id: 'p'+Date.now(),
                name,
                description: String(fd.get('desc')||''),
                icon: String(fd.get('icon')||'📁'),
                color: '#7c5cff',
                pinned: false,
                updatedAt: new Date().toISOString(),
                chatIds: [],
                files: 0
              })
              setShowNewProject(false)
            }} className="space-y-4 mt-4">
              <div>
                <label className="text-xs text-[#8b8ba7]">Tên project</label>
                <input name="name" required placeholder="VD: Chiến dịch Q4" className="w-full mt-1 bg-[#0a0a0f] border border-[#252535] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#7c5cff]/50"/>
              </div>
              <div>
                <label className="text-xs text-[#8b8ba7]">Mô tả</label>
                <textarea name="desc" rows={2} placeholder="Mô tả ngắn..." className="w-full mt-1 bg-[#0a0a0f] border border-[#252535] rounded-xl px-3 py-2.5 text-sm"/>
              </div>
              <div>
                <label className="text-xs text-[#8b8ba7]">Icon</label>
                <select name="icon" className="w-full mt-1 bg-[#0a0a0f] border border-[#252535] rounded-xl px-3 py-2.5 text-sm">
                  <option>🎬</option><option>🎨</option><option>🔍</option><option>📚</option><option>💡</option><option>🚀</option>
                </select>
              </div>
              <button type="submit" className="w-full py-2.5 bg-[#7c5cff] text-white rounded-xl font-medium">Tạo Project</button>
            </form>
          </div>
        </div>
      )}

      {showNewCombo && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={()=>setShowNewCombo(false)}>
          <div onClick={e=>e.stopPropagation()} className="w-full max-w-lg bg-[#14141c] border border-[#252535] rounded-2xl p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg">Tạo Combo mới</h3>
              <button onClick={()=>setShowNewCombo(false)} className="p-1.5 hover:bg-white/5 rounded-lg"><X size={18}/></button>
            </div>
            <form onSubmit={e=>{
              e.preventDefault()
              const fd = new FormData(e.currentTarget as HTMLFormElement)
              const name = String(fd.get('name')||'').trim()
              const desc = String(fd.get('desc')||'')
              const strategy = String(fd.get('strategy')||'fallback') as any
              const refill = String(fd.get('refill')||'daily') as any
              const selected = Array.from((e.currentTarget as HTMLFormElement).querySelectorAll<HTMLInputElement>('input[name="models"]:checked')).map(i=>i.value)
              if(!name || selected.length===0) return alert('Nhập tên và chọn ít nhất 1 model')
              addCombo({ id: 'c'+Date.now(), name, description: desc, modelIds: selected, strategy, refill, icon: '✨', color: '#7c5cff', createdAt: new Date().toISOString() })
              setShowNewCombo(false)
            }} className="space-y-4 mt-4">
              <input name="name" required placeholder="Tên combo, VD: Combo Siêu Tiết Kiệm" className="w-full bg-[#0a0a0f] border border-[#252535] rounded-xl px-3 py-2.5 text-sm"/>
              <textarea name="desc" rows={2} placeholder="Mô tả combo..." className="w-full bg-[#0a0a0f] border border-[#252535] rounded-xl px-3 py-2.5 text-sm"/>
              <div className="grid grid-cols-2 gap-3">
                <select name="strategy" className="bg-[#0a0a0f] border border-[#252535] rounded-xl px-3 py-2.5 text-sm">
                  <option value="fallback">Fallback (tuần tự)</option>
                  <option value="round-robin">Round-robin</option>
                  <option value="balance">Balance</option>
                </select>
                <select name="refill" className="bg-[#0a0a0f] border border-[#252535] rounded-xl px-3 py-2.5 text-sm">
                  <option value="daily">Refill hàng ngày</option>
                  <option value="monthly">Refill hàng tháng</option>
                  <option value="both">Cả ngày & tháng</option>
                </select>
              </div>
              <div>
                <div className="text-xs font-semibold text-[#8b8ba7] mb-2">Chọn models (thứ tự = ưu tiên):</div>
                <div className="grid grid-cols-1 gap-1.5 max-h-[220px] overflow-y-auto pr-1">
                  {providers.flatMap(p=>p.models.map(m=> ({...m, provider: p.name})) ).map(m=>(
                    <label key={m.id} className="flex items-center gap-2 bg-[#0a0a0f] border border-[#252535] rounded-xl px-3 py-2 text-sm cursor-pointer hover:border-[#7c5cff]/30">
                      <input type="checkbox" name="models" value={m.id} className="accent-[#7c5cff]"/>
                      <span className="flex-1">{m.displayName}</span>
                      <span className="text-xs text-[#8b8ba7]">{m.provider}</span>
                    </label>
                  ))}
                </div>
              </div>
              <button type="submit" className="w-full py-2.5 bg-[#7c5cff] text-white rounded-xl font-medium">Tạo Combo</button>
            </form>
          </div>
        </div>
      )}

      {showNewChatProject && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={()=>setShowNewChatProject(null)}>
          <div onClick={e=>e.stopPropagation()} className="w-full max-w-sm bg-[#14141c] border border-[#252535] rounded-2xl p-6">
            <h3 className="font-bold">Tạo Project cho chat này</h3>
            <form onSubmit={e=>{
              e.preventDefault()
              const fd = new FormData(e.currentTarget as HTMLFormElement)
              const name = String(fd.get('name')||'').trim()
              if(!name) return
              const pid = 'p'+Date.now()
              createProject({ id: pid, name, description:'', icon:'📁', color:'#7c5cff', pinned:false, updatedAt:new Date().toISOString(), chatIds:[showNewChatProject!], files:0 })
              useStore.setState(s=> ({ chats: s.chats.map(c=> c.id===showNewChatProject? {...c, projectId: pid}:c)}))
              setShowNewChatProject(null)
            }} className="space-y-3 mt-3">
              <input name="name" autoFocus placeholder="Tên project" className="w-full bg-[#0a0a0f] border border-[#252535] rounded-xl px-3 py-2.5 text-sm"/>
              <button type="submit" className="w-full py-2.5 bg-[#7c5cff] text-white rounded-xl font-medium">Tạo & gán</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
