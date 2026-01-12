import { Request, Response } from "express";
import { prisma } from "@repo/db/client";

export async function  signupController (req : Request, res: Response) {
    await prisma.user.create({
    data: {
        firstName: "John",
        email: "john@example.com",
        password: "hashedPassword",
        role: "USER",
    },
    });

    return (res.send("Random return from signup"))
}

export async function  signinController (req : Request, res: Response) {
    return (res.send("Random return from signin"))
}