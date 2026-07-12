import "./global.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Provider } from "@/components/provider";

export const metadata: Metadata = {
	title: {
		template: "%s | Kodou Documentation",
		default: "Kodou Documentation",
	},
	description: "A Software for monitoring heart rate and controlling VRChat avatars based on it",
};

export default function RootLayout({ children }: { children: ReactNode }) {
    return (
        <html lang="ja">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link rel="preconnect" href="https://api.fontshare.com" />
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&display=swap"
                />
                <link
                    rel="stylesheet"
                    href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap"
                />
            </head>
            <body className="flex flex-col min-h-screen">
                <Provider>{children}</Provider>
            </body>
        </html>
    );
}
