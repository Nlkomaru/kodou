"use client";
import { RootProvider } from "fumadocs-ui/provider/next";
import type { ReactNode } from "react";
import SearchDialog from "@/components/search";

export function Provider({ children }: { children: ReactNode }) {
    return (
        <RootProvider
            search={{
                SearchDialog,
            }}
            i18n={{
                locale: "ja",
                translations: {
                    search: "検索",
                    searchNoResult: "結果が見つかりません",
                    toc: "このページ",
                    tocNoHeadings: "見出しがありません",
                    lastUpdate: "最終更新",
                    chooseLanguage: "言語を選択",
                    nextPage: "次のページ",
                    previousPage: "前のページ",
                    chooseTheme: "テーマ",
                    editOnGithub: "GitHubで編集",
                },
            }}
            theme={{
                enabled: false,
            }}
        >
            {children}
        </RootProvider>
    );
}
