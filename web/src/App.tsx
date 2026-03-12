import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom'
import { Globe, LayoutDashboard, Settings as SettingsIcon, Zap } from 'lucide-react'
import { PrismCatLogo } from '@/components/PrismCatLogo'
import { useTranslation } from 'react-i18next'
import { Dashboard } from '@/pages/Dashboard'
import { Settings } from '@/pages/Settings'
import { Playground } from '@/pages/Playground'
import { cn } from '@/lib/utils'
import { TooltipProvider } from '@/components/ui/tooltip'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Toaster } from '@/components/ui/sonner'
import { useState, useEffect } from 'react'
import { fetchConfig } from '@/lib/api'

function AppLayout() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [version, setVersion] = useState<string>('v1.2.0') // 初始显式 v1.2.0，直到接口返回

  useEffect(() => {
    fetchConfig()
      .then(cfg => {
        if (cfg.version) {
          setVersion(cfg.version.startsWith('v') ? cfg.version : `v${cfg.version}`)
        }
      })
      .catch(err => console.error('Failed to fetch version:', err))
  }, [])

  const navItems = [
    { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard },
    { to: '/playground', labelKey: 'nav.playground', icon: Zap },
    { to: '/settings', labelKey: 'nav.settings', icon: SettingsIcon },
  ]

  return (
    <div className="min-h-screen">
      {/* 头部 */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-background/80">
        <div className="w-full px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-start justify-between gap-3 sm:items-center">
            <div className="flex min-w-0 items-center gap-3 sm:gap-6">
              {/* Logo */}
              <a
                href="https://github.com/paopaoandlingyia/PrismCat"
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-80 sm:gap-3"
              >
                <div className="relative">
                  <PrismCatLogo className="h-9 w-9" />
                </div>
                <h1 className="truncate text-lg font-bold prism-gradient-text tracking-tight sm:text-xl">
                  {t('app.title')}
                </h1>
              </a>

              {/* 导航 */}
              <nav className="hidden md:flex items-center gap-2 ml-10">
                {navItems.map((item) => {
                  const isActive = location.pathname === item.to
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={cn(
                        'relative flex items-center justify-center gap-2.5 px-6 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 group min-w-[110px] uppercase tracking-tighter',
                        isActive
                          ? 'text-primary bg-primary/10'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                      )}
                    >
                      <Icon className={cn("h-4 w-4 transition-colors", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                      <span>{t(item.labelKey)}</span>
                    </NavLink>
                  )
                })}
              </nav>
            </div>

            {/* 右侧操作 */}
            <div className="shrink-0 flex items-center gap-2 sm:gap-4">
              <ThemeToggle />
              <button
                onClick={() => i18n.changeLanguage(i18n.language === 'zh' ? 'en' : 'zh')}
                className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border/50 bg-accent/50 px-3 text-[11px] font-black uppercase tracking-widest text-muted-foreground transition-all hover:border-border hover:bg-accent hover:text-foreground active:scale-95 sm:min-w-[110px] sm:px-4"
              >
                <Globe className="h-3.5 w-3.5" />
                <span>{i18n.language === 'zh' ? 'English' : '中文'}</span>
              </button>
            </div>
          </div>

          {/* 移动端导航 */}
          <nav className="mt-3 flex items-center gap-1.5 md:hidden sm:mt-4 sm:-mx-2 sm:gap-2">
            {navItems.map((item) => {
              const isActive = location.pathname === item.to
              const Icon = item.icon
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-medium transition-all sm:px-4 sm:py-3 sm:text-sm',
                    isActive
                      ? 'bg-primary/10 text-primary shadow-sm'
                      : 'text-muted-foreground hover:text-white hover:bg-white/5'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{t(item.labelKey)}</span>
                </NavLink>
              )
            })}
          </nav>
        </div>
      </header>

      {/* 主内容 */}
      <main className="w-full px-4 py-5 space-y-6 sm:px-6 sm:py-6">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/playground" element={<Playground />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      {/* 页脚版本号 */}
      <footer className="flex w-full items-center justify-center px-4 py-4 sm:px-6">
        <p className="text-muted-foreground/20 text-[10px] font-bold tracking-[0.2em] uppercase select-none">
          PrismCat {version}
        </p>
      </footer>
    </div>
  )
}

function App() {
  return (
    <BrowserRouter>
      <TooltipProvider>
        <AppLayout />
        <Toaster position="top-right" expand={true} richColors />
      </TooltipProvider>
    </BrowserRouter>
  )
}

export default App


