# Digital Companion BE

Protótipo pessoal de parceiro digital inspirado no Vital Bracelet BE. Não é um produto oficial. O jogo usa passos e calorias ativas do Health Connect, quando disponíveis, e guarda o progresso localmente. A versão web não acessa dados de saúde.

O catálogo de prévias e créditos de sprites e 15 templates BEM foram obtidos do Digital Link; imagens são carregadas do serviço quando disponíveis. O ovo sorteia um bebê e seu template. Os requisitos de evolução do template são apresentados no jogo: treinamentos contam como troféus, e caminhos que dependem de área são liberados ao concluir desafios da expedição, uma regra deste protótipo: cada área exige mais 1.000 passos acumulados e uma vitória. A consulta adicional à Digi-API reúne relações de diferentes mídias e serve para exploração. A disponibilidade e as permissões de uso dos recursos de terceiros devem ser verificadas para qualquer compartilhamento.

## Desenvolvimento

`npm ci`, `npm test`, `npm run build` e `npm run dev`. Para Android, `npx cap sync android` e build com Android SDK e JDK 21. O workflow Android gera um APK de depuração como artefato quando executado no GitHub Actions. Ele ainda precisa ser executado e validado em um aparelho real.

No Mi Fitness, conecte o Health Connect e autorize o compartilhamento de passos e calorias ativas; no simulador, abra Atividade e sincronize. A disponibilidade exata depende do aparelho e do Mi Fitness. Leituras ausentes são apresentadas como indisponíveis. A sincronização considera o dia atual, apenas quando solicitada; não há leitura em segundo plano nem recuperação automática de dias anteriores.
