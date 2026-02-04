import { Response } from "express";

export class ApiResponse<T = any> {
  public statusCode: number;
  public data: T | null;
  public message: string;

  constructor(statusCode: number, data: T | null = null, message: string = "") {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
  }

  send(res: Response) {
    return res.status(this.statusCode).json({
      status: this.statusCode < 400 ? "success" : "error",
      message: this.message,
      data: this.data,
    });
  }
}
