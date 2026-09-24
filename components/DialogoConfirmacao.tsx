"use client";

import { useRef } from "react";
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from "@chakra-ui/react";

interface Props {
  aberto: boolean;
  titulo: string;
  mensagem: string;
  rotuloConfirmar: string;
  aoCancelar: () => void;
  aoConfirmar: () => void;
}

export default function DialogoConfirmacao({
  aberto,
  titulo,
  mensagem,
  rotuloConfirmar,
  aoCancelar,
  aoConfirmar,
}: Props) {
  const botaoCancelar = useRef<HTMLButtonElement>(null);

  return (
    <AlertDialog isOpen={aberto} onClose={aoCancelar} leastDestructiveRef={botaoCancelar} isCentered>
      <AlertDialogOverlay>
        <AlertDialogContent bg="card" color="fg">
          <AlertDialogHeader fontSize="lg" fontWeight="semibold">{titulo}</AlertDialogHeader>
          <AlertDialogBody>{mensagem}</AlertDialogBody>
          <AlertDialogFooter>
            <Button ref={botaoCancelar} variant="ghost" onClick={aoCancelar}>Cancelar</Button>
            <Button ml={3} bg="red.600" color="white" _hover={{ bg: "red.700" }} onClick={aoConfirmar}>
              {rotuloConfirmar}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialogOverlay>
    </AlertDialog>
  );
}
