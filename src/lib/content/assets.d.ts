// Declaración del worker de pdfjs importado vía Vite con sufijo ?url.
declare module "pdfjs-dist/build/pdf.worker.min.mjs?url" {
  const url: string;
  export default url;
}
