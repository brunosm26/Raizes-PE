"use client";

import { useCallback, useEffect, useState } from "react";
import { getArtesaosAdmin } from "./apiAdminFiltros";
import type { ArtesaoAdmin } from "./tipos";

// Lista de artesãos do banco (GET /api/artesaos) para as telas do admin, com carregando, erro e
// "tentar de novo". Um artesão novo no banco aparece na próxima vez que a tela abre.
export function useArtesaosAdmin() {
  const [artesaos, setArtesaos] = useState<ArtesaoAdmin[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(false);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(false);
    getArtesaosAdmin()
      .then((lista) => {
        if (ativo) setArtesaos(lista);
      })
      .catch(() => {
        if (ativo) setErro(true);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [tentativa]);

  const tentarDeNovo = useCallback(() => setTentativa((atual) => atual + 1), []);

  return { artesaos, carregando, erro, tentarDeNovo };
}
