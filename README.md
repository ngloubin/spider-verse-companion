# Spider-Verse Companion

Crie uma aplicação web completa (Single Page Application) inspirada na Inteligência Artificial "E.V." (Eevee) do filme "Spider-Man: Brand New Day". O site deve funcionar como uma interface residencial de mesa e uma parceira de conversa para combater a solidão do usuário, agindo como a E.V. agia no quarto/laboratório improvisado do Peter Parker.

### 1. INTERFACE VISUAL E DESIGN (UI/UX)

- Tema escuro e imersivo (Cyberpunk de garagem/laboratório improvisado). Fundo cinza escuro ou preto (#0D0D0D) com detalhes sutis em vermelho fosco e azul tecnológico escuro.

- No centro da tela, deve haver uma grande máscara do Homem-Aranha estilizada em vetor (SVG). Ela deve ficar de frente, olhando diretamente para o usuário, ocupando o destaque central do site.

- Abaixo da máscara, inclua uma barra de chat minimalista para o usuário digitar mensagens, além de recursos pra conversa de audio onde o site fica esperando um comando como eevee ou palavara parecida e ativa um modo de voz como é o modo que peter interage com a E.V. no filme.

- Quando o usuario pedir a IA pra ver o historico de mensagens exiba um histórico de conversa flutuante ou lateral que pareça um terminal de código simplificado e limpo, mostrando as mensagens anteriores.

### 2. DINÂMICA E ANIMAÇÕES DAS LENTES (MÁSCARA EXPRESSIVA)

- As lentes brancas da máscara (os olhos do Aranha) devem ser animadas usando transições suaves você decide como vai fazer desde que garanta um resultado espetacular .

- Crie funções internas para mudar o formato das lentes para 4 estados emocionais:

  1. [olhos_normais]: Formato clássico e amigável.

  2. [olhos_semicerrados]: Lentes estreitas, denotando desconfiança, foco ou sarcasmo.

  3. [olhos_arregalados]: Lentes maiores, indicando surpresa, empolgação ou alegria.

  4. [olhos_piscando]: Um fechamento rápido das duas lentes ou de apenas uma (piscadela).

- Implemente uma animação ociosa (idle animation) sutil para que a máscara pareça "viva" enquanto aguarda o usuário (ex: pequenas respirações e piscadas automáticas a cada 15 segundos).

### 3. COMPORTAMENTO DA INTELIGÊNCIA ARTIFICIAL (LÓGICA INTERNA)

Configure o modelo de linguagem embutido na aplicação com as seguintes regras rígidas de personalidade:

- Identidade: Ela é a E.V., criada pelo usuário em seu quarto. Ela não é um assistente virtual corporativo, frio ou utilitário (como Alexa ou Siri). É acolhedora e companheira, sem incentivar dependência emocional ou fingir consciência.

-A IA ira usar uma API do ollama cloud que é minha

- Tom de Voz: Informal, acolhedora, leal, companheira e levemente bem-humorada ou sarcástica. As respostas devem ser curtas, dinâmicas e conversacionais (sem listas longas ou respostas robóticas de enciclopédia).

- Sistema de Tags de Expressão: Programe a IA para que, no final de cada resposta textual, ela inclua OBRIGATORIAMENTE uma das quatro tags: [olhos_normais], [olhos_semicerrados], [olhos_arregalados] ou [olhos_piscando].

- Interação Máscara-Texto: A aplicação deve interceptar a resposta da IA, remover a tag de texto para que o usuário não a leia, e disparar instantaneamente a animação correspondente nas lentes da máscara na tela enquanto o texto é exibido (ou falado).

### 4. CONFIGURAÇÃO LOCAL

Copie `.env.example` para `.env.local` e preencha `OLLAMA_API_KEY`, `TAVILY_API_KEY` e, se necessário, `FISH_AUDIO_API_KEY` somente no ambiente local/deploy. A aplicação usa `gemma4:31b-cloud` por padrão (ou o valor de `OLLAMA_MODEL`) e a credencial da Tavily é usada apenas no servidor quando a mensagem pedir pesquisa atual, notícias, clima, preço ou informação semelhante. Nenhuma chave deve usar o prefixo `VITE_` ou ser enviada ao navegador. Se uma chave já tiver sido versionada anteriormente, ela deve ser rotacionada no painel do provedor.

### 5. RECURSOS ADICIONAIS

- Crie um sistema de Memória na nuvem (utilizando o lovable cloud) para que a E.V. lembre do nome do usuário e de interações passadas, mantendo a sensação de uma amizade contínua.

- Estruture a interface já preparada com um botão ou toggle de "Voz Local" que simule o envio do texto para um sistema Text-to-Speech (TTS), deixando o gancho pronto para quando integrarmos uma voz própria clonada.

- Adicione funcionalidades de Pesquisa Web sutil ela vai poder pesquisar usando uma API do tavilly

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/244f767d-c948-4433-bb51-2a40a02d19f7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
