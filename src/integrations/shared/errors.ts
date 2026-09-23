export interface ErrorResponse<Code extends string = string> {
  error: {
    code: Code;
    message: string;
  };
}
