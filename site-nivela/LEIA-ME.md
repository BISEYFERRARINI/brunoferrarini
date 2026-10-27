# Eternity Electric — app de gestão (Eternity Electric + Blue Star HVAC)

App instalável no celular, tablet e computador (iPhone, Android, iPad, Windows, Mac).
Funciona com dois tipos de usuário:

- **Administrador** (você e seu sócio): painel com porcentagens, gastos separados por categoria, projetos com valores, equipe, ponto, relatórios. Troca entre Eternity e Blue Star num botão.
- **Funcionário**: bate o ponto com selfie e GPS (detecta a obra sozinho), vê as obras da empresa dele (ficha, escopo, tarefas, plantas) **sem nenhum valor**, marca tarefas feitas, lança gastos (gasolina, material) com foto do recibo.

Enquanto o `config.js` estiver vazio, o app roda em **modo demonstração** (dados de exemplo só no aparelho).

---

## Passo 1 — Criar o banco de dados (Supabase, plano grátis)

1. Entre em **supabase.com** → *Start your project* → crie a conta (pode usar o Google).
2. *New project* → nome `eternity` → crie uma senha forte para o banco (guarde) → região **East US**.
3. No menu esquerdo: **SQL Editor** → *New query* → cole TODO o conteúdo de `supabase/schema.sql` → **Run**.
4. Menu **Authentication → Sign In / Providers → Email**: **desligue "Confirm email"** e salve.
   (Os funcionários entram com usuário e senha, sem e-mail de verdade.)
5. Menu **Authentication → Users → Add user → Create new user**:
   - Email: `bruno@eternityelectric.app` (o que vem antes do @ vira o seu usuário)
   - Senha: a sua senha
   - Marque *Auto Confirm User*
6. Volte ao **SQL Editor** e rode (troque `bruno` se usou outro usuário):
   ```sql
   update public.profiles set role = 'admin', active = true, full_name = 'Bruno' where username = 'bruno';
   ```
   Para o seu sócio, repita os passos 5 e 6 com o usuário dele.
7. Menu **Project Settings → API**: copie a **Project URL** e a chave **anon public**.

## Passo 2 — Ligar o app ao banco

Abra `config.js` e preencha:
```js
SUPABASE_URL: "https://SEU-PROJETO.supabase.co",
SUPABASE_ANON_KEY: "a chave anon public",
```
(A chave *anon* pode ficar no app; quem protege os dados são as regras de segurança do banco.
**Nunca** coloque a chave *service_role* aqui.)

Opcional — liquidações automáticas (aba Preços › Promoções): se você gerar um arquivo `promos.json` ao lado do app,
acrescente `PROMOS_URL: true` (ou o endereço do arquivo, ex.: `PROMOS_URL: "https://…/promos.json"`). Sem isso o app
não procura o arquivo (as ofertas manuais e as do banco continuam aparecendo normalmente).

## Passo 3 — Colocar o app no ar (grátis)

**Opção mais fácil — Netlify Drop**
1. Entre em **app.netlify.com/drop** e crie a conta.
2. Arraste a pasta inteira do app (com `index.html`, `app.js`, `icons/`…) para a página.
3. Ele gera um endereço tipo `eternity-xyz.netlify.app`. Em *Site settings* dá para trocar o nome.
   Para atualizar depois, arraste a pasta de novo em *Deploys*.

**Ou GitHub Pages** (em uma conta GitHub **sua**): crie um repositório, envie os arquivos, *Settings → Pages → Deploy from branch → main*.

## Passo 4 — Instalar nos celulares

- **iPhone/iPad**: abra o endereço no **Safari** → botão Compartilhar → **Adicionar à Tela de Início**.
- **Android**: abra no **Chrome** → aparece "Instalar app" (ou menu ⋮ → *Instalar app*).
- **Computador**: no Chrome/Edge, ícone de instalar na barra de endereço.

O app abre em tela cheia com o ícone da Eternity, como um aplicativo normal.
Na primeira vez, permita **Câmera** e **Localização**.

## Passo 5 — Cadastrar a equipe

No app, entre como administrador → **Equipe → Novo funcionário**: nome, usuário, senha inicial, empresa (Eternity ou Blue Star) e valor/hora.
Passe o usuário e a senha para o funcionário. Para trocar a senha depois: Equipe → Editar → Nova senha.

---

## Como funciona o cálculo

- **Mão de obra** = horas do ponto × valor/hora do funcionário (o valor da hora fica gravado em cada ponto; aumento não muda o passado).
- **Despesas** = lançamentos de material, gasolina, subempreiteiro, permit, equipamento e outros.
- **Custo total** = mão de obra + despesas.
- **% nos círculos**: horas ÷ horas previstas; custos ÷ orçamento; receita ÷ valor da obra; lucro ÷ receita.
- **Orçamento e metas** é sempre o acumulado da obra; os cartões de cima seguem o período escolhido.

## Segurança

- Funcionário só vê as obras da própria empresa, só o próprio ponto e os próprios gastos.
- Valor da obra, orçamento e lucro ficam numa tabela que só administrador consegue ler.
- O horário do ponto é o do servidor (o funcionário não consegue mudar o relógio do celular para ganhar horas).
- Sem internet, o ponto fica guardado no celular e é enviado sozinho quando a conexão volta (aceito até 24h).
- Alguém que tente se cadastrar sozinho fica **inativo** e não vê nada até um administrador ativar.

## Arquivos

| Arquivo | O que é |
|---|---|
| `index.html` | página do app |
| `app.js` | telas e regras do app |
| `data.js` | ligação com o banco (e o modo demonstração) |
| `styles.css` | visual (âmbar = Eternity, azul = Blue Star) |
| `config.js` | **onde você coloca os dados do Supabase** |
| `sw.js`, `manifest.webmanifest`, `icons/` | o que faz o app ser instalável e abrir sem internet |
| `supabase/schema.sql` | estrutura do banco + regras de segurança |
