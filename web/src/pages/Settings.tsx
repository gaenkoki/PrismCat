import {
    useEffect,
    useState,
    useCallback,
    useMemo,
    useId,
    type FormEvent,
    type ReactNode,
} from 'react'
import {
    Plus,
    Trash2,
    Save,
    Upload,
    Copy,
    CircleHelp,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { fetchUpstreams, addUpstream, removeUpstream, fetchConfig, updateConfig } from '@/lib/api'
import type { Upstream, AppConfig } from '@/lib/api'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

type FieldBlockProps = {
    label: string
    hint?: string
    htmlFor?: string
    unit?: string
    children: ReactNode
}

type ToggleSettingProps = {
    label: string
    description: string
    checked: boolean
    onCheckedChange: (checked: boolean) => void
}


function InfoTooltip({ content }: { content: string }) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/85 transition-colors hover:text-foreground"
                    aria-label="More info"
                >
                    <CircleHelp className="h-3.5 w-3.5" />
                </button>
            </TooltipTrigger>
            <TooltipContent sideOffset={6} className="max-w-xs px-3 py-2 text-[12px] leading-6">
                {content}
            </TooltipContent>
        </Tooltip>
    )
}

function FieldBlock({ label, hint, htmlFor, unit, children }: FieldBlockProps) {
    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
                <Label
                    htmlFor={htmlFor}
                    className="cursor-pointer select-none text-sm font-medium text-foreground hover:text-foreground/90 transition-colors"
                >
                    {label}
                </Label>
                {hint && <InfoTooltip content={hint} />}
                {unit && (
                    <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        {unit}
                    </span>
                )}
            </div>
            {children}
        </div>
    )
}

function ToggleSetting({
    label,
    description,
    checked,
    onCheckedChange,
}: ToggleSettingProps) {
    const id = useId()
    return (
        <div className="flex items-center gap-3">
            <Switch
                id={id}
                checked={checked}
                onCheckedChange={onCheckedChange}
                className="shrink-0 data-[state=unchecked]:bg-border/60"
            />
            <div className="flex items-center gap-1.5">
                <Label
                    htmlFor={id}
                    className="cursor-pointer select-none text-sm font-medium text-foreground hover:text-foreground transition-colors"
                >
                    {label}
                </Label>
                <InfoTooltip content={description} />
            </div>
        </div>
    )
}


export function Settings() {
    const { t } = useTranslation()
    const [upstreams, setUpstreams] = useState<Upstream[]>([])
    const [config, setConfig] = useState<AppConfig | null>(null)
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)
    const [activeTab, setActiveTab] = useState<'routing' | 'logging'>('routing')

    const [newName, setNewName] = useState('')
    const [newTarget, setNewTarget] = useState('')
    const [newTimeout, setNewTimeout] = useState(30)

    const [enablePathRouting, setEnablePathRouting] = useState(false)
    const [pathRoutingPrefix, setPathRoutingPrefix] = useState('/_proxy')

    const [maxRequestBody, setMaxRequestBody] = useState(1)
    const [maxResponseBody, setMaxResponseBody] = useState(10)
    const [sensitiveHeaders, setSensitiveHeaders] = useState('')
    const [detachBodyOver, setDetachBodyOver] = useState(256)
    const [bodyPreview, setBodyPreview] = useState(4096)
    const [storeBase64, setStoreBase64] = useState(true)
    const [earlyRequestBodySnapshot, setEarlyRequestBodySnapshot] = useState(true)

    const [retentionDays, setRetentionDays] = useState(30)

    const domainSuffix = config?.server?.proxy_domains?.[0] || 'localhost'
    const previewUpstreamName = upstreams[0]?.name || 'openai'

    const proxyBase = useMemo(() => {
        const proto = window.location.protocol
        const hostname = window.location.hostname
        const port = window.location.port
        const portSuffix = port && port !== '80' && port !== '443' ? `:${port}` : ''
        return { proto, hostname, portSuffix }
    }, [])

    const getProxyUrl = useCallback((name: string) => {
        return `${proxyBase.proto}//${name}.${domainSuffix}${proxyBase.portSuffix}`
    }, [proxyBase, domainSuffix])

    const getPathProxyUrl = useCallback((name: string) => {
        const trimmedPrefix = pathRoutingPrefix.trim()
        let normalizedPrefix = trimmedPrefix || '/_proxy'
        if (!normalizedPrefix.startsWith('/')) {
            normalizedPrefix = `/${normalizedPrefix}`
        }
        normalizedPrefix = normalizedPrefix.replace(/\/+$/, '') || '/_proxy'
        return `${proxyBase.proto}//${proxyBase.hostname}${proxyBase.portSuffix}${normalizedPrefix}/${name}`
    }, [pathRoutingPrefix, proxyBase])

    const handleCopy = useCallback((value: string) => {
        navigator.clipboard.writeText(value)
        toast.success(t('log_detail.copy_success'))
    }, [t])

    const loadData = useCallback(async () => {
        setLoading(true)
        try {
            const [upstreamsData, configData] = await Promise.all([
                fetchUpstreams(),
                fetchConfig(),
            ])
            setUpstreams(upstreamsData || [])
            setConfig(configData)
            setShowAddForm(prev => prev || !upstreamsData?.length)

            setMaxRequestBody(Math.round(configData.logging.max_request_body / 1024))
            setMaxResponseBody(Math.round(configData.logging.max_response_body / 1024))
            setSensitiveHeaders(configData.logging.sensitive_headers.join('\n'))
            setDetachBodyOver(Math.round(configData.logging.detach_body_over_bytes / 1024))
            setBodyPreview(Math.round(configData.logging.body_preview_bytes / 1024))
            setStoreBase64(configData.logging.store_base64)
            setEarlyRequestBodySnapshot(configData.logging.early_request_body_snapshot)
            setRetentionDays(configData.storage.retention_days)
            setEnablePathRouting(configData.server.enable_path_routing)
            setPathRoutingPrefix(configData.server.path_routing_prefix || '/_proxy')
        } catch (err) {
            console.error('Failed to load settings:', err)
            toast.error(t('common.error'))
        } finally {
            setLoading(false)
        }
    }, [t])

    useEffect(() => {
        loadData()
    }, [loadData])

    const handleAddUpstream = async (e: FormEvent) => {
        e.preventDefault()
        try {
            await addUpstream(newName, newTarget, newTimeout)
            setNewName('')
            setNewTarget('')
            setNewTimeout(30)
            setShowAddForm(false)
            loadData()
            toast.success(t('settings.upstream_added'))
        } catch (err: any) {
            toast.error(err.message || t('common.error'))
        }
    }

    const handleRemoveUpstream = async (name: string) => {
        if (!confirm(t('upstream_manager.confirm_delete', { name }))) return
        try {
            await removeUpstream(name)
            loadData()
            toast.success(t('settings.upstream_removed'))
        } catch (err: any) {
            toast.error(err.message || t('common.error'))
        }
    }

    const handleSaveAll = async () => {
        setSaving(true)
        try {
            await updateConfig({
                server: {
                    enable_path_routing: enablePathRouting,
                    path_routing_prefix: pathRoutingPrefix,
                },
                logging: {
                    max_request_body: maxRequestBody * 1024,
                    max_response_body: maxResponseBody * 1024,
                    sensitive_headers: sensitiveHeaders.split('\n').map(s => s.trim()).filter(Boolean),
                    detach_body_over_bytes: detachBodyOver * 1024,
                    body_preview_bytes: bodyPreview * 1024,
                    store_base64: storeBase64,
                    early_request_body_snapshot: earlyRequestBodySnapshot,
                },
                storage: {
                    retention_days: retentionDays,
                },
            })
            toast.success(t('settings.config_saved'))
            loadData()
        } catch (err: any) {
            toast.error(err.message || t('common.error'))
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-96 flex-col items-center justify-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <div className="text-sm font-medium text-muted-foreground">
                    {t('common.loading')}
                </div>
            </div>
        )
    }

    return (
        <div className="w-full">

            <div className="flex w-full justify-center">
                <div className="relative z-10 w-full space-y-10 pb-20 px-4 sm:px-10 pt-6 animate-fade-in">

                    {/* Header & Tabs */}
                    <div className="flex items-center gap-2 border-b border-border/40 pb-5">

                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setActiveTab('routing')}
                                className={cn(
                                    "px-5 py-2.5 rounded-xl text-base font-medium transition-all duration-200",
                                    activeTab === 'routing'
                                        ? "bg-primary/10 text-primary shadow-sm"
                                        : "text-foreground/85 hover:bg-muted/50 hover:text-foreground"
                                )}
                            >
                                {t('settings.tabs.upstreams')}
                            </button>
                            <button
                                onClick={() => setActiveTab('logging')}
                                className={cn(
                                    "px-5 py-2.5 rounded-xl text-base font-medium transition-all duration-200",
                                    activeTab === 'logging'
                                        ? "bg-primary/10 text-primary shadow-sm"
                                        : "text-foreground/70 hover:bg-muted/50 hover:text-foreground"
                                )}
                            >
                                {t('settings.tabs.logging')}
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="pt-2">
                        {activeTab === 'routing' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none motion-reduce:duration-0">
                                {/* Action Toolbar */}
                                <section className="flex flex-col gap-6">
                                    <div className="flex flex-wrap items-end gap-x-8 gap-y-6">
                                        <div className="w-[240px]">
                                            <FieldBlock
                                                label={t('settings.proxy_domain_suffix')}
                                                hint={t('settings.proxy_domain_suffix_hint', {
                                                    name: previewUpstreamName,
                                                    suffix: domainSuffix,
                                                })}
                                            >
                                                <Input
                                                    value={`.${domainSuffix}`}
                                                    readOnly
                                                    className="h-11 rounded-xl border-border/30 bg-background/40 text-sm font-medium shadow-sm transition-colors cursor-default"
                                                />
                                            </FieldBlock>
                                        </div>

                                        <div className="w-[240px]">
                                            <FieldBlock
                                                label={t('settings.path_routing_prefix')}
                                                htmlFor="path-routing-prefix"
                                                hint={t('settings.path_routing_prefix_hint')}
                                            >
                                                <Input
                                                    id="path-routing-prefix"
                                                    value={pathRoutingPrefix}
                                                    onChange={e => setPathRoutingPrefix(e.target.value)}
                                                    placeholder="/_proxy"
                                                    className="h-11 rounded-xl border-border/30 bg-background/50 text-sm shadow-sm transition-colors focus-visible:bg-background"
                                                />
                                            </FieldBlock>
                                        </div>

                                        <div className="h-11 flex items-center">
                                            <ToggleSetting
                                                label={t('settings.enable_path_routing')}
                                                description={t('settings.enable_path_routing_hint')}
                                                checked={enablePathRouting}
                                                onCheckedChange={setEnablePathRouting}
                                            />
                                        </div>

                                        <div className="h-11 flex items-center gap-3 sm:ml-auto">
                                            <Button
                                                type="button"
                                                onClick={handleSaveAll}
                                                disabled={saving}
                                                variant="default"
                                                size="lg"
                                                className="h-11 rounded-xl min-w-[120px] font-medium shadow-sm transition-all whitespace-nowrap shrink-0"
                                            >
                                                <Save className="mr-1.5 h-4 w-4 shrink-0" />
                                                {t('common.save')}
                                            </Button>
                                            <Button
                                                type="button"
                                                variant={showAddForm ? 'secondary' : 'default'}
                                                onClick={() => setShowAddForm(prev => !prev)}
                                                size="lg"
                                                className="h-11 rounded-xl min-w-[140px] font-medium shadow-sm transition-all whitespace-nowrap shrink-0"
                                            >
                                                {!showAddForm && <Plus className="mr-1.5 h-4 w-4 shrink-0" />}
                                                {showAddForm ? t('common.cancel') : t('upstream_manager.add_new')}
                                            </Button>
                                        </div>
                                    </div>
                                </section>

                                {/* Upstreams List Area */}
                                <section className="flex flex-col gap-6 pt-2">
                                    <div className="w-full">
                                        {showAddForm && (
                                            <div className="mb-8 rounded-2xl bg-background/40 p-6 ring-1 ring-border/20 backdrop-blur-sm w-fit">
                                                <form onSubmit={handleAddUpstream} className="flex flex-wrap items-end gap-6">
                                                    <div className="w-[240px]">
                                                        <FieldBlock label={t('upstream_manager.name')} htmlFor="name">
                                                            <div className="relative">
                                                                <Input
                                                                    id="name"
                                                                    value={newName}
                                                                    onChange={e => setNewName(e.target.value)}
                                                                    placeholder="openai"
                                                                    className="h-11 rounded-xl border-border/30 bg-background/80 pr-20 text-sm shadow-sm transition-colors focus-visible:bg-background"
                                                                    required
                                                                />
                                                                <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-xs text-muted-foreground">
                                                                    .{domainSuffix}
                                                                </div>
                                                            </div>
                                                        </FieldBlock>
                                                    </div>

                                                    <div className="w-[320px] max-w-full">
                                                        <FieldBlock label={t('upstream_manager.target')} htmlFor="target">
                                                            <Input
                                                                id="target"
                                                                value={newTarget}
                                                                onChange={e => setNewTarget(e.target.value)}
                                                                placeholder="https://api.openai.com"
                                                                className="h-11 rounded-xl border-border/30 bg-background/80 font-mono text-sm shadow-sm transition-colors focus-visible:bg-background"
                                                                required
                                                            />
                                                        </FieldBlock>
                                                    </div>

                                                    <div className="w-[120px]">
                                                        <FieldBlock label={t('upstream_manager.timeout')} htmlFor="timeout">
                                                            <Input
                                                                id="timeout"
                                                                type="number"
                                                                min="1"
                                                                value={newTimeout}
                                                                onChange={e => setNewTimeout(Number(e.target.value))}
                                                                className="h-11 rounded-xl border-border/30 bg-background/80 text-sm shadow-sm transition-colors focus-visible:bg-background"
                                                            />
                                                        </FieldBlock>
                                                    </div>

                                                    <div className="flex h-11 items-center">
                                                        <Button type="submit" variant="default" size="lg" className="h-11 rounded-xl min-w-[120px] font-medium shadow-sm whitespace-nowrap shrink-0">
                                                            <Save className="mr-1.5 h-4 w-4 shrink-0" />
                                                            {t('common.save')}
                                                        </Button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}

                                        {upstreams.length === 0 ? (
                                            <div className="rounded-3xl border border-dashed border-border/60 bg-muted/10 px-6 py-20 text-center">
                                                <Upload className="mx-auto mb-4 h-10 w-10 text-muted-foreground/30" />
                                                <p className="text-sm text-foreground/75">
                                                    {t('upstream_manager.no_upstreams')}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="space-y-0">
                                                <div className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_120px_100px] gap-6 border-b border-border/40 pb-3 px-2 lg:grid">
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground/65">{t('upstream_manager.name')}</span>
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground/65">{t('upstream_manager.target')}</span>
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground/65">{t('upstream_manager.timeout')}</span>
                                                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground/65">{t('upstream_manager.actions')}</span>
                                                </div>

                                                <div className="divide-y divide-border/20">
                                                    {upstreams.map(upstream => (
                                                        <div
                                                            key={upstream.name}
                                                            className="group grid gap-5 py-5 px-2 transition-colors hover:bg-muted/20 rounded-xl lg:-mx-2 lg:px-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_120px_100px] lg:items-start lg:gap-6"
                                                        >
                                                            <div className="min-w-0 space-y-3">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="text-base font-semibold text-foreground">
                                                                        {upstream.name}
                                                                    </span>
                                                                    <Badge variant="outline" className="rounded-full border-border/40 bg-background/50 px-2 py-0.5 text-[11px] font-medium text-foreground/80">
                                                                        .{domainSuffix}
                                                                    </Badge>
                                                                </div>

                                                                <div className="space-y-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleCopy(getProxyUrl(upstream.name))}
                                                                        className="flex items-start gap-2 text-left text-[13px] leading-relaxed text-primary/80 transition-colors hover:text-primary"
                                                                    >
                                                                        <Copy className="mt-1 h-3.5 w-3.5 shrink-0" />
                                                                        <span className="break-all font-mono">{getProxyUrl(upstream.name)}</span>
                                                                    </button>

                                                                    {enablePathRouting && (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => handleCopy(getPathProxyUrl(upstream.name))}
                                                                            className="flex items-start gap-2 text-left text-[13px] leading-relaxed text-emerald-600/80 transition-colors hover:text-emerald-600 dark:text-emerald-400/80 dark:hover:text-emerald-400"
                                                                        >
                                                                            <Copy className="mt-1 h-3.5 w-3.5 shrink-0" />
                                                                            <span className="break-all font-mono">{getPathProxyUrl(upstream.name)}</span>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </div>

                                                            <div className="min-w-0">
                                                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground/60 lg:hidden">
                                                                    {t('upstream_manager.target')}
                                                                </p>
                                                                <div className="text-[13px] leading-relaxed">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleCopy(upstream.target)}
                                                                        className="flex items-start gap-2 text-left text-foreground/80 transition-colors hover:text-primary dark:hover:text-primary-foreground group/target"
                                                                    >
                                                                        <Copy className="mt-1 h-3.5 w-3.5 shrink-0 opacity-40 group-hover/target:opacity-100 transition-opacity" />
                                                                        <span className="break-all font-mono">{upstream.target}</span>
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground/50 lg:hidden">
                                                                    {t('upstream_manager.timeout')}
                                                                </p>
                                                                <div className="text-[13px] font-medium text-foreground/80">
                                                                    {upstream.timeout}s
                                                                </div>
                                                            </div>

                                                            <div className="lg:justify-self-start opacity-100 lg:opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => handleRemoveUpstream(upstream.name)}
                                                                    className="h-8 rounded-lg px-2.5 text-foreground/65 hover:bg-destructive/10 hover:text-destructive"
                                                                >
                                                                    <Trash2 className="h-4 w-4 mr-1.5" />
                                                                    {t('common.delete')}
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </section>
                            </div>
                        )}

                        {activeTab === 'logging' && (
                            <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-300 motion-reduce:animate-none motion-reduce:duration-0">
                                <div className="max-w-3xl space-y-10">
                                    
                                    {/* 表单项网格 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-8">
                                        <FieldBlock
                                            label={t('settings.max_request_body')}
                                            hint={t('settings.max_request_body_hint')}
                                            htmlFor="max-req"
                                            unit="KB"
                                        >
                                            <Input
                                                id="max-req"
                                                type="number"
                                                min="1"
                                                value={maxRequestBody}
                                                onChange={e => setMaxRequestBody(Number(e.target.value))}
                                                className="h-11 rounded-xl border-border/30 bg-background/50 text-sm shadow-sm transition-colors focus-visible:bg-background"
                                            />
                                        </FieldBlock>

                                        <FieldBlock
                                            label={t('settings.max_response_body')}
                                            hint={t('settings.max_response_body_hint')}
                                            htmlFor="max-res"
                                            unit="KB"
                                        >
                                            <Input
                                                id="max-res"
                                                type="number"
                                                min="1"
                                                value={maxResponseBody}
                                                onChange={e => setMaxResponseBody(Number(e.target.value))}
                                                className="h-11 rounded-xl border-border/30 bg-background/50 text-sm shadow-sm transition-colors focus-visible:bg-background"
                                            />
                                        </FieldBlock>

                                        <FieldBlock
                                            label={t('settings.detach_body_over_bytes')}
                                            hint={t('settings.detach_body_over_bytes_hint')}
                                            htmlFor="detach-over"
                                            unit="KB"
                                        >
                                            <Input
                                                id="detach-over"
                                                type="number"
                                                min="0"
                                                value={detachBodyOver}
                                                onChange={e => setDetachBodyOver(Number(e.target.value))}
                                                className="h-11 rounded-xl border-border/30 bg-background/50 text-sm shadow-sm transition-colors focus-visible:bg-background"
                                            />
                                        </FieldBlock>

                                        <FieldBlock
                                            label={t('settings.body_preview_bytes')}
                                            hint={t('settings.body_preview_bytes_hint')}
                                            htmlFor="preview-bytes"
                                            unit="KB"
                                        >
                                            <Input
                                                id="preview-bytes"
                                                type="number"
                                                min="0"
                                                value={bodyPreview}
                                                onChange={e => setBodyPreview(Number(e.target.value))}
                                                className="h-11 rounded-xl border-border/30 bg-background/50 text-sm shadow-sm transition-colors focus-visible:bg-background"
                                            />
                                        </FieldBlock>

                                        <FieldBlock
                                            label={t('settings.retention_days')}
                                            hint={t('settings.retention_days_hint')}
                                            htmlFor="retention-days"
                                            unit={t('settings.days')}
                                        >
                                            <Input
                                                id="retention-days"
                                                type="number"
                                                min="0"
                                                value={retentionDays}
                                                onChange={e => setRetentionDays(Number(e.target.value))}
                                                className="h-11 rounded-xl border-border/30 bg-background/50 text-sm shadow-sm transition-colors focus-visible:bg-background"
                                            />
                                        </FieldBlock>

                                        {/* 开关项目放入最后网格列中 */}
                                        <div className="flex flex-col justify-center gap-y-5 pt-3">
                                            <ToggleSetting
                                                label={t('settings.early_request_body_snapshot')}
                                                description={t('settings.early_request_body_snapshot_hint')}
                                                checked={earlyRequestBodySnapshot}
                                                onCheckedChange={setEarlyRequestBodySnapshot}
                                            />

                                            <ToggleSetting
                                                label={t('settings.store_base64')}
                                                description={t('settings.store_base64_hint')}
                                                checked={storeBase64}
                                                onCheckedChange={setStoreBase64}
                                            />
                                        </div>
                                    </div>

                                    {/* 文本输入池 */}
                                    <div className="pt-2">
                                        <FieldBlock
                                            label={t('settings.sensitive_headers')}
                                            hint={t('settings.sensitive_headers_hint')}
                                        >
                                            <Textarea
                                                value={sensitiveHeaders}
                                                onChange={e => setSensitiveHeaders(e.target.value)}
                                                rows={5}
                                                className="min-h-[140px] w-full rounded-xl border-border/30 bg-background/50 font-mono text-sm leading-relaxed shadow-sm transition-colors focus-visible:bg-background resize-y"
                                                placeholder="Authorization&#10;x-api-key&#10;api-key"
                                            />
                                        </FieldBlock>
                                    </div>

                                    {/* 操作区 */}
                                    <div className="flex justify-center pt-4">
                                        <Button
                                            type="button"
                                            onClick={handleSaveAll}
                                            disabled={saving}
                                            variant="default"
                                            size="lg"
                                            className="h-11 rounded-xl font-medium shadow-sm transition-all whitespace-nowrap shrink-0"
                                        >
                                            <Save className="mr-2 h-4 w-4 shrink-0" />
                                            {t('common.save')}
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
