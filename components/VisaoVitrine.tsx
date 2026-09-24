"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Box, Heading, Text, Button, HStack, Link as ChakraLink } from "@chakra-ui/react";
import BarraNavegacao from "@/components/BarraNavegacao";
import FiltroTecnicas from "@/components/FiltroTecnicas";
import SeletorFiltro from "@/components/SeletorFiltro";
import GradeProdutos from "@/components/GradeProdutos";
import SecaoRecomendados from "@/components/SecaoRecomendados";
import MensagemErro from "@/components/MensagemErro";
import { getProdutos, tecnicas, regioes, categorias } from "@/lib/apiFalsa";
import type { ProdutoComArtesao, Tecnica } from "@/lib/tipos";

const OPCOES_TECNICA = ["Todas", ...tecnicas];
const TODAS_REGIOES = "Todas as regiões";
const TODAS_CATEGORIAS = "Todas as categorias";
const OPCOES_REGIAO = [TODAS_REGIOES, ...regioes];
const OPCOES_CATEGORIA = [TODAS_CATEGORIAS, ...categorias];

export default function VisaoVitrine() {
  const parametrosBusca = useSearchParams();
  const [filtroTecnica, setFiltroTecnica] = useState<string>(parametrosBusca.get("tecnica") ?? "Todas");
  const [filtroRegiao, setFiltroRegiao] = useState<string>(TODAS_REGIOES);
  const [filtroCategoria, setFiltroCategoria] = useState<string>(TODAS_CATEGORIAS);
  const [busca, setBusca] = useState(parametrosBusca.get("q") ?? "");
  const [produtos, setProdutos] = useState<ProdutoComArtesao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(false);
    const tecnica = filtroTecnica === "Todas" ? undefined : (filtroTecnica as Tecnica);
    const regiao = filtroRegiao === TODAS_REGIOES ? undefined : filtroRegiao;
    const categoria = filtroCategoria === TODAS_CATEGORIAS ? undefined : filtroCategoria;
    // pequeno atraso pra não disparar uma "chamada de API" a cada tecla digitada
    const temporizador = setTimeout(() => {
      getProdutos(tecnica, busca, regiao, categoria)
        .then((dados) => {
          if (!ativo) return;
          setProdutos(dados);
          setErro(false);
        })
        .catch(() => {
          if (ativo) setErro(true);
        })
        .finally(() => {
          if (ativo) setCarregando(false);
        });
    }, 200);
    return () => {
      ativo = false;
      clearTimeout(temporizador);
    };
  }, [filtroTecnica, filtroRegiao, filtroCategoria, busca, tentativa]);

  const algumFiltroAtivo =
    filtroTecnica !== "Todas" || filtroRegiao !== TODAS_REGIOES || filtroCategoria !== TODAS_CATEGORIAS;

  function limparFiltros() {
    setFiltroTecnica("Todas");
    setFiltroRegiao(TODAS_REGIOES);
    setFiltroCategoria(TODAS_CATEGORIAS);
  }

  return (
    <>
      <BarraNavegacao valorBusca={busca} aoMudarBusca={setBusca} />
      <Box
        backgroundColor="#251e19"
        backgroundImage="linear-gradient(180deg, transparent 90%, var(--chakra-colors-bg) 100%), linear-gradient(90deg, rgba(24,18,15,.94) 0%, rgba(24,18,15,.82) 30%, rgba(24,18,15,.48) 58%, rgba(24,18,15,.06) 100%), url('/hero-oficina-ceramica.webp')"
        backgroundSize="cover"
        backgroundPosition={{ base: "60% center", md: "center 54%" }}
      >
        <Box maxW="1180px" minH={{ base: "500px", md: "600px" }} mx="auto" px={{ base: 5, md: 10 }} py={16} display="flex" alignItems="center">
          <Box maxW="500px">
            <Heading color="white" fontSize={{ base: "2.2rem", md: "3rem" }} lineHeight={1.08} maxW="11ch">
              Feito à mão.
              <br />
              Direto de quem faz.
            </Heading>
            <Text color="whiteAlpha.900" fontSize="1.05rem" maxW="40ch" mt={5} mb={7}>
              Descubra a riqueza do artesanato pernambucano, conecte-se com os mestres e
              apoie a economia criativa local.
            </Text>
            <Button as="a" href="#pecas" variant="solid" size="lg">
              Explorar peças
            </Button>
          </Box>
        </Box>
      </Box>

      <Box maxW="1180px" mx="auto" px={{ base: 5, md: 10 }} pt={{ base: 8, md: 12 }}>
        <Box borderBottom="1px solid" borderColor="border" pb={7} mb={9}>
          <FiltroTecnicas opcoes={OPCOES_TECNICA} valor={filtroTecnica} aoMudar={setFiltroTecnica} />

          <HStack spacing={4} mt={4} flexWrap="wrap" align="flex-end">
            <SeletorFiltro rotulo="Região" opcoes={OPCOES_REGIAO} valor={filtroRegiao} aoMudar={setFiltroRegiao} />
            <SeletorFiltro
              rotulo="Categoria"
              opcoes={OPCOES_CATEGORIA}
              valor={filtroCategoria}
              aoMudar={setFiltroCategoria}
            />
            {algumFiltroAtivo && (
              <ChakraLink fontSize="0.82rem" color="primary" onClick={limparFiltros} cursor="pointer" mb={2}>
                Limpar filtros
              </ChakraLink>
            )}
          </HStack>
        </Box>

        {!busca && !algumFiltroAtivo && <SecaoRecomendados />}

        {busca && (
          <Text fontSize="0.9rem" color="mutedFg" mt={-6} mb={8}>
            Resultados para &quot;{busca}&quot; —{" "}
            <ChakraLink color="primary" onClick={() => setBusca("")} cursor="pointer">
              limpar busca
            </ChakraLink>
          </Text>
        )}

        <Box id="pecas" pb={16}>
          {erro ? (
            <MensagemErro aoTentarNovamente={() => setTentativa((atual) => atual + 1)} />
          ) : (
            <GradeProdutos
              produtos={produtos}
              carregando={carregando}
              mensagemVazia={
                busca
                  ? `Nenhuma peça encontrada para "${busca}". Tente outra técnica, região, categoria ou termo de busca.`
                  : "Nenhuma peça encontrada para esse filtro."
              }
            />
          )}
        </Box>
      </Box>
    </>
  );
}
