-- =====================================================================
-- ORIGEM | 07 - AUTENTICAÇÃO (SENHA DOS USUÁRIOS)
-- Pré-requisito: 01_ddl_origem.sql (e a carga 05, para os usuários de demonstração).
-- Acrescenta a coluna senha_hash em usuario. A senha nunca é guardada em texto:
-- o hash é scrypt (formato scrypt$N$r$p$sal$hash, gerado pelo próprio app).
-- Usuário com senha_hash nula não consegue entrar. Pode ser executado várias vezes.
-- ATENÇÃO: a carga 05 apaga e recria os usuários; depois de rodá-la, execute este
-- script de novo para restabelecer o login de demonstração.
-- =====================================================================
SET client_encoding TO 'UTF8';
SET search_path TO origem;

ALTER TABLE usuario ADD COLUMN IF NOT EXISTS senha_hash VARCHAR(200);
COMMENT ON COLUMN usuario.senha_hash IS 'Hash scrypt da senha (scrypt$N$r$p$sal$hash); nulo = sem acesso ao login';

-- Logins de demonstração (senha: demo123), os mesmos mostrados na tela de login.
UPDATE usuario SET senha_hash = 'scrypt$16384$8$1$93PjQC0sGxzdlOBVOUvvng==$OMii1lBhjaylRU8jDH4LYp+mjqaOfnwzrXsNatHItn+L7tK1s2PIP2ttG2dlT2MKthxs+JsKRYifY+jvBJxsAw==' WHERE email = 'ana.beatriz@raizespe.dev';
UPDATE usuario SET senha_hash = 'scrypt$16384$8$1$uHM1beFG0OAHCxAfLfNoeQ==$yOGAxgXv4WZuKs7YYBbqImlFVnya63eBr2vENlJqTpypwFxWDxf4hjXoNYhfi9Zz5GfIbY1dwTQ5t1AMJZDZIA==' WHERE email = 'tacaratu@raizespe.dev';
UPDATE usuario SET senha_hash = 'scrypt$16384$8$1$dUB+izSr2wyrn8GAyQgrmw==$NZvv5SqCKOUdI6aL2z7qobwZwg43sOFPk7R+2dHybl8m/bmbtC43OgV84UVrK3siFKpTzhQhCrcWjmFLJNGgGA==' WHERE email = 'admin@raizespe.dev';
