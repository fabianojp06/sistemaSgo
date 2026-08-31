// Registra os matchers do @testing-library/jest-dom (ex: toBeInTheDocument,
// toHaveValue) no expect do Vitest. Só adiciona matchers — inócuo nos testes
// de ambiente `node`, usados de fato pelos testes de componente (.test.tsx).
import '@testing-library/jest-dom/vitest';
