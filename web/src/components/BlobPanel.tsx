import { Cloud, Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface BlobPanelProps {
    blobRef: string
    isLoaded: boolean
    loading: boolean
    error: string | null
    onLoad: () => void
    onUsePreview: () => void
}

export function BlobPanel({
    blobRef,
    isLoaded,
    loading,
    error,
    onLoad,
    onUsePreview,
}: BlobPanelProps) {
    const { t } = useTranslation()

    return (
        <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <Cloud className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium text-foreground">
                    {isLoaded ? t('log_detail.blob_loaded') : t('log_detail.blob_detached')}
                </span>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button
                            type="button"
                            className="inline-flex shrink-0 items-center rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={blobRef}
                        >
                            <Info className="h-3 w-3" />
                        </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" sideOffset={4} className="max-w-none font-mono text-[11px] break-all">
                        {blobRef}
                    </TooltipContent>
                </Tooltip>
                <div className="ml-auto flex items-center gap-0.5">
                    {isLoaded ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onUsePreview}
                            className="h-7 px-2 text-[11px] font-medium"
                        >
                            {t('log_detail.use_preview')}
                        </Button>
                    ) : (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onLoad}
                            disabled={loading}
                            className="h-7 px-2 text-[11px] font-medium text-primary hover:bg-primary/10 hover:text-primary"
                        >
                            {loading ? t('common.loading') : t('log_detail.load_full')}
                        </Button>
                    )}
                    <a
                        href={`/api/blobs/${encodeURIComponent(blobRef)}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-7 items-center rounded-md px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                        {t('log_detail.open_raw')}
                    </a>
                </div>
            </div>
            {error && (
                <div className="mt-1 font-mono text-[11px] text-red-500">{error}</div>
            )}
        </div>
    )
}
