import type { Metadata } from "next";
import { ColorModeScript } from "@chakra-ui/react";
import Provedores from "./provedores";
import "./globals.css";

export const metadata: Metadata = {
  title: "Raízes PE",
  description: "Marketplace de artesanato pernambucano — feito à mão, direto de quem faz.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Work+Sans:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>
        <ColorModeScript initialColorMode="light" />
        <Provedores>{children}</Provedores>
      </body>
    </html>
  );
}
