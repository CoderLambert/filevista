// Asset module declarations for Vite/Next.js `?url` imports.

declare module "*.js?url" {
  const src: string;
  export default src;
}
