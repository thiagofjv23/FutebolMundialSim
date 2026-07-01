# TODO

## Calibração de xGBase por era

O expoente de prestígio foi alterado de `0.75 → 0.55` e o `xGBase` da ERA_AMADORA foi recalibrado para `2.6` (commit f5de792). Os valores das outras duas eras foram definidos antes dessa mudança e precisam de recalibração via benchmark.

| Era | Anos | xGBase atual | g/j esperado atual | g/j histórico alvo |
|---|---|---|---|---|
| ERA_PROFISSIONAL_INICIAL | 1933–1969 | 1.7 | ~2.2 (estimado) | ~4.5–5.0 (WM adaptation) |
| ERA_MODERNA | 1970–9999 | 1.6 | ~2.1 (estimado) | ~2.5–3.0 (futebol moderno) |

### O que fazer

- [ ] Rodar benchmark `bench_caos.js` para ERA_PROFISSIONAL_INICIAL (simular a partir de 1933)
- [ ] Encontrar `xGBase` que produza ~4.5 g/j para a Football League nos anos 1933–1969
- [ ] Rodar benchmark para ERA_MODERNA e calibrar para ~2.5–3.0 g/j
- [ ] Considerar recalibrar `xGBase` da ERA_AMADORA pós-1925 (evento 3.84) se o pico histórico de ~6.09 g/j em 1925/26 precisar de mais fidelidade
- [ ] Avaliar se as ligas brasileiras precisam de calibração separada após as mudanças acima

### Referências históricas

- Football League 1920/21 (pré-impedimento): **3.59 g/j**
- Football League 1925/26 (pós-regra nova): **~6.09 g/j**
- Football League ~1930 (defesas adaptadas, formação WM): **~4.5–5.0 g/j**
- Futebol moderno médio (Bundesliga, La Liga, Premier League): **~2.7–3.1 g/j**
