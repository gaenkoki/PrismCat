import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

import { useTranslation } from 'react-i18next'

export function ThemeToggle() {
    const { t } = useTranslation()
    const [isDark, setIsDark] = useState(() => {
        const isDarkStored = localStorage.getItem('theme') !== 'light'
        if (isDarkStored) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
        return isDarkStored
    })

    const toggleTheme = () => {
        const newDark = !isDark
        setIsDark(newDark)
        if (newDark) {
            document.documentElement.classList.add('dark')
            localStorage.setItem('theme', 'dark')
        } else {
            document.documentElement.classList.remove('dark')
            localStorage.setItem('theme', 'light')
        }
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-full w-9 h-9 hover:bg-white/10"
            title={isDark ? t('common.switch_to_light') : t('common.switch_to_dark')}
        >
            {isDark ? (
                <Sun className="h-[1.2rem] w-[1.2rem] text-yellow-500" />
            ) : (
                <Moon className="h-[1.2rem] w-[1.2rem] text-blue-500" />
            )}
        </Button>
    )
}
