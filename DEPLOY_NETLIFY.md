# El Encuentro — Deploy no GitHub e Netlify

## GitHub

1. Crie um repositório vazio no GitHub.
2. Extraia este ZIP e envie todo o conteúdo do projeto para o repositório.
3. Mantenha `package.json` e `pnpm-lock.yaml` na raiz.

## Netlify

1. No Netlify, selecione **Add new site → Import an existing project**.
2. Conecte o repositório do GitHub.
3. O arquivo `netlify.toml` já configura:
   - Build command: `pnpm build`
   - Publish directory: `dist/public`
4. Publique o site.

Os assets visuais já estão dentro de `client/public/assets`, portanto o jogo não depende de caminhos privados do Manus.
