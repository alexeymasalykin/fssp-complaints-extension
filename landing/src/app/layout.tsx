import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "РКЛ Check — Автоматическая проверка сотрудников по РКЛ",
  description:
    "Chrome-расширение для массовой проверки иностранных сотрудников по Реестру контролируемых лиц МВД через Госуслуги. Данные не покидают ваш браузер.",
  keywords: [
    "РКЛ",
    "проверка иностранных сотрудников",
    "реестр контролируемых лиц",
    "Госуслуги",
    "Chrome расширение",
    "HR",
    "кадры",
    "иностранные работники",
  ],
  openGraph: {
    title: "РКЛ Check — Проверка сотрудников по РКЛ за 12 секунд",
    description:
      "Автоматизируйте проверку иностранных сотрудников через Госуслуги. Данные остаются на вашем компьютере.",
    type: "website",
    locale: "ru_RU",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="scroll-smooth">
      <body className={`${plusJakarta.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
