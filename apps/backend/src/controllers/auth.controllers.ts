import { Request, Response } from "express";

export async function  signupController (req : Request, res: Response) {
    return (res.send("Random return from signup"))
}

export async function  signinController (req : Request, res: Response) {
    return (res.send("Random return from signin"))
}