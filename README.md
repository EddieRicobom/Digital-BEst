# Digital Companion BE

Protótipo pessoal de parceiro digital inspirado no Vital Bracelet BE. Não é um produto oficial. O jogo usa passos e calorias ativas do Health Connect, quando disponíveis, e guarda o progresso localmente. A versão web não acessa dados de saúde.

O catálogo de prévias e créditos de sprites e 15 templates BEM foram obtidos do Digital Link; imagens são carregadas do serviço quando disponíveis. O ovo sorteia um bebê e seu template. Os requisitos de evolução do template são apresentados no jogo: treinamentos contam como troféus, e caminhos que dependem de área são liberados ao concluir desafios da expedição, uma regra deste protótipo: cada área exige mais 1.000 passos acumulados e uma vitória. A consulta adicional à Digi-API reúne relações de diferentes mídias e serve para exploração. A disponibilidade e as permissões de uso dos recursos de terceiros devem ser verificadas para qualquer compartilhamento.

## Núcleo de progressão

O ciclo do protótipo é: mover-se rende pontos vitais, treinar rende atributos e vínculo, batalhar rende bits, vínculo e pontuação. Os bits compram chips permanentes no Núcleo (dano, vida, recarga, sorte e vínculo) e o vínculo sobe de nível com batalhas e treinos, dando +2% de dano e vida por nível ao parceiro. Evoluir preserva treino, vínculo e chips.

Durante a batalha, acertos e abates carregam a **Sincronia**: ao encher a barra, ela pode ser liberada manualmente (botão ou tecla R) por 6 segundos de +50% de dano, recarga acelerada, impacto de área e breve invulnerabilidade. A pontuação registra as sincronias usadas.

Cada batalha termina com um resumo de recompensas: nota de S a D, estrelas, pontuação, bits, vínculo, combo e abates. A primeira conquista de uma área paga um bônus inédito e a primeira vitória de cada dia paga bits extras. Há quatro missões diárias (passos, vitórias, treinos e combo) com resgate manual, um bônus automático de sequência diária (até x1,48 em bits), marcos de sequência em 3, 7, 14, 30 e 60 dias e recordes gerais e por área. O laboratório oferece um chip com desconto rotativo a cada dia. Sons de combate são sintetizados no aparelho e podem ser desligados no Núcleo.

## Desenvolvimento

`npm ci`, `npm test`, `npm run build` e `npm run dev`. Para Android, `npx cap sync android` e build com Android SDK e JDK 21. O workflow Android gera um APK de depuração como artefato quando executado no GitHub Actions. Ele ainda precisa ser executado e validado em um aparelho real.

No Mi Fitness, conecte o Health Connect e autorize o compartilhamento de passos e calorias ativas; no simulador, abra Atividade e sincronize. A disponibilidade exata depende do aparelho e do Mi Fitness. Leituras ausentes são apresentadas como indisponíveis. A sincronização considera o dia atual, apenas quando solicitada; não há leitura em segundo plano nem recuperação automática de dias anteriores.
