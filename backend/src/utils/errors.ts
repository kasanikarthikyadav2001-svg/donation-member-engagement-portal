export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "REQUEST_ERROR",
  ) {
    super(message);
  }
}
export const notFound = () =>
  new AppError(404, "This record could not be found.", "NOT_FOUND");
