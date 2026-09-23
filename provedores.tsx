"use client";

import { ChakraProvider } from "@chakra-ui/react";
import tema from "@/lib/tema";
import Rodape from "@/components/Rodape";
import GavetaCarrinho from "@/components/GavetaCarrinho";
import { ProvedorCarrinho } from "@/lib/contextoCarrinho";
import { ProvedorPedidos } from "@/lib/contextoPedidos";
import { ProvedorProdutos } from "@/lib/contextoProdutos";

export default function Provedores({ children }: { children: React.ReactNode }) {
  return (
    <ChakraProvider theme={tema}>
      {/* O carrinho envolve tudo porque a barra de navegação abre a gaveta de qualquer página.
          Os pedidos também: o painel do artesão e a área do comprador leem o mesmo estado.
          Produtos entra pelo mesmo motivo: o popup "Adicionar Produto" do painel precisa
          gravar o produto num lugar que sobreviva à navegação. */}
      <ProvedorPedidos>
        <ProvedorProdutos>
          <ProvedorCarrinho>
            {children}
            <Rodape />
            <GavetaCarrinho />
          </ProvedorCarrinho>
        </ProvedorProdutos>
      </ProvedorPedidos>
    </ChakraProvider>
  );
}
