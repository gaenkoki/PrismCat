import { cn, formatDate, formatLatency, formatSize, formatStructuredText, getStatusColor, getMethodColor } from '@/lib/utils'
import { Copy, Check, Zap, AlertTriangle, ChevronDown, ChevronUp, FileCode, ListTree, Globe, Layers, RotateCcw } from 'lucide-react'
import { fetchBlob } from '@/lib/api'
import type { RequestLog } from '@/lib/api'
import { startTransition, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { JsonViewer } from './JsonViewer'
import { mergeStreamBody } from '@/lib/streamMerge'
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface LogDetailProps {
    log: RequestLog | null
    loading?: boolean
    onClose: () => void
}

type BodyViewMode = 'pretty' | 'raw'
type ResponseViewMode = BodyViewMode | 'merged'
type PanelWidthMode = 'standard' | 'wide' | 'full'

const logDetailWidthStorageKey = 'prismcat.logDetail.width'

const defaultExpandedSections = {
    url: true,
    requestHeaders: false,
    requestBody: false,
    responseHeaders: false,
    responseBody: false,
}

function getInitialPanelWidthMode(): PanelWidthMode {
    if (typeof window === 'undefined') return 'standard'

    const stored = window.localStorage.getItem(logDetailWidthStorageKey)
    if (stored === 'wide' || stored === 'full' || stored === 'standard') {
        return stored
    }

    return 'standard'
}

export function LogDetail({ log, loading, onClose }: LogDetailProps) {
    const { t, i18n } = useTranslation()
    const navigate = useNavigate()
    const [copiedField, setCopiedField] = useState<string | null>(null)
    const [fullRequestBody, setFullRequestBody] = useState<string | null>(null)
    const [fullResponseBody, setFullResponseBody] = useState<string | null>(null)
    const [blobLoading, setBlobLoading] = useState<{ request: boolean; response: boolean }>({
        request: false,
        response: false,
    })
    const [blobError, setBlobError] = useState<string | null>(null)
    const [expandedSections, setExpandedSections] = useState(defaultExpandedSections)
    const [requestViewMode, setRequestViewMode] = useState<BodyViewMode>('pretty')
    const [responseViewMode, setResponseViewMode] = useState<ResponseViewMode>('pretty')
    const [panelWidthMode, setPanelWidthMode] = useState<PanelWidthMode>(() => getInitialPanelWidthMode())

    useEffect(() => {
        setFullRequestBody(null)
        setFullResponseBody(null)
        setBlobError(null)
        setBlobLoading({ request: false, response: false })
        setExpandedSections(defaultExpandedSections)
        setRequestViewMode('pretty')
        setResponseViewMode(log?.streaming ? 'raw' : 'pretty')
    }, [log?.id])

    useEffect(() => {
        if (typeof window === 'undefined') return
        window.localStorage.setItem(logDetailWidthStorageKey, panelWidthMode)
    }, [panelWidthMode])

    const effectiveRequestBody = fullRequestBody ?? log?.request_body ?? ''
    const effectiveResponseBody = fullResponseBody ?? log?.response_body ?? ''
    const shouldInspectRequestBody = expandedSections.requestBody && requestViewMode === 'pretty' && Boolean(effectiveRequestBody)
    const shouldInspectResponseBody = expandedSections.responseBody && Boolean(effectiveResponseBody)

    const parsedRequestBody = useMemo(() => {
        if (!shouldInspectRequestBody) return null
        try {
            return JSON.parse(effectiveRequestBody)
        } catch {
            return null
        }
    }, [shouldInspectRequestBody, effectiveRequestBody])

    const parsedResponseBody = useMemo(() => {
        if (!shouldInspectResponseBody || responseViewMode !== 'pretty') return null
        try {
            return JSON.parse(effectiveResponseBody)
        } catch {
            return null
        }
    }, [shouldInspectResponseBody, responseViewMode, effectiveResponseBody])

    const mergedResponse = useMemo(() => {
        if (!shouldInspectResponseBody || !log?.streaming || responseViewMode !== 'merged') return null
        return mergeStreamBody(effectiveResponseBody)
    }, [shouldInspectResponseBody, log?.streaming, responseViewMode, effectiveResponseBody])


    const copyToClipboard = async (text: string, field: string) => {
        await navigator.clipboard.writeText(text)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const toggleSection = (section: keyof typeof expandedSections) => {
        setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
    }

    const loadBlob = async (kind: 'request' | 'response', ref: string) => {
        setBlobError(null)
        setBlobLoading(prev => ({ ...prev, [kind]: true }))
        try {
            const body = await fetchBlob(ref)
            startTransition(() => {
                if (kind === 'request') setFullRequestBody(body)
                else setFullResponseBody(body)
            })
        } catch (err: any) {
            setBlobError(err?.message || 'Failed to load blob')
        } finally {
            setBlobLoading(prev => ({ ...prev, [kind]: false }))
        }
    }

    if (!log) return null

    const panelWidthOptions: Array<{ value: PanelWidthMode; label: string }> = [
        { value: 'standard', label: t('log_detail.layout_standard', 'Standard') },
        { value: 'wide', label: t('log_detail.layout_wide', 'Wide') },
        { value: 'full', label: t('log_detail.layout_full', 'Full') },
    ]

    const sheetWidthClassName = cn(
        "w-full p-0 flex flex-col bg-background shadow-2xl",
        panelWidthMode === 'standard' && "border-l border-border/60 sm:rounded-l-2xl sm:max-w-4xl",
        panelWidthMode === 'wide' && "border-l border-border/60 sm:rounded-l-2xl sm:max-w-6xl",
        panelWidthMode === 'full' && "border-0 sm:rounded-none sm:max-w-none"
    )
    const sectionCardClassName = "rounded-2xl border border-border/60 bg-card p-5 shadow-sm"
    const contentCardClassName = "rounded-xl border border-border/60 bg-background p-4 shadow-xs"
    const codeCardClassName = "rounded-xl border border-border/60 bg-background shadow-xs"
    const emptyStateClassName = "rounded-xl border border-dashed border-border/50 bg-muted/50 px-4 py-6 text-center"

    const CopyButton = ({ text, field }: { text: string; field: string }) => (
        <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
                e.stopPropagation()
                copyToClipboard(text, field)
            }}
            className="h-7 w-7 rounded-md hover:bg-primary/10 hover:text-primary transition-all"
            title={t('common.copy', '复制')}
        >
            {copiedField === field ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
                <Copy className="h-3.5 w-3.5 text-muted-foreground/50" />
            )}
        </Button>
    )

    const RawBodyViewer = ({ text }: { text: string }) => (
        <pre className="whitespace-pre-wrap break-all text-[11px] font-mono leading-relaxed text-foreground select-text">
            {text}
        </pre>
    )

    const ViewToggle = ({
        value,
        options,
        onChange,
    }: {
        value: string
        options: Array<{ value: string; label: string }>
        onChange: (value: string) => void
    }) => (
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-muted p-1">
            {options.map((option) => (
                <Button
                    key={option.value}
                    type="button"
                    variant={value === option.value ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={() => onChange(option.value)}
                    className={cn(
                        "h-6 rounded-md px-2 text-[10px] font-bold uppercase tracking-wider transition-all",
                        value === option.value
                            ? "border border-border/70 bg-background text-foreground shadow-sm hover:bg-background"
                            : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                    )}
                >
                    {option.label}
                </Button>
            ))}
        </div>
    )

    const SectionHeader = ({
        title,
        section,
        icon: Icon,
        extra,
    }: {
        title: string
        section: keyof typeof defaultExpandedSections
        icon: ComponentType<{ className?: string }>
        extra?: ReactNode
    }) => (
        <div className="flex items-center justify-between gap-3 py-2.5">
            <button
                type="button"
                onClick={() => toggleSection(section)}
                className="group -mx-1 flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-0.5 text-left transition-colors"
            >
                <div className={cn(
                    "rounded-md p-1.5 transition-colors",
                    expandedSections[section]
                        ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                        : "bg-muted text-muted-foreground group-hover:bg-secondary"
                )}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-foreground group-hover:text-primary transition-colors">
                    {title}
                </span>
                {expandedSections[section] ? (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground/70" />
                ) : (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                )}
            </button>
            {extra ? <div className="shrink-0">{extra}</div> : null}
        </div>
    )

    return (
        <Sheet open={!!log} onOpenChange={(open) => !open && onClose()}>
            <SheetContent className={sheetWidthClassName}>
                {/* 头部固定区域 */}
                <SheetHeader className="border-b border-border/60 bg-card px-6 py-5">
                    <div className="flex flex-wrap items-center gap-3">
                        <div
                            className={cn(
                                "w-14 py-0.5 rounded-[3px] text-[10px] text-center uppercase font-bold border",
                                getMethodColor(log.method)
                            )}
                        >
                            {log.method}
                        </div>
                        <SheetTitle className={cn(
                            "font-mono text-xl font-black tracking-tighter",
                            getStatusColor(log.status_code)
                        )}>
                            {log.status_code || '---'}
                        </SheetTitle>
                        {log.streaming && (
                            <Badge variant="secondary" className="border-none bg-primary/10 text-primary font-bold text-[10px] animate-pulse">
                                <Zap className="mr-1 h-3 w-3 fill-current" />
                                {t('log_detail.streaming', 'STREAMING')}
                            </Badge>
                        )}
                        {log.error && (
                            <Badge variant="destructive" className="border-none bg-red-500/10 text-red-500 font-bold text-[10px]">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                {t('common.error', 'ERROR')}
                            </Badge>
                        )}
                        {loading && (
                            <div className="ml-auto flex items-center gap-2 text-[10px] font-black uppercase text-primary animate-pulse">
                                <div className="h-1 w-1 rounded-full bg-current" />
                                {t('common.loading')}
                            </div>
                        )}
                        {!loading && (
                            <div className="ml-auto mr-10 flex flex-wrap items-center justify-end gap-2">
                                <div className="hidden items-center sm:flex">
                                    <ViewToggle
                                        value={panelWidthMode}
                                        options={panelWidthOptions}
                                        onChange={(value) => setPanelWidthMode(value as PanelWidthMode)}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 gap-1.5 border-primary/20 bg-primary/5 px-2.5 text-[11px] font-semibold shadow-sm transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                                    onClick={async () => {
                                        const navigateToPlayground = (body: string) => {
                                            const { formatted } = formatStructuredText(body)
                                            onClose()
                                            navigate('/playground', {
                                                state: {
                                                    replay: {
                                                        upstream: log.upstream,
                                                        method: log.method,
                                                        path: log.path + (log.query ? '?' + log.query : ''),
                                                        headers: log.request_headers,
                                                        body: formatted,
                                                    },
                                                },
                                            })
                                        }

                                        // If blob ref exists and not yet loaded, fetch full body first
                                        if (log.request_body_ref && !fullRequestBody) {
                                            try {
                                                const full = await fetchBlob(log.request_body_ref)
                                                navigateToPlayground(full)
                                            } catch {
                                                // Fallback to preview if blob fetch fails
                                                navigateToPlayground(effectiveRequestBody)
                                            }
                                        } else {
                                            navigateToPlayground(effectiveRequestBody)
                                        }
                                    }}
                                >
                                    <RotateCcw className="h-3 w-3" />
                                    {t('playground.replay')}
                                </Button>
                            </div>
                        )}
                    </div>
                </SheetHeader>

                {/* 主内容区域 */}
                <div className="custom-scrollbar flex-1 space-y-6 overflow-y-auto bg-muted/30 px-6 py-6">
                    {/* 基本信息网格 */}
                    <div className="grid grid-cols-2 gap-6 rounded-2xl border border-border/60 bg-card p-5 shadow-sm sm:grid-cols-4">
                        {[
                            { label: t('log_table.upstream'), value: log.upstream, mono: false },
                            { label: t('log_table.latency'), value: formatLatency(log.latency_ms), mono: true },
                            { label: t('log_table.time'), value: formatDate(log.created_at, i18n.language), mono: false },
                            { label: 'ID', value: log.id.substring(0, 8) + '...', mono: true, full: log.id }
                        ].map((item, idx) => (
                            <div key={idx} className="space-y-1">
                                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">{item.label}</div>
                                <div className={cn(
                                    "text-sm font-bold truncate text-foreground",
                                    item.mono ? "font-mono" : ""
                                )} title={item.full}>
                                    {item.value}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* URL 地址 */}
                    <div className={sectionCardClassName}>
                        <SectionHeader title={t('log_detail.url')} section="url" icon={Globe} />
                        {expandedSections.url && (
                            <div className={cn(contentCardClassName, "group flex items-center gap-2 transition-colors hover:border-primary/30")}>
                                <code className="flex-1 text-xs font-mono break-all leading-relaxed text-foreground">{log.target_url}</code>
                                <CopyButton text={log.target_url} field="url" />
                            </div>
                        )}
                    </div>

                    {/* 错误详情 */}
                    {log.error && (
                        <div className="overflow-hidden rounded-2xl border border-red-500/20 bg-red-500/5 p-4 shadow-sm">
                            <div className="mb-3 flex items-center gap-2 text-red-500 font-bold text-xs uppercase tracking-wider">
                                <AlertTriangle className="h-4 w-4" />
                                {t('common.error')}
                            </div>
                            <pre className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap leading-relaxed">{log.error}</pre>
                        </div>
                    )}

                    {/* 请求头 & 请求体 */}
                    <div className={cn(sectionCardClassName, "space-y-4")}>
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">
                            {t('log_detail.request')}
                        </div>
                        <div className="space-y-2">
                            <SectionHeader
                                title={t('log_detail.request') + ' ' + t('log_detail.headers')}
                                section="requestHeaders"
                                icon={ListTree}
                                extra={<span className="text-xs font-bold text-muted-foreground/70">{Object.keys(log.request_headers ?? {}).length} KEYS</span>}
                            />
                            {expandedSections.requestHeaders && log.request_headers && (
                                <div className={cn(contentCardClassName, "space-y-2 font-mono text-[11px] leading-relaxed")}>
                                    {Object.entries(log.request_headers).map(([key, vv]) => (
                                        <div key={key} className="flex flex-col sm:flex-row sm:gap-2 group/line">
                                            <span className="text-primary/80 shrink-0 font-bold">{key}:</span>
                                            <div className="flex flex-col">
                                                {vv.map((v, i) => (
                                                    <span key={i} className="text-foreground/85 break-all select-text">{v}{i < vv.length - 1 ? ';' : ''}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <SectionHeader
                                title={t('log_detail.request') + ' ' + t('log_detail.body')}
                                section="requestBody"
                                icon={FileCode}
                                extra={
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-muted-foreground/70">{formatSize(log.request_body_size)}</span>
                                        {effectiveRequestBody && (
                                            <ViewToggle
                                                value={requestViewMode}
                                                options={[
                                                    { value: 'pretty', label: t('log_detail.view_pretty', 'Pretty') },
                                                    { value: 'raw', label: t('log_detail.view_raw', 'Raw') },
                                                ]}
                                                onChange={(value) => setRequestViewMode(value as BodyViewMode)}
                                            />
                                        )}
                                        {log.request_body_ref && (
                                            <Badge variant="outline" className="h-5 text-[10px] border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 px-1.5 font-bold">
                                                {t('log_detail.detached_tag', 'DETACHED')}
                                            </Badge>
                                        )}
                                        {log.truncated && (
                                            <Badge variant="outline" className="h-5 text-[10px] border-yellow-500/40 text-yellow-600 dark:text-yellow-500 bg-yellow-500/5 px-1.5 font-bold">
                                                {t('log_detail.truncated_tag', 'TRUNCATED')}
                                            </Badge>
                                        )}
                                    </div>
                                }
                            />
                            {expandedSections.requestBody && (
                                <div className="space-y-3">
                                    {log.request_body_ref && (
                                        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                    {fullRequestBody ? t('log_detail.blob_loaded') : t('log_detail.blob_detached')}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {fullRequestBody ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setFullRequestBody(null)}
                                                            className="h-7 px-2 text-[11px] font-bold"
                                                        >
                                                            {t('log_detail.use_preview')}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => loadBlob('request', log.request_body_ref!)}
                                                            disabled={blobLoading.request}
                                                            className="h-7 border-indigo-500/30 px-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400"
                                                        >
                                                            {blobLoading.request ? t('common.loading') : t('log_detail.load_full')}
                                                        </Button>
                                                    )}
                                                    <a
                                                        href={`/api/blobs/${encodeURIComponent(log.request_body_ref)}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 underline decoration-indigo-500/30 underline-offset-4"
                                                    >
                                                        {t('log_detail.open_raw')}
                                                    </a>
                                                </div>
                                            </div>
                                            <code className="block mt-2 text-[11px] font-mono break-all text-muted-foreground">
                                                {log.request_body_ref}
                                            </code>
                                            {blobError && (
                                                <div className="mt-2 text-[11px] text-red-500/80 font-mono">
                                                    {blobError}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="relative group">
                                        {effectiveRequestBody ? (
                                            <div className={cn(codeCardClassName, "custom-scrollbar relative max-h-[500px] overflow-x-auto overflow-y-auto p-4")}>
                                                {requestViewMode === 'raw' ? (
                                                    <RawBodyViewer text={effectiveRequestBody} />
                                                ) : (
                                                    <JsonViewer data={parsedRequestBody ?? effectiveRequestBody} />
                                                )}
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <CopyButton text={effectiveRequestBody} field="requestBody" />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={cn(emptyStateClassName, "text-[11px] italic text-muted-foreground/50")}>
                                                {loading ? t('common.loading') : t('log_detail.no_body', '--- EMPTY BODY ---')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 响应头 & 响应体 */}
                    <div className={cn(sectionCardClassName, "space-y-4")}>
                        <div className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground/70">
                            {t('log_detail.response')}
                        </div>
                        <div className="space-y-2">
                            <SectionHeader
                                title={t('log_detail.response') + ' ' + t('log_detail.headers')}
                                section="responseHeaders"
                                icon={ListTree}
                                extra={<span className="text-xs font-bold text-muted-foreground/70">{Object.keys(log.response_headers ?? {}).length} KEYS</span>}
                            />
                            {expandedSections.responseHeaders && log.response_headers && (
                                <div className={cn(contentCardClassName, "space-y-2 font-mono text-[11px] leading-relaxed")}>
                                    {Object.entries(log.response_headers).map(([key, vv]) => (
                                        <div key={key} className="flex flex-col sm:flex-row sm:gap-2 group/line">
                                            <span className="text-green-600/80 shrink-0 font-bold">{key}:</span>
                                            <div className="flex flex-col">
                                                {vv.map((v, i) => (
                                                    <span key={i} className="text-foreground/85 break-all select-text">{v}{i < vv.length - 1 ? ';' : ''}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="space-y-2">
                            <SectionHeader
                                title={t('log_detail.response') + ' ' + t('log_detail.body')}
                                section="responseBody"
                                icon={FileCode}
                                extra={
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-muted-foreground/70">{formatSize(log.response_body_size)}</span>
                                        {effectiveResponseBody && (
                                            <ViewToggle
                                                value={responseViewMode}
                                                options={log.streaming
                                                    ? [
                                                        { value: 'raw', label: t('log_detail.view_raw', 'Raw') },
                                                        { value: 'merged', label: t('log_detail.stream_merged', 'Merged') },
                                                    ]
                                                    : [
                                                        { value: 'pretty', label: t('log_detail.view_pretty', 'Pretty') },
                                                        { value: 'raw', label: t('log_detail.view_raw', 'Raw') },
                                                    ]}
                                                onChange={(value) => setResponseViewMode(value as ResponseViewMode)}
                                            />
                                        )}
                                        {log.response_body_ref && (
                                            <Badge variant="outline" className="h-5 text-[10px] border-indigo-500/40 text-indigo-600 dark:text-indigo-400 bg-indigo-500/5 px-1.5 font-bold">
                                                {t('log_detail.detached_tag', 'DETACHED')}
                                            </Badge>
                                        )}
                                        {log.truncated && (
                                            <Badge variant="outline" className="h-5 text-[10px] border-yellow-500/40 text-yellow-600 dark:text-yellow-500 bg-yellow-500/5 px-1.5 font-bold">
                                                {t('log_detail.truncated_tag', 'TRUNCATED')}
                                            </Badge>
                                        )}
                                    </div>
                                }
                            />
                            {expandedSections.responseBody && (
                                <div className="space-y-3">
                                    {/* 流式合并说明 */}
                                    {log.streaming && responseViewMode === 'merged' && mergedResponse && (
                                        <div className="flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
                                            <Layers className="h-3.5 w-3.5 text-primary" />
                                            <span className="text-[10px] font-mono text-muted-foreground/70">
                                                {t('log_detail.stream_merge_info', { count: mergedResponse.chunks })}
                                                {' · '}
                                                {t('log_detail.stream_merge_format', { format: mergedResponse.format.toUpperCase() })}
                                                {' · '}
                                                {t('log_detail.stream_merge_protocol', { protocol: mergedResponse.protocol.toUpperCase() })}
                                            </span>
                                        </div>
                                    )}

                                    {log.response_body_ref && (
                                        <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                    {fullResponseBody ? t('log_detail.blob_loaded') : t('log_detail.blob_detached')}
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {fullResponseBody ? (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setFullResponseBody(null)}
                                                            className="h-7 px-2 text-[11px] font-bold"
                                                        >
                                                            {t('log_detail.use_preview')}
                                                        </Button>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => loadBlob('response', log.response_body_ref!)}
                                                            disabled={blobLoading.response}
                                                            className="h-7 border-indigo-500/30 px-2 text-[11px] font-bold text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400"
                                                        >
                                                            {blobLoading.response ? t('common.loading') : t('log_detail.load_full')}
                                                        </Button>
                                                    )}
                                                    <a
                                                        href={`/api/blobs/${encodeURIComponent(log.response_body_ref)}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 underline decoration-indigo-500/30 underline-offset-4"
                                                    >
                                                        {t('log_detail.open_raw')}
                                                    </a>
                                                </div>
                                            </div>
                                            <code className="block mt-2 text-[11px] font-mono break-all text-muted-foreground">
                                                {log.response_body_ref}
                                            </code>
                                            {blobError && (
                                                <div className="mt-2 text-[11px] text-red-500/80 font-mono">
                                                    {blobError}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className="relative group">
                                        {effectiveResponseBody ? (
                                            <div className={cn(codeCardClassName, "custom-scrollbar relative max-h-[500px] overflow-x-auto overflow-y-auto p-4")}>
                                                {responseViewMode === 'raw' ? (
                                                    <RawBodyViewer text={effectiveResponseBody} />
                                                ) : responseViewMode === 'merged' ? (
                                                    mergedResponse ? (
                                                        <JsonViewer data={mergedResponse.merged} />
                                                    ) : (
                                                        <div className={cn(emptyStateClassName, "text-[11px] italic text-muted-foreground/70")}>
                                                            {t('log_detail.stream_merge_unavailable', '当前无法生成合并视图，请切换到 Raw 查看原始内容。')}
                                                        </div>
                                                    )
                                                ) : (
                                                    <JsonViewer data={parsedResponseBody ?? effectiveResponseBody} />
                                                )}
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                                    <CopyButton
                                                        text={
                                                            responseViewMode === 'merged' && mergedResponse
                                                                ? JSON.stringify(mergedResponse.merged, null, 2)
                                                                : effectiveResponseBody
                                                        }
                                                        field="responseBody"
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className={cn(emptyStateClassName, "text-[11px] italic text-muted-foreground/60")}>
                                                {loading ? t('common.loading') : t('log_detail.no_body', '--- EMPTY BODY ---')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    )
}


