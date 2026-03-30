# 👨‍💻 Portfólio Pessoal | Elian Mori

> **Link do Projeto ao vivo:** [(https://banchilian.github.io/Portif-lio/)]

![Preview do Portfólio](COLOQUE_AQUI_O_LINK_DE_UMA_IMAGEM_DO_SEU_SITE.png)

## 🎯 O Projeto
Este é o meu portfólio pessoal, desenvolvido para centralizar meus projetos, habilidades e jornada como **Desenvolvedor Full Stack**. 

A principal decisão arquitetural deste projeto foi **não utilizar frameworks** (como React ou Vue) nesta camada inicial. O objetivo foi demonstrar domínio sólido sobre os fundamentos da web moderna: manipulação direta do DOM, CSS avançado (com CSS Custom Properties) e HTML5 semântico.

## 🛠️ Tecnologias e Arquitetura

* **HTML5 Semântico:** Estruturação focada em acessibilidade (a11y) e SEO.
* **CSS3 Avançado:** * Arquitetura de estilos baseada em **CSS Variables** (Custom Properties) para gerenciar um sistema de Design System robusto.
  * Implementação nativa de **Dark/Light Mode** com persistência de estado via `localStorage`.
  * Layout fluido utilizando **CSS Grid e Flexbox**, com abordagem *Mobile-First*.
* **Vanilla JavaScript (ES6+):**
  * Criação de um sistema de roteamento interno (SPA Simulation) para navegação entre abas sem recarregar a página, garantindo alta performance.
  * Manipulação eficiente de eventos e DOM.
* **Integração Serverless:** Formulário de contato funcional integrado à API do **FormSubmit**, permitindo o envio de e-mails diretos sem a necessidade de instanciar um servidor backend intermediário.

## 💡 Desafios e Soluções (Mindset Pleno)

1. **Gestão de Estado do Tema (Dark Mode):** * *Problema:* O usuário perdia a preferência de cor ao recarregar a página.
   * *Solução:* Implementação de um script leve que verifica o `localStorage` no momento do carregamento da página, aplicando a classe `dark-mode` no `body` dinamicamente antes da renderização visual completa para evitar efeitos de *flickering* (piscar a tela).

2. **Navegação SPA (Single Page Application) com JS Puro:**
   * *Problema:* Navegações tradicionais com múltiplas páginas HTML causam recarregamentos desnecessários e lentidão.
   * *Solução:* Estruturei o HTML em seções (sections) ocultas e criei um controlador em JavaScript que altera a exibição (display) dinamicamente, mantendo a aplicação em uma única página, com transições suaves (Fade-In).

## 🚀 Como executar o projeto localmente

Como o projeto foi construído utilizando tecnologias nativas do navegador, não há necessidade de instalar dependências complexas (node_modules).

1. Clone o repositório:
```bash
git clone [https://banchilian.github.io/Portif-lio/](https://banchilian.github.io/Portif-lio/)
