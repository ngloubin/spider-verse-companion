# Rota explícita do modelo 3D

A máscara exibida pela interface principal é um **modelo 3D do Sketchfab**, não os PNGs ou SVGs antigos.

- **Componente ativo:** `client/src/components/SpiderMask.tsx`
- **Renderizador ativo:** iframe do Sketchfab
- **Constante da origem:** `SPIDER_MAN_3D_SOURCE`
- **Constante do embed:** `SPIDER_MAN_3D_EMBED_URL`
- **ID do modelo:** `5e47c63e3dd4436f86e838cfaa334447`
- **Modelo:** Spider-Man, de Kuzzy
- **Fonte:** https://sketchfab.com/3d-models/spider-man-5e47c63e3dd4436f86e838cfaa334447
- **Comportamento:** `autospin=0`; a máscara não gira automaticamente. Ela reage com iluminação, respiração visual e inclinação sutil ao cursor.

Os assets antigos de máscara, caso permaneçam no histórico ou em outros diretórios, são **legado/fallback** e não são importados por `SpiderMask.tsx`. Para trocar o modelo 3D no futuro, altere `SPIDER_MAN_3D_MODEL_ID` e `SPIDER_MAN_3D_SOURCE` neste componente.
