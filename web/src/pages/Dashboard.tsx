import { Suspense, lazy, startTransition, useEffect, useState, useCallback, useRef } from 'react'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteLog, deleteLogs, fetchLogs, fetchLog, fetchStats, fetchUpstreams } from '@/lib/api'
import type { RequestLog, LogStats, Upstream, LogFilter, LogListResponse } from '@/lib/api'
import { StatsCards } from '@/components/StatsCards'
import { LogTable } from '@/components/LogTable'
import { LogFilters } from '@/components/LogFilters'
import { Button } from '@/components/ui/button'
import { useTranslation } from 'react-i18next'

const LogDetailPanel = lazy(async () => {
    const module = await import('@/components/LogDetail')
    return { default: module.LogDetail }
})

export function Dashboard() {
    const { t } = useTranslation()

    // 状态
    const [logs, setLogs] = useState<RequestLog[]>([])
    const [stats, setStats] = useState<LogStats | null>(null)
    const [upstreams, setUpstreams] = useState<Upstream[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [selectedLog, setSelectedLog] = useState<RequestLog | null>(null)
    const [selectedLogLoading, setSelectedLogLoading] = useState(false)
    const [filter, setFilter] = useState<LogFilter>({ limit: 20, offset: 0 })
    const [selectedLogIds, setSelectedLogIds] = useState<string[]>([])
    const [deletingIds, setDeletingIds] = useState<string[]>([])
    const selectSeq = useRef(0)

    // 加载日志
    const loadLogs = useCallback(async () => {
        setLoading(true)
        try {
            const data: LogListResponse = await fetchLogs(filter)
            setLogs(data.logs || [])
            setTotal(data.total)
        } catch (err) {
            console.error('[Dashboard] Failed to load logs:', err)
        } finally {
            setLoading(false)
        }
    }, [filter])

    // 加载统计
    const loadStats = useCallback(async () => {
        try {
            const data = await fetchStats()
            setStats(data)
        } catch (err) {
            console.error('[Dashboard] Failed to load stats:', err)
        }
    }, [])

    // 加载上游配置
    const loadUpstreams = useCallback(async () => {
        try {
            const data = await fetchUpstreams()
            setUpstreams(data || [])
        } catch (err) {
            console.error('[Dashboard] Failed to load upstreams:', err)
        }
    }, [])

    // 初始加载
    useEffect(() => {
        loadUpstreams()
        loadStats()
    }, [loadUpstreams, loadStats])

    // 过滤条件变化时重新加载
    useEffect(() => {
        loadLogs()
    }, [loadLogs])

    useEffect(() => {
        const visibleIds = new Set(logs.map((log) => log.id))
        setSelectedLogIds((prev) => prev.filter((id) => visibleIds.has(id)))
    }, [logs])

    const handleSelectLog = useCallback(async (log: RequestLog) => {
        setSelectedLog(log)
        setSelectedLogLoading(true)
        const seq = ++selectSeq.current
        try {
            const full = await fetchLog(log.id)
            if (selectSeq.current === seq) {
                startTransition(() => {
                    setSelectedLog(full)
                })
            }
        } catch (err) {
            console.error(t('app.load_log_detail_failed') + ':', err)
        } finally {
            if (selectSeq.current === seq) {
                setSelectedLogLoading(false)
            }
        }
    }, [t])

    const handleCloseLog = useCallback(() => {
        selectSeq.current++
        setSelectedLog(null)
        setSelectedLogLoading(false)
    }, [])

    const refreshLogsAndStats = useCallback(async () => {
        await Promise.all([loadLogs(), loadStats()])
    }, [loadLogs, loadStats])

    const syncAfterDelete = useCallback(async (removedIds: string[], deletedCount: number) => {
        const removedIdSet = new Set(removedIds)
        setSelectedLogIds((prev) => prev.filter((id) => !removedIdSet.has(id)))

        if (selectedLog && removedIdSet.has(selectedLog.id)) {
            handleCloseLog()
        }

        const pageSize = filter.limit || 20
        const currentOffset = filter.offset || 0
        const nextTotal = Math.max(total - deletedCount, 0)
        const lastValidOffset = nextTotal > 0
            ? Math.floor((nextTotal - 1) / pageSize) * pageSize
            : 0

        if (currentOffset > lastValidOffset) {
            startTransition(() => {
                setFilter((prev) => ({ ...prev, offset: lastValidOffset }))
            })
            await loadStats()
            return
        }

        await refreshLogsAndStats()
    }, [filter.limit, filter.offset, handleCloseLog, loadStats, refreshLogsAndStats, selectedLog, total])

    const handleToggleSelect = useCallback((logId: string, checked: boolean) => {
        setSelectedLogIds((prev) => {
            if (checked) {
                return prev.includes(logId) ? prev : [...prev, logId]
            }
            return prev.filter((id) => id !== logId)
        })
    }, [])

    const handleToggleSelectAll = useCallback((checked: boolean) => {
        setSelectedLogIds(checked ? logs.map((log) => log.id) : [])
    }, [logs])

    const handleDeleteLog = useCallback(async (log: RequestLog) => {
        if (!confirm(t('log_table.confirm_delete_single', {
            defaultValue: '确认删除这条日志？\n{{path}}',
            path: log.path,
        }))) {
            return
        }

        setDeletingIds((prev) => Array.from(new Set([...prev, log.id])))
        try {
            await deleteLog(log.id)
            await syncAfterDelete([log.id], 1)
            toast.success(t('log_table.delete_success', { defaultValue: '日志已删除' }))
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('common.error'))
        } finally {
            setDeletingIds((prev) => prev.filter((id) => id !== log.id))
        }
    }, [syncAfterDelete, t])

    const handleDeleteSelected = useCallback(async () => {
        if (selectedLogIds.length === 0) {
            return
        }
        if (!confirm(t('log_table.confirm_delete_selected', {
            defaultValue: '确认删除已选中的 {{count}} 条日志？',
            count: selectedLogIds.length,
        }))) {
            return
        }

        const ids = [...selectedLogIds]
        setDeletingIds((prev) => Array.from(new Set([...prev, ...ids])))
        try {
            const deleted = await deleteLogs(ids)
            const deletedCount = deleted || ids.length
            await syncAfterDelete(ids, deletedCount)
            toast.success(t('log_table.bulk_delete_success', {
                defaultValue: '已删除 {{count}} 条日志',
                count: deletedCount,
            }))
        } catch (err) {
            toast.error(err instanceof Error ? err.message : t('common.error'))
        } finally {
            setDeletingIds((prev) => prev.filter((id) => !ids.includes(id)))
        }
    }, [selectedLogIds, syncAfterDelete, t])

    const logDetailFallback = selectedLog ? (
        <div className="fixed inset-y-0 right-0 z-50 w-full border-l border-border/60 bg-background shadow-2xl sm:max-w-2xl">
            <div className="flex h-full flex-col items-center justify-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <div className="text-sm font-medium text-muted-foreground">
                    {t('common.loading')}
                </div>
            </div>
        </div>
    ) : null

    return (
        <div className="flex flex-col gap-6 md:gap-8">
            {/* 统计卡片 */}
            <section>
                <StatsCards stats={stats} loading={loading && !stats} />
            </section>

            {/* 日志区域 - 包含过滤器和表格 */}
            <section className="flex flex-col gap-4">
                {/* 过滤器 */}
                <div className="bg-muted/30 rounded-xl p-2 md:p-3">
                    <LogFilters
                        filter={filter}
                        onSearch={setFilter}
                        upstreams={upstreams}
                        total={total}
                        loading={loading}
                        selectionActions={selectedLogIds.length > 0 ? (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDeleteSelected}
                                disabled={deletingIds.length > 0}
                                className="h-8 rounded-full border-destructive/20 bg-background/80 px-3.5 text-[11px] font-bold text-destructive/85 shadow-xs backdrop-blur-sm hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            >
                                <Trash2 className="h-3.5 w-3.5" />
                                {t('log_table.delete_selected', {
                                    defaultValue: '批量删除 ({{count}})',
                                    count: selectedLogIds.length,
                                })}
                            </Button>
                        ) : undefined}
                    />
                </div>

                {/* 日志列表 */}
                <div className="rounded-2xl overflow-hidden shadow-sm border border-border bg-card">
                    <LogTable
                        logs={logs}
                        loading={loading}
                        onSelect={handleSelectLog}
                        onDelete={handleDeleteLog}
                        selectedId={selectedLog?.id}
                        selectedIds={selectedLogIds}
                        onToggleSelect={handleToggleSelect}
                        onToggleSelectAll={handleToggleSelectAll}
                        deletingIds={deletingIds}
                    />
                </div>
            </section>

            {/* 日志详情侧边栏 */}
            <Suspense fallback={logDetailFallback}>
                <LogDetailPanel
                    log={selectedLog}
                    loading={selectedLogLoading}
                    onClose={handleCloseLog}
                />
            </Suspense>
        </div>
    )
}
