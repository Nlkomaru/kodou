import type { BaseLayoutProps } from "@/components/layout/shared";

export function baseOptions(): BaseLayoutProps {
    return {
        nav: {
            title: (
                <div className="flex items-center gap-2">
                    <span className="text-lg font-bold">Kodou</span>
                </div>
            ),
            transparentMode: "top",
        },
        themeSwitch: {
            enabled: false,
        },
        boothUrl: "https://booth.pixiv.help/hc/theming_assets/01HZKMXTTPQAPC1EQZ0FFSANXX",
        githubUrl: "https://github.com/nlkomaru/kodou",
    };
}

