// Stand der App (Commit + Bau-Datum), von Vite beim Bauen eingesetzt – in Tests „dev“.
declare const __BUILD__: string | undefined
export const BUILD: string = typeof __BUILD__ === 'string' ? __BUILD__ : 'dev'
