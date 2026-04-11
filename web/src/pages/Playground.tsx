import { useState, useEffect, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router-dom'
import { Send, Plus, Trash2, Loader2, Copy, Check, ChevronDown, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { cn, getStatusColor, formatSize, formatStructuredText, generateId } from '@/lib/utils'
import { fetchUpstreams, sendReplay } from '@/lib/api'
import type { Upstream, ReplayResponse } from '@/lib/api'
import { JsonViewer } from '@/components/JsonViewer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

const HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const

const METHOD_COLORS: Record<string, string> = {
    GET: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    POST: 'bg-blue-500/10 text-blue-600 border-blue-500/30',
    PUT: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    PATCH: 'bg-orange-500/10 text-orange-600 border-orange-500/30',
    DELETE: 'bg-red-500/10 text-red-600 border-red-500/30',
    HEAD: 'bg-purple-500/10 text-purple-600 border-purple-500/30',
    OPTIONS: 'bg-gray-500/10 text-gray-600 border-gray-500/30',
}

interface HeaderEntry {
    key: string
    value: string
    id: string
}

type RequestTab = 'body' | 'headers'
type ResponseViewMode = 'pretty' | 'raw'

export function Playground() {
    const { t } = useTranslation()
    const location = useLocation()

    const [upstreams, setUpstreams] = useState<Upstream[]>([])
    const [upstream, setUpstream] = useState('')
    const [method, setMethod] = useState('POST')
    const [path, setPath] = useState('')
    const [headers, setHeaders] = useState<HeaderEntry[]>([
        { key: 'Content-Type', value: 'application/json', id: generateId() },
    ])
    const [body, setBody] = useState('')

    const [response, setResponse] = useState<ReplayResponse | null>(null)
    const [sending, setSending] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [elapsed, setElapsed] = useState<number | null>(null)
    const [copiedField, setCopiedField] = useState<string | null>(null)

    const [methodOpen, setMethodOpen] = useState(false)
    const [upstreamOpen, setUpstreamOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<RequestTab>('body')
    const [responseViewMode, setResponseViewMode] = useState<ResponseViewMode>('pretty')

    useEffect(() => {
        fetchUpstreams().then((data) => {
            setUpstreams(data || [])
            if (data?.length > 0 && !upstream) {
                setUpstream(data[0].name)
            }
        })
    }, [])

    useEffect(() => {
        const state = location.state as { replay?: { upstream?: string; method?: string; path?: string; body?: string; headers?: Record<string, string | string[]> } } | null
        if (!state?.replay) return

        const replay = state.replay
        if (replay.upstream) setUpstream(replay.upstream)
        if (replay.method) setMethod(replay.method)
        if (replay.path) setPath(replay.path)
        if (typeof replay.body === 'string') {
            setBody(formatStructuredText(replay.body).formatted)
        }
        if (replay.headers && typeof replay.headers === 'object') {
            const entries: HeaderEntry[] = Object.entries(replay.headers)
                .filter(([key]) => {
                    const skip = ['host', 'connection', 'keep-alive', 'transfer-encoding', 'te', 'trailer', 'upgrade', 'proxy-authorization', 'proxy-authenticate', 'proxy-connection']
                    return !skip.includes(key.toLowerCase())
                })
                .map(([key, value]) => ({
                    key,
                    value: Array.isArray(value) ? value.join('; ') : value,
                    id: generateId(),
                }))
            if (entries.length > 0) setHeaders(entries)
        }

        window.history.replaceState({}, '')
    }, [location.state])

    const parsedResponseBody = useMemo(() => {
        if (responseViewMode !== 'pretty' || !response?.body) return null
        try {
            return JSON.parse(response.body)
        } catch {
            return null
        }
    }, [responseViewMode, response?.body])

    const handleAddHeader = () => {
        setHeaders((prev) => [...prev, { key: '', value: '', id: generateId() }])
    }

    const handleRemoveHeader = (id: string) => {
        setHeaders((prev) => prev.filter((header) => header.id !== id))
    }

    const handleHeaderChange = (id: string, field: 'key' | 'value', value: string) => {
        setHeaders((prev) => prev.map((header) => (header.id === id ? { ...header, [field]: value } : header)))
    }

    const copyToClipboard = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const handleFormatBody = useCallback(() => {
        if (!body.trim()) return

        const result = formatStructuredText(body)
        if (result.kind !== 'json') {
            toast.error(t('playground.body_format_failed', { defaultValue: '当前请求体不是有效 JSON，无法格式化' }))
            return
        }

        setBody(result.formatted)
        toast.success(t('playground.body_formatted', { defaultValue: '请求体已格式化' }))
    }, [body, t])

    const handleSend = useCallback(async () => {
        if (!upstream || !method) return

        setError(null)
        setResponse(null)
        setResponseViewMode('pretty')
        setSending(true)

        const headerMap: Record<string, string> = {}
        headers.forEach((header) => {
            if (header.key.trim()) {
                headerMap[header.key.trim()] = header.value
            }
        })

        const startTime = performance.now()
        try {
            const replayResponse = await sendReplay({
                upstream,
                method,
                path,
                headers: headerMap,
                body,
            })
            setElapsed(Math.round(performance.now() - startTime))
            setResponse(replayResponse)
        } catch (err: any) {
            setElapsed(Math.round(performance.now() - startTime))
            setError(err?.message || '请求失败')
        } finally {
            setSending(false)
        }
    }, [upstream, method, path, headers, body])

    useEffect(() => {
        const handler = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault()
                handleSend()
            }
        }

        window.addEventListener('keydown', handler)
        return () => window.removeEventListener('keydown', handler)
    }, [handleSend])

    const RawBodyViewer = ({ text }: { text: string }) => (
        <pre className="whitespace-pre-wrap break-all text-[11px] font-mono leading-relaxed text-foreground select-text">
            {text}
        </pre>
    )

    const ViewToggle = ({
        value,
        onChange,
    }: {
        value: ResponseViewMode
        onChange: (value: ResponseViewMode) => void
    }) => (
        <div className="flex items-center gap-1 rounded-md border border-border/40 bg-background/70 p-1">
            {([
                { value: 'pretty', label: t('log_detail.view_pretty', 'Pretty') },
                { value: 'raw', label: t('log_detail.view_raw', 'Raw') },
            ] as const).map((option) => (
                <Button
                    key={option.value}
                    type="button"
                    variant={value === option.value ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => onChange(option.value)}
                    className={cn(
                        'h-6 px-2 text-[10px] font-bold uppercase tracking-wider',
                        value === option.value && 'shadow-none'
                    )}
                >
                    {option.label}
                </Button>
            ))}
        </div>
    )

    return (
        <div className="w-full space-y-5 animate-fade-in">
            <div className="flex items-center gap-2 rounded-2xl border border-border/50 bg-muted/20 p-1.5 shadow-sm">
                <div className="relative shrink-0">
                    <button
                        onClick={() => setMethodOpen((open) => !open)}
                        className={cn(
                            'flex min-w-[80px] items-center justify-between gap-1 rounded-xl border px-3 py-2.5 text-xs font-black uppercase tracking-wider transition-all',
                            METHOD_COLORS[method] || METHOD_COLORS.GET
                        )}
                    >
                        {method}
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                    {methodOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setMethodOpen(false)} />
                            <div className="absolute left-0 top-full z-50 mt-2 min-w-[120px] rounded-lg border border-border bg-popover py-1 shadow-xl">
                                {HTTP_METHODS.map((item) => (
                                    <button
                                        key={item}
                                        onClick={() => {
                                            setMethod(item)
                                            setMethodOpen(false)
                                        }}
                                        className={cn(
                                            'w-full px-3 py-1.5 text-left text-xs font-bold uppercase tracking-wider transition-colors hover:bg-accent',
                                            item === method && 'bg-accent'
                                        )}
                                    >
                                        {item}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="relative shrink-0">
                    <button
                        onClick={() => setUpstreamOpen((open) => !open)}
                        className="flex min-w-[90px] items-center justify-between gap-1 rounded-xl border border-input bg-background/80 px-3 py-2.5 text-xs font-bold shadow-sm transition-all hover:bg-accent"
                    >
                        <span className="max-w-[100px] truncate text-foreground/80">
                            {upstream || t('playground.select_upstream')}
                        </span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                    </button>
                    {upstreamOpen && (
                        <>
                            <div className="fixed inset-0 z-40" onClick={() => setUpstreamOpen(false)} />
                            <div className="absolute left-0 top-full z-50 mt-2 min-w-[180px] rounded-lg border border-border bg-popover py-1 shadow-xl">
                                {upstreams.map((item) => (
                                    <button
                                        key={item.name}
                                        onClick={() => {
                                            setUpstream(item.name)
                                            setUpstreamOpen(false)
                                        }}
                                        className={cn(
                                            'w-full px-3 py-1.5 text-left text-xs font-bold transition-colors hover:bg-accent',
                                            item.name === upstream && 'bg-accent'
                                        )}
                                    >
                                        <span className="font-black">{item.name}</span>
                                        <span className="ml-2 truncate font-normal text-muted-foreground">{item.target}</span>
                                    </button>
                                ))}
                                {upstreams.length === 0 && (
                                    <div className="px-3 py-2 text-xs italic text-muted-foreground">
                                        {t('playground.no_upstreams')}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>

                <input
                    type="text"
                    value={path}
                    onChange={(event) => setPath(event.target.value)}
                    placeholder="/v1/chat/completions"
                    className="min-w-0 flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm font-mono shadow-sm transition-all placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />

                <Button
                    onClick={handleSend}
                    disabled={sending || !upstream}
                    className="h-auto shrink-0 gap-2 px-5 py-2.5 font-black shadow-lg shadow-primary/20 transition-all"
                >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    <span className="hidden sm:inline">{t('playground.send')}</span>
                </Button>
            </div>

            <div className="space-y-0">
                <div className="flex items-center gap-1 border-b border-border/30">
                    <button
                        onClick={() => setActiveTab('body')}
                        className={cn(
                            'border-b-2 -mb-px px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all',
                            activeTab === 'body'
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'
                        )}
                    >
                        {t('playground.body')}
                    </button>
                    <button
                        onClick={() => setActiveTab('headers')}
                        className={cn(
                            'flex items-center gap-1.5 border-b-2 -mb-px px-4 py-2.5 text-xs font-black uppercase tracking-wider transition-all',
                            activeTab === 'headers'
                                ? 'border-primary text-foreground'
                                : 'border-transparent text-muted-foreground/50 hover:text-muted-foreground/80'
                        )}
                    >
                        {t('playground.headers')}
                        {headers.length > 0 && (
                            <span
                                className={cn(
                                    'rounded-full px-1.5 py-0.5 text-[9px] font-bold',
                                    activeTab === 'headers'
                                        ? 'bg-primary/10 text-primary'
                                        : 'bg-muted text-muted-foreground/50'
                                )}
                            >
                                {headers.length}
                            </span>
                        )}
                    </button>
                </div>

                {activeTab === 'body' && (
                    <div className="pt-3">
                        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card/70 shadow-sm">
                            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 bg-muted/20 px-4 py-3">
                                <div className="space-y-1">
                                    <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">
                                        {t('playground.body')}
                                    </div>
                                    <p className="text-xs text-muted-foreground/70">
                                        {t('playground.body_resize_hint', { defaultValue: '拖拽文本框底边可上下调节高度' })}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleFormatBody}
                                    disabled={!body.trim()}
                                    className="h-8 rounded-full border-border/60 bg-background/80 px-3.5 text-[11px] font-bold shadow-xs hover:bg-accent/70"
                                >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    {t('playground.format_body', { defaultValue: '格式化' })}
                                </Button>
                            </div>
                            <Textarea
                                value={body}
                                onChange={(event) => setBody(event.target.value)}
                                placeholder='{ "model": "gpt-4", "messages": [...] }'
                                className="prism-resizable custom-scrollbar min-h-[260px] max-h-[70vh] rounded-none border-0 bg-transparent px-4 py-4 font-mono text-xs leading-relaxed shadow-none focus-visible:border-transparent focus-visible:ring-0"
                                spellCheck={false}
                            />
                        </div>
                    </div>
                )}

                {activeTab === 'headers' && (
                    <div className="pt-3">
                        <div className="rounded-2xl border border-border/60 bg-card/70 p-3 shadow-sm sm:p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                                <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">
                                    {t('playground.headers')}
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleAddHeader}
                                    className="h-8 rounded-full px-3 text-[11px] font-bold text-muted-foreground/70 hover:text-foreground"
                                >
                                    <Plus className="h-3 w-3" />
                                    {t('playground.add_header')}
                                </Button>
                            </div>
                            <div className="custom-scrollbar max-h-[280px] space-y-1.5 overflow-y-auto">
                                {headers.map((header) => (
                                    <div
                                        key={header.id}
                                        className="flex items-center gap-2 rounded-xl border border-transparent bg-background/50 px-2 py-2 transition-colors hover:border-border/60 hover:bg-background/80"
                                    >
                                        <input
                                            type="text"
                                            value={header.key}
                                            onChange={(event) => handleHeaderChange(header.id, 'key', event.target.value)}
                                            placeholder="Header Name"
                                            className="w-[35%] rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono font-bold shadow-xs transition-all placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-[30%]"
                                        />
                                        <input
                                            type="text"
                                            value={header.value}
                                            onChange={(event) => handleHeaderChange(header.id, 'value', event.target.value)}
                                            placeholder="Value"
                                            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-xs font-mono shadow-xs transition-all placeholder:text-muted-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
                                        />
                                        <button
                                            onClick={() => handleRemoveHeader(header.id)}
                                            className="rounded-lg p-1.5 text-muted-foreground/40 transition-all hover:bg-destructive/10 hover:text-destructive"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {(response || error || sending) && (
                <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <div className="flex flex-wrap items-center gap-3 border-b border-border/20 px-4 py-3">
                        <span className="text-xs font-black uppercase tracking-wider text-muted-foreground/60">
                            {t('playground.response')}
                        </span>
                        {sending && (
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-primary animate-pulse">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                {t('common.loading')}
                            </div>
                        )}
                        {response && (
                            <>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        'border-none text-xs font-black',
                                        getStatusColor(response.status_code)
                                    )}
                                >
                                    {response.status_code}
                                </Badge>
                                {elapsed !== null && (
                                    <span className="text-[10px] font-mono text-muted-foreground/50">
                                        {elapsed}ms
                                    </span>
                                )}
                                {response.body && (
                                    <span className="text-[10px] font-mono text-muted-foreground/50">
                                        {formatSize(response.body.length)}
                                        {response.truncated && (
                                            <span className="ml-1 font-black text-amber-500">
                                                (TRUNCATED)
                                            </span>
                                        )}
                                    </span>
                                )}
                                {response.body_decoded && (
                                    <Badge
                                        variant="outline"
                                        className="h-5 border-sky-500/30 bg-sky-500/5 px-1.5 text-[10px] font-bold text-sky-600 dark:text-sky-400"
                                    >
                                        {t('playground.body_decoded', {
                                            encoding: (response.body_decoded_from || 'gzip').toUpperCase(),
                                        })}
                                    </Badge>
                                )}
                                {response.body && (
                                    <ViewToggle value={responseViewMode} onChange={setResponseViewMode} />
                                )}
                                <div className="ml-auto">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => copyToClipboard(response.body, 'resp')}
                                    >
                                        {copiedField === 'resp' ? (
                                            <Check className="h-3.5 w-3.5 text-green-500" />
                                        ) : (
                                            <Copy className="h-3.5 w-3.5 text-muted-foreground/50" />
                                        )}
                                    </Button>
                                </div>
                            </>
                        )}
                    </div>

                    {error && (
                        <div className="border-b border-red-500/10 bg-red-500/5 p-4">
                            <pre className="whitespace-pre-wrap text-xs font-mono text-red-500">{error}</pre>
                        </div>
                    )}

                    {response?.headers && Object.keys(response.headers).length > 0 && (
                        <details className="group">
                            <summary className="cursor-pointer select-none px-4 py-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground/40 transition-colors hover:text-muted-foreground">
                                {t('playground.response_headers')} ({Object.keys(response.headers).length})
                            </summary>
                            <div className="space-y-1 px-4 pb-3 font-mono text-[11px]">
                                {Object.entries(response.headers).map(([key, values]) => (
                                    <div key={key} className="flex flex-col sm:flex-row sm:gap-2">
                                        <span className="shrink-0 font-bold text-green-500/70">{key}:</span>
                                        <div className="flex flex-col">
                                            {values.map((value, index) => (
                                                <span key={index} className="break-all text-foreground/70">
                                                    {value}
                                                    {index < values.length - 1 ? ';' : ''}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <Separator className="bg-border/20" />
                        </details>
                    )}

                    {response?.body && (
                        <div className="custom-scrollbar max-h-[600px] overflow-auto p-4">
                            {responseViewMode === 'raw' ? (
                                <RawBodyViewer text={response.body} />
                            ) : (
                                <JsonViewer data={parsedResponseBody ?? response.body} />
                            )}
                        </div>
                    )}

                    {response && !response.body && !error && (
                        <div className="p-8 text-center text-[11px] italic text-muted-foreground/40">
                            {t('playground.empty_response')}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
