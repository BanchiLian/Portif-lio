# Portfólio — Elian Mori

Portfólio pessoal desenvolvido para apresentar minha trajetória, habilidades e projetos como desenvolvedor web. O projeto reúne aplicações independentes construídas com tecnologias nativas da web, com foco em interfaces responsivas, organização, acessibilidade e experiências úteis no dia a dia.

[Acessar o portfólio](https://banchilian.github.io/Portfolio/) · [Perfil no GitHub](https://github.com/BanchiLian)

## Sobre o projeto

A página principal funciona como uma aplicação de página única. As seções são alternadas com JavaScript sem recarregar o navegador, aceitam acesso direto por URL — como `#projetos` e `#contato` — e mantêm a preferência de tema entre as visitas.

Entre os principais recursos estão:

- layout responsivo para computadores, tablets e celulares;
- temas claro e escuro com preferência armazenada localmente;
- navegação lateral minimalista e acessível;
- formulário de contato direcionado ao WhatsApp;
- respeito à configuração `prefers-reduced-motion`;
- projetos independentes organizados dentro do mesmo repositório;
- aplicações com persistência local, consumo de APIs e funcionamento offline;
- validação automática da sintaxe JavaScript com Node.js;
- testes de ponta a ponta em navegador real (Playwright/Python) cobrindo navegação, formulários, temas e os quatro sub-projetos;
- publicação estática por meio do GitHub Pages.

## Tecnologias e ferramentas

| Área | Tecnologias |
| --- | --- |
| Estrutura | HTML5 semântico |
| Interface | CSS3, Flexbox, Grid e Custom Properties |
| Comportamento | JavaScript ES6+ e Web APIs |
| Dados locais | LocalStorage, JSON e CSV |
| Integrações | Fetch API, APIs REST e WhatsApp |
| Visualização | Chart.js |
| Aplicação instalável | Web App Manifest, Service Worker e Cache API |
| Qualidade | Node.js (parser de sintaxe) e Python + Playwright (QA de ponta a ponta em navegador real) |
| Publicação | Git, GitHub e GitHub Pages |

O portfólio não depende de frameworks ou de um processo de build para funcionar. Node.js e Python são utilizados somente no ambiente de desenvolvimento, para validar e testar os códigos antes da publicação.

## Projetos

### Nexus Finance

Aplicação de finanças pessoais redesenhada para uso cotidiano, mantendo uma identidade visual escura com destaques em vermelho inspirada em plataformas de streaming.

Recursos disponíveis:

- visão geral com saldo disponível, entradas, saídas e resultado do período;
- acompanhamento mensal, anual ou de todo o histórico;
- múltiplas contas com configuração de saldo inicial;
- lançamentos de receitas, despesas e aportes em metas;
- controle de contas fixas, vencimentos e pagamentos;
- orçamentos mensais por categoria com indicadores de progresso;
- metas financeiras e acompanhamento do valor acumulado;
- gráficos de fluxo financeiro e despesas por categoria;
- busca e filtros no histórico de movimentações;
- migração automática dos dados salvos pela versão anterior;
- exportação e importação de lançamentos em CSV compatível com Excel;
- modelo de planilha para preenchimento e importação;
- backup e restauração completa dos dados em JSON;
- armazenamento local com remoção restrita aos dados do próprio aplicativo.

`HTML` `CSS` `JavaScript` `Chart.js` `LocalStorage` `CSV` `JSON`

### Vö Performance

Aplicativo pessoal de treinamento reorganizado como uma PWA mobile-first. O plano de treino foi estruturado para consulta e acompanhamento diário, preservando a identidade visual esportiva e as cores originais.

Recursos disponíveis:

- plano de treinamento de futevôlei organizado por sessões;
- acompanhamento de exercícios, séries, repetições e evolução;
- interface adaptada para uso no celular durante os treinos;
- persistência do progresso no navegador;
- manifesto próprio e possibilidade de instalação como aplicativo;
- funcionamento offline com Service Worker e Cache API;
- ícone compartilhado armazenado na pasta global de assets.

`PWA` `JavaScript` `LocalStorage` `Service Worker` `Cache API`

### NexusWeather

Aplicação de previsão do tempo com busca de cidades e dados meteorológicos obtidos de uma API externa. A interface apresenta informações de forma visual, com cartões inspirados em aplicativos móveis de clima.

Recursos disponíveis:

- consulta de cidades;
- temperatura atual e sensação térmica;
- previsão, umidade e velocidade do vento;
- estados visuais de carregamento e tratamento de falhas;
- layout responsivo e integração por Fetch API.

`JavaScript` `Fetch API` `REST` `JSON`

### Nexus Setup

Landing page de e-commerce com apresentação de produtos, imagens relacionadas ao catálogo e simulação do fluxo de compra.

Recursos disponíveis:

- catálogo e filtros por categoria;
- carrinho de compras simulado;
- resumo do pedido;
- finalização direcionada ao WhatsApp;
- layout responsivo com estrutura de landing page.

`HTML` `CSS` `JavaScript` `WhatsApp`

## Estrutura do repositório

```text
.
|-- assets/
|   |-- css/
|   |   `-- style.css
|   |-- js/
|   |   `-- main.js
|   `-- images/
|       |-- favicon.svg
|       |-- perfil.jpg
|       `-- vo-performance-icon.svg
|-- projects/
|   |-- App treino/
|   |   |-- index.html
|   |   |-- manifest.json
|   |   `-- sw.js
|   |-- clima/
|   |   `-- index.html
|   |-- dashboard-financeiro/
|   |   |-- index.html
|   |   |-- script.js
|   |   `-- style.css
|   `-- loja-nexus/
|       `-- index.html
|-- scripts/
|   |-- qa_browser_test.py
|   `-- validate-js.js
|-- workflows/
|   `-- n8n-contato.json
|-- .gitignore
|-- .nojekyll
|-- index.html
|-- package.json
`-- README.md
```

Cada diretório em `projects/` representa uma demonstração independente, acessível pela seção de projetos do portfólio.

## Workflow n8n do formulário de contato

O arquivo `workflows/n8n-contato.json` contém um workflow importável no n8n. Ele recebe `name`, `email` e `message` por `POST`, valida os campos, envia a mensagem por SMTP e responde em JSON.

Para configurar:

1. No n8n, use **Import from File** e selecione `workflows/n8n-contato.json`.
2. Crie uma credencial SMTP no nó **Enviar e-mail** e substitua `portfolio@exemplo.com` e `seu-email@exemplo.com` pelos endereços reais.
3. Ative o workflow e use a URL de produção do webhook: `/webhook/portfolio-contato`.

Exemplo de requisição:

```bash
curl -X POST https://SEU-N8N/webhook/portfolio-contato \
	-H "Content-Type: application/json" \
	-d '{"name":"Maria","email":"maria@example.com","message":"Olá! Gostaria de conversar sobre um projeto."}'
```

O formulário atual continua abrindo o WhatsApp. Para encaminhá-lo ao n8n, será necessário trocar o endpoint no `assets/js/main.js` pela URL pública do seu webhook.

## Executar localmente

Clone o repositório e acesse a pasta:

```bash
git clone https://github.com/BanchiLian/Portfolio.git
cd Portfolio
```

Como o projeto é estático, não existem dependências obrigatórias para visualizar as páginas. Para testar recursos que exigem HTTP, como Service Workers e chamadas de API, utilize um servidor local:

```bash
npx serve .
```

Também é possível utilizar a extensão Live Server do Visual Studio Code.

## Validação com Node.js

O repositório possui um parser automático construído apenas com módulos nativos do Node.js. A verificação percorre os arquivos `.js` e os blocos `<script>` incorporados nos documentos HTML.

```bash
npm run validate
```

O comando informa cada bloco analisado e encerra com erro caso encontre JavaScript com sintaxe inválida. Nenhuma dependência precisa ser instalada para executar a validação.

## Testes de ponta a ponta em navegador (QA)

Além da validação de sintaxe, o repositório tem um script de QA (`scripts/qa_browser_test.py`) que abre um navegador Chromium real via [Playwright](https://playwright.dev/python/) e testa a página principal e os quatro sub-projetos como um usuário faria: navegação entre seções, alternância de tema, abertura de modais, preenchimento de formulários, integração com WhatsApp, carrinho de compras, lançamentos financeiros e o plano de treino.

Requer Python 3.10+ e o navegador do Playwright instalados uma única vez:

```bash
pip install playwright
playwright install chromium
```

Para rodar os testes:

```bash
python scripts/qa_browser_test.py
```

O script sobe um servidor HTTP local descartável, roda os testes e imprime um relatório com `PASS`/`WARN`/`FAIL` por verificação, além de salvar uma screenshot de cada página em `scripts/qa-screenshots/` para conferência visual. Ele encerra com código de saída diferente de zero se alguma verificação falhar — falhas de rede em hosts externos (fontes, imagens de banco de imagens, APIs de clima) são reportadas como aviso, não como falha, já que dependem de conectividade do ambiente e não do código do portfólio.

## Persistência e privacidade

Os aplicativos armazenam informações diretamente no navegador usando `localStorage`. No Nexus Finance, lançamentos também podem ser exportados para CSV e todos os dados podem ser preservados em um backup JSON.

Esses dados não são enviados para um servidor. Por isso, é recomendável criar backups periódicos antes de limpar os dados do navegador ou trocar de dispositivo.

## Publicação

O portfólio é publicado pelo GitHub Pages a partir da branch `main`. O arquivo `.nojekyll` garante que a estrutura estática seja disponibilizada sem processamento adicional do Jekyll.

Antes de publicar uma alteração, o fluxo recomendado é:

```bash
npm run validate
python scripts/qa_browser_test.py
git status
```

## Melhorias futuras

- substituir as imagens ilustrativas (banco de imagens) dos cards de projeto na página principal por capturas de tela reais de cada aplicação;
- criar estudos de caso detalhados para os principais projetos;
- disponibilizar o currículo em PDF;
- adicionar uma versão do conteúdo em inglês;
- incluir testes automatizados de acessibilidade (ex.: axe-core);
- avaliar sincronização autenticada do Nexus Finance com serviços de planilha em nuvem.

## Autor

Desenvolvido por **Elian Mori**.

- [GitHub](https://github.com/BanchiLian)
- [LinkedIn](https://linkedin.com/in/elianmori)
