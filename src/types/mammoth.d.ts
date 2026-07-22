declare module 'mammoth' {
  interface ConvertToHtmlOptions {
    arrayBuffer: ArrayBuffer;
  }

  interface ConvertResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  export function convertToHtml(options: ConvertToHtmlOptions): Promise<ConvertResult>;
}
